import type { Agenda, Cliente, DatosCliente, Hechas, Respaldo, Venta } from "./types.ts";
import { crearCliente } from "./core/silver.ts";
import { etiquetaArea } from "./core/gold.ts";
import { hoy } from "./core/dates.ts";
import { fnv1a } from "./core/silver.ts";
import { resolverCliente } from "./core/ficha.ts";
import type { FilaVenta } from "./core/importar.ts";

const KEY = "ruta-visitas:v2";
const d0 = new Date();

/** Estado único de la app. Se guarda en localStorage y se notifica a la UI en cada cambio. */
export const app = {
  clientes: [] as Cliente[],
  agenda: {} as Agenda,
  hechas: {} as Hechas,
  ventas: [] as Venta[],
  year: d0.getFullYear(),
  month: d0.getMonth(),
  sel: null as string | null,
};

const suscriptores: Array<() => void> = [];
export const suscribir = (f: () => void) => void suscriptores.push(f);

export function guardar() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, clientes: app.clientes, agenda: app.agenda, hechas: app.hechas, ventas: app.ventas }));
  } catch { /* almacenamiento no disponible */ }
}
export function emitir() {
  depurarHechas();
  guardar();
  suscriptores.forEach((f) => f());
}

/** Rellena los campos que no existían cuando se guardó el cliente. */
const completar = (c: Cliente): Cliente => ({ ...c, barrio: c.barrio ?? "", categoria: c.categoria ?? "", contacto: c.contacto ?? "", telefono: c.telefono ?? "", notas: c.notas ?? "" });

export const buscar = (id: string) => app.clientes.find((c) => c.id === id);
export const clientesDelDia = (k: string) => (app.agenda[k] ?? []).map(buscar).filter((c): c is Cliente => !!c);

async function leerSilver(): Promise<Cliente[]> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/silver/clientes.json`, { cache: "no-cache" });
    return r.ok ? ((await r.json()) as Cliente[]) : [];
  } catch {
    return [];
  }
}

export async function iniciar() {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* ignorar */ }
  if (raw) {
    try {
      const d = JSON.parse(raw) as Respaldo;
      app.clientes = d.clientes ?? [];
      app.agenda = d.agenda ?? {};
      app.hechas = d.hechas ?? {};
      app.ventas = d.ventas ?? [];
    } catch {
      app.clientes = await leerSilver();
    }
  } else {
    app.clientes = await leerSilver(); // primera visita: sembrar desde la capa plata
  }
  app.clientes = app.clientes.map(completar); // datos guardados antes de existir barrio, categoría…
  app.sel = hoy();
  emitir();
}

// ---------- clientes
export function agregarCliente(d: DatosCliente): string | null {
  const c = crearCliente(d);
  if (!c) return "Escribe el nombre y la dirección.";
  if (buscar(c.id)) return "Esa tienda ya existe.";
  app.clientes.push(c);
  emitir();
  return null;
}

export function importarDatos(datos: DatosCliente[]): { nuevos: number; duplicados: number; invalidos: number } {
  const r = { nuevos: 0, duplicados: 0, invalidos: 0 };
  for (const d of datos) {
    const c = crearCliente(d);
    if (!c) r.invalidos++;
    else if (buscar(c.id)) r.duplicados++;
    else { app.clientes.push(c); r.nuevos++; }
  }
  if (r.nuevos) emitir();
  return r;
}

export function editarCliente(id: string, d: DatosCliente): string | null {
  const actual = buscar(id);
  const nuevo = crearCliente(d);
  if (!actual || !nuevo) return "El nombre y la dirección son obligatorios.";
  if (nuevo.id !== id && buscar(nuevo.id)) return "Ya existe otra tienda con ese nombre y dirección.";
  Object.assign(actual, nuevo, { id }); // el id no cambia para no perder la agenda
  emitir();
  return null;
}

export function eliminarCliente(id: string) {
  app.clientes = app.clientes.filter((c) => c.id !== id);
  app.ventas = app.ventas.filter((v) => v.clienteId !== id);
  for (const k of Object.keys(app.agenda)) {
    app.agenda[k] = app.agenda[k].filter((x) => x !== id);
    if (!app.agenda[k].length) delete app.agenda[k];
  }
  emitir();
}

// ---------- agenda
export function agendar(k: string, id: string) {
  const a = (app.agenda[k] ??= []);
  if (!a.includes(id)) a.push(id);
  emitir();
}
export function quitar(k: string, i: number) {
  app.agenda[k]?.splice(i, 1);
  if (!app.agenda[k]?.length) delete app.agenda[k];
  emitir();
}
export function mover(k: string, i: number, delta: number) {
  const a = app.agenda[k];
  const j = i + delta;
  if (!a || j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  emitir();
}
export function ordenarPorZona(k: string) {
  const a = app.agenda[k];
  if (!a) return;
  const nombre = (id: string) => buscar(id);
  a.sort((x, y) => {
    const cx = nombre(x), cy = nombre(y);
    return etiquetaArea(cx!).localeCompare(etiquetaArea(cy!), "es") || cx!.nombre.localeCompare(cy!.nombre, "es");
  });
  emitir();
}

// ---------- navegación
export function seleccionar(k: string) { app.sel = k; emitir(); }
export function cambiarMes(delta: number) {
  const d = new Date(app.year, app.month + delta, 1);
  app.year = d.getFullYear();
  app.month = d.getMonth();
  emitir();
}
export function irHoy() {
  const n = new Date();
  app.year = n.getFullYear();
  app.month = n.getMonth();
  app.sel = hoy();
  emitir();
}

// ---------- respaldo y sincronización
export const respaldo = (): Respaldo => ({ version: 2, clientes: app.clientes, agenda: app.agenda, hechas: app.hechas, ventas: app.ventas });

export function importarRespaldo(texto: string): string | null {
  try {
    const d = JSON.parse(texto) as Respaldo;
    if (d.version !== 2 || !Array.isArray(d.clientes) || typeof d.agenda !== "object") return "El archivo no es un respaldo válido.";
    app.clientes = d.clientes.map(completar);
    app.agenda = d.agenda;
    app.hechas = d.hechas ?? {};
    app.ventas = d.ventas ?? [];
    emitir();
    return null;
  } catch {
    return "No se pudo leer el archivo.";
  }
}

/** Agrega clientes nuevos de la capa plata sin tocar los que ya editaste. */
export async function sincronizarSilver(): Promise<number> {
  const nuevos = (await leerSilver()).filter((c) => !buscar(c.id));
  app.clientes.push(...nuevos.map(completar));
  if (nuevos.length) emitir();
  return nuevos.length;
}

// ---------- visitas realizadas y autoplanificación
function depurarHechas() {
  for (const k of Object.keys(app.hechas)) {
    app.hechas[k] = app.hechas[k].filter((id) => app.agenda[k]?.includes(id));
    if (!app.hechas[k].length) delete app.hechas[k];
  }
}

export function alternarHecha(k: string, id: string) {
  const a = (app.hechas[k] ??= []);
  const i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1); else a.push(id);
  emitir();
}

let previa: Agenda | null = null;
export function aplicarAgenda(nueva: Agenda) {
  previa = structuredClone(app.agenda);
  app.agenda = nueva;
  emitir();
}
export function deshacerAuto(): boolean {
  if (!previa) return false;
  app.agenda = previa;
  previa = null;
  emitir();
  return true;
}

// ---------- ventas
const idVenta = (v: Omit<Venta, "id">, n: number) => "v_" + fnv1a(`${v.clienteId}|${v.fecha}|${v.monto}|${v.nota}|${n}`);

export function agregarVenta(clienteId: string, fecha: string, monto: number, nota: string): string | null {
  if (!buscar(clienteId)) return "Cliente no encontrado.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "Elige una fecha válida.";
  if (!Number.isFinite(monto) || monto <= 0) return "Escribe un monto mayor que cero.";
  const base = { clienteId, fecha, monto, nota: nota.trim() };
  app.ventas.push({ ...base, id: idVenta(base, app.ventas.length) + Date.now().toString(36) });
  emitir();
  return null;
}

export function eliminarVenta(id: string) {
  app.ventas = app.ventas.filter((v) => v.id !== id);
  emitir();
}

/** Importa ventas por nombre de cliente; omite las que ya existen (mismo cliente, fecha, monto y nota). */
export function importarVentas(filas: FilaVenta[]): { nuevas: number; duplicadas: number; sinCliente: number; invalidas: number } {
  const r = { nuevas: 0, duplicadas: 0, sinCliente: 0, invalidas: 0 };
  for (const f of filas) {
    if (!f.fecha || f.monto === null || f.monto <= 0) { r.invalidas++; continue; }
    const c = resolverCliente(app.clientes, f.cliente, f.direccion);
    if (!c) { r.sinCliente++; continue; }
    if (app.ventas.some((v) => v.clienteId === c.id && v.fecha === f.fecha && v.monto === f.monto && v.nota === f.nota)) { r.duplicadas++; continue; }
    const base = { clienteId: c.id, fecha: f.fecha, monto: f.monto, nota: f.nota };
    app.ventas.push({ ...base, id: idVenta(base, app.ventas.length) });
    r.nuevas++;
  }
  if (r.nuevas) emitir();
  return r;
}

/** Va a una fecha: cambia al mes de esa fecha y la selecciona. */
export function irAFecha(k: string) {
  const [y, m] = k.split("-").map(Number);
  app.year = y;
  app.month = m - 1;
  app.sel = k;
  emitir();
}

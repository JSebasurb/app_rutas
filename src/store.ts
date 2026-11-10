import type { Agenda, Cliente, DatosCliente, Respaldo } from "./types.ts";
import { crearCliente } from "./core/silver.ts";
import { etiquetaArea } from "./core/gold.ts";
import { hoy } from "./core/dates.ts";

const KEY = "ruta-visitas:v2";
const d0 = new Date();

/** Estado único de la app. Se guarda en localStorage y se notifica a la UI en cada cambio. */
export const app = {
  clientes: [] as Cliente[],
  agenda: {} as Agenda,
  year: d0.getFullYear(),
  month: d0.getMonth(),
  sel: null as string | null,
};

const suscriptores: Array<() => void> = [];
export const suscribir = (f: () => void) => void suscriptores.push(f);

export function guardar() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, clientes: app.clientes, agenda: app.agenda }));
  } catch { /* almacenamiento no disponible */ }
}
export function emitir() {
  guardar();
  suscriptores.forEach((f) => f());
}

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
    } catch {
      app.clientes = await leerSilver();
    }
  } else {
    app.clientes = await leerSilver(); // primera visita: sembrar desde la capa plata
  }
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

/** Líneas: Nombre; Dirección; Ciudad; Zona; Estado; Tipo  (también acepta tabulaciones de Excel). */
export function importarLista(texto: string): number {
  let n = 0;
  for (const linea of texto.split("\n")) {
    const p = linea.split(/[;\t]/).map((s) => s.trim());
    if (p.length < 2) continue;
    const c = crearCliente({ nombre: p[0], direccion: p[1], ciudad: p[2], zona: p[3], estado: p[4], tipo: p[5] });
    if (c && !buscar(c.id)) { app.clientes.push(c); n++; }
  }
  if (n) emitir();
  return n;
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
export const respaldo = (): Respaldo => ({ version: 2, clientes: app.clientes, agenda: app.agenda });

export function importarRespaldo(texto: string): string | null {
  try {
    const d = JSON.parse(texto) as Respaldo;
    if (d.version !== 2 || !Array.isArray(d.clientes) || typeof d.agenda !== "object") return "El archivo no es un respaldo válido.";
    app.clientes = d.clientes;
    app.agenda = d.agenda;
    emitir();
    return null;
  } catch {
    return "No se pudo leer el archivo.";
  }
}

/** Agrega clientes nuevos de la capa plata sin tocar los que ya editaste. */
export async function sincronizarSilver(): Promise<number> {
  const nuevos = (await leerSilver()).filter((c) => !buscar(c.id));
  app.clientes.push(...nuevos);
  if (nuevos.length) emitir();
  return nuevos.length;
}

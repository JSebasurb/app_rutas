/**
 * CAPA PLATA — limpieza y normalización.
 * Funciones puras compartidas por el pipeline (Node) y la app (navegador),
 * así lo que el usuario escribe en pantalla recibe el mismo tratamiento que los datos de bronce.
 */
import { ESTADOS } from "../types.ts";
import type { BronzeRow, Cliente, DatosCliente, Estado } from "../types.ts";

export const limpiar = (s: string | undefined) => (s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
export const sinTildes = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** "Cra 11 # 9 - 53" y "Cra 11 #9-53" quedan iguales: "Cra 11 # 9-53". */
export function normalizarDireccion(d: string): string {
  const x = limpiar(d)
    .replace(/\s*#\.?\s*/g, " # ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return capitalizar(x);
}

/** "Jamundí · Cali-Sur" → { ciudad: "Jamundí", zona: "Sur" } */
export function parseUbicacion(u: string): { ciudad: string; zona: string } {
  const partes = limpiar(u).split(/[·|]/).map(limpiar).filter(Boolean);
  let ciudad = partes[0] ?? "";
  let zonaTxt = partes[1] ?? "";
  if (!zonaTxt && ciudad.includes("-")) {
    zonaTxt = ciudad;
    ciudad = ciudad.split("-")[0].trim();
  }
  const zona = zonaTxt.includes("-") ? zonaTxt.split("-").pop()!.trim() : zonaTxt;
  return { ciudad: capitalizar(ciudad), zona: capitalizar(zona) };
}

export function normalizarEstado(e: string | undefined): Estado {
  const k = sinTildes(limpiar(e));
  const hallado = ESTADOS.find((x) => sinTildes(x) === k);
  if (hallado) return hallado;
  if (k === "activo") return "Cliente activo";
  if (k === "inactivo") return "Cliente inactivo";
  return "Prospecto";
}

export const normalizarTipo = (t: string | undefined) => limpiar(t).toUpperCase();

/** "Cali-Sur" → "Sur"; "sur" → "Sur". */
export function normalizarZona(z: string | undefined): string {
  const t = limpiar(z);
  return capitalizar(t.includes("-") ? t.split("-").pop()!.trim() : t);
}

export function idCliente(nombre: string, direccion: string): string {
  const k = sinTildes(nombre) + "|" + sinTildes(direccion).replace(/[^a-z0-9]/g, "");
  return "c_" + fnv1a(k);
}

/** Construye un cliente válido o devuelve null si falta nombre o dirección. */
export function crearCliente(d: DatosCliente): Cliente | null {
  const nombre = limpiar(d.nombre);
  const direccion = normalizarDireccion(d.direccion ?? "");
  if (!nombre || !direccion) return null;
  return {
    id: idCliente(nombre, direccion),
    nombre,
    direccion,
    ciudad: capitalizar(limpiar(d.ciudad)),
    zona: normalizarZona(d.zona),
    barrio: limpiar(d.barrio),
    tipo: normalizarTipo(d.tipo),
    estado: normalizarEstado(d.estado),
    categoria: limpiar(d.categoria),
    contacto: limpiar(d.contacto),
    telefono: limpiar(d.telefono),
    notas: limpiar(d.notas),
  };
}

export function desdeBronce(r: Partial<BronzeRow>): Cliente | null {
  const u = parseUbicacion(r.ubicacion ?? "");
  return crearCliente({ nombre: r.nombre ?? "", direccion: r.direccion ?? "", ciudad: u.ciudad, zona: u.zona, tipo: r.segmento, estado: r.estado, barrio: r.barrio, categoria: r.categoria, contacto: r.contacto, telefono: r.telefono, notas: r.notas });
}

export interface ReporteCalidad {
  filasEntrada: number;
  clientesSalida: number;
  duplicados: string[];
  rechazadas: { fila: number; motivo: string }[];
  advertencias: string[];
}

export function construirSilver(filas: Partial<BronzeRow>[]): { clientes: Cliente[]; calidad: ReporteCalidad } {
  const vistos = new Map<string, Cliente>();
  const calidad: ReporteCalidad = { filasEntrada: filas.length, clientesSalida: 0, duplicados: [], rechazadas: [], advertencias: [] };
  filas.forEach((f, i) => {
    const c = desdeBronce(f);
    if (!c) return void calidad.rechazadas.push({ fila: i + 2, motivo: "Falta nombre o dirección" });
    if (vistos.has(c.id)) return void calidad.duplicados.push(`${c.nombre} — ${c.direccion}`);
    if (!c.direccion.includes("#")) calidad.advertencias.push(`${c.nombre}: dirección sin numeral (#) → "${c.direccion}"`);
    if (!c.ciudad) calidad.advertencias.push(`${c.nombre}: sin ciudad`);
    vistos.set(c.id, c);
  });
  const clientes = [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.direccion.localeCompare(b.direccion, "es"));
  calidad.clientesSalida = clientes.length;
  return { clientes, calidad };
}

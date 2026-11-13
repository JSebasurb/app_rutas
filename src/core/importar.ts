/**
 * Importación: lee texto pegado, CSV o filas de Excel y las convierte en datos de cliente.
 * Columnas de entrada: nombre, dirección, barrio, área (en ese orden, con o sin encabezado).
 * También reconoce, si vienen con encabezado: ciudad, tipo y estado.
 */
import type { DatosCliente } from "../types.ts";
import { limpiar, sinTildes } from "./silver.ts";

export const PLANTILLA = "nombre,direccion,barrio,area\nTienda Ejemplo,Cra 10 # 5-20,San Fernando,Sur\n";

/** Detecta el separador (tabulación de Excel, ; o ,) y respeta las comillas. */
export function leerTabla(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, "");
  const primera = t.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const sep = primera.includes("\t") ? "\t" : primera.includes(";") ? ";" : ",";
  const filas: string[][] = [];
  let campo = "", fila: string[] = [], q = false;
  const cerrar = () => {
    fila.push(campo.trim());
    campo = "";
    if (fila.some((x) => x !== "")) filas.push(fila);
    fila = [];
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') q = false;
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === sep) { fila.push(campo.trim()); campo = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; cerrar(); }
    else campo += c;
  }
  if (campo !== "" || fila.length) cerrar();
  return filas;
}

const ALIAS: Record<string, string[]> = {
  nombre: ["nombre", "tienda", "cliente"],
  direccion: ["direccion", "dir"],
  barrio: ["barrio"],
  area: ["area", "zona"],
  ciudad: ["ciudad", "municipio"],
  tipo: ["tipo", "segmento"],
  estado: ["estado"],
  categoria: ["categoria", "clasificacion"],
  contacto: ["contacto", "encargado", "responsable"],
  telefono: ["telefono", "celular", "tel", "whatsapp"],
  notas: ["notas", "nota", "observaciones"],
};

export function mapearFilas(filas: string[][]): { datos: DatosCliente[]; encabezado: boolean } {
  if (!filas.length) return { datos: [], encabezado: false };
  const norm = (s: string) => sinTildes(limpiar(s));
  const cab = filas[0].map(norm);
  const encabezado = cab.some((c) => ALIAS.nombre.includes(c));
  const idx: Record<string, number> = encabezado
    ? Object.fromEntries(Object.entries(ALIAS).map(([k, v]) => [k, cab.findIndex((c) => v.includes(c))]))
    : { nombre: 0, direccion: 1, barrio: 2, area: 3, ciudad: -1, tipo: -1, estado: -1, categoria: -1, contacto: -1, telefono: -1, notas: -1 };
  const g = (r: string[], k: string) => (idx[k] >= 0 ? r[idx[k]] ?? "" : "");
  const datos = (encabezado ? filas.slice(1) : filas).map((r) => ({
    nombre: g(r, "nombre"), direccion: g(r, "direccion"), barrio: g(r, "barrio"),
    zona: g(r, "area"), ciudad: g(r, "ciudad"), tipo: g(r, "tipo"), estado: g(r, "estado"),
    categoria: g(r, "categoria"), contacto: g(r, "contacto"), telefono: g(r, "telefono"), notas: g(r, "notas"),
  }));
  return { datos, encabezado };
}

// ---------- ventas
export interface FilaVenta { cliente: string; direccion: string; fecha: string; monto: number | null; nota: string }

/** "10/11/2026", "10-11-2026" (día/mes/año) o "2026-11-10" → "2026-11-10"; "" si no es válida. */
export function parseFecha(s: string): string {
  const t = limpiar(s);
  let y = 0, m = 0, d = 0, r: RegExpMatchArray | null;
  if ((r = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/))) { d = +r[1]; m = +r[2]; y = +r[3]; }
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "$ 1.234,50", "1,234.50", "1.200", "850000" → número. */
export function parseMonto(s: string): number | null {
  let t = String(s ?? "").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(t)) return null;
  const p = t.lastIndexOf("."), c = t.lastIndexOf(",");
  if (p >= 0 && c >= 0) t = p > c ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", ".");
  else if (c >= 0) t = /,\d{3}$/.test(t) && t.split(",").length > 1 && !/,\d{1,2}$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  else if (p >= 0) t = /\.\d{3}$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const ALIAS_V: Record<string, string[]> = {
  cliente: ["cliente", "nombre", "tienda"],
  direccion: ["direccion", "dir"],
  fecha: ["fecha"],
  monto: ["monto", "valor", "venta", "ventas", "total", "importe"],
  nota: ["nota", "notas", "detalle", "observaciones", "factura"],
};

/** Filas de ventas: cliente, fecha, monto, nota (con encabezado en cualquier orden, o en ese orden sin encabezado). */
export function mapearVentas(filas: string[][]): FilaVenta[] {
  if (!filas.length) return [];
  const norm = (s: string) => sinTildes(limpiar(s));
  const cab = filas[0].map(norm);
  const enc = cab.some((c) => ALIAS_V.monto.includes(c) || ALIAS_V.cliente.includes(c));
  const idx: Record<string, number> = enc
    ? Object.fromEntries(Object.entries(ALIAS_V).map(([k, v]) => [k, cab.findIndex((c) => v.includes(c))]))
    : { cliente: 0, direccion: -1, fecha: 1, monto: 2, nota: 3 };
  const g = (r: string[], k: string) => (idx[k] >= 0 ? r[idx[k]] ?? "" : "");
  return (enc ? filas.slice(1) : filas).map((r) => ({ cliente: limpiar(g(r, "cliente")), direccion: g(r, "direccion"), fecha: parseFecha(g(r, "fecha")), monto: parseMonto(g(r, "monto")), nota: limpiar(g(r, "nota")) }));
}

export const PLANTILLA_VENTAS = "cliente,direccion,fecha,monto,nota\nTienda Ejemplo,Cra 10 # 5-20,2026-11-10,250000,Factura 1234\n";

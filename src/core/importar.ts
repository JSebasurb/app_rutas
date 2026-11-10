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
};

export function mapearFilas(filas: string[][]): { datos: DatosCliente[]; encabezado: boolean } {
  if (!filas.length) return { datos: [], encabezado: false };
  const norm = (s: string) => sinTildes(limpiar(s));
  const cab = filas[0].map(norm);
  const encabezado = cab.some((c) => ALIAS.nombre.includes(c));
  const idx: Record<string, number> = encabezado
    ? Object.fromEntries(Object.entries(ALIAS).map(([k, v]) => [k, cab.findIndex((c) => v.includes(c))]))
    : { nombre: 0, direccion: 1, barrio: 2, area: 3, ciudad: -1, tipo: -1, estado: -1 };
  const g = (r: string[], k: string) => (idx[k] >= 0 ? r[idx[k]] ?? "" : "");
  const datos = (encabezado ? filas.slice(1) : filas).map((r) => ({
    nombre: g(r, "nombre"), direccion: g(r, "direccion"), barrio: g(r, "barrio"),
    zona: g(r, "area"), ciudad: g(r, "ciudad"), tipo: g(r, "tipo"), estado: g(r, "estado"),
  }));
  return { datos, encabezado };
}

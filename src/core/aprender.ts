/**
 * Mejora local del OCR, sin modelos externos:
 *  1) reconoce tiendas que ya tienes aunque el OCR las lea con errores (comparación aproximada),
 *  2) recuerda tus correcciones y las aplica la próxima vez,
 *  3) marca lo que conviene revisar.
 */
import type { Cliente, DatosCliente } from "../types.ts";
import { limpiar, sinTildes } from "./silver.ts";

export interface Correcciones {
  nombre: Record<string, string>;
  direccion: Record<string, string>;
}
export const sinCorrecciones = (): Correcciones => ({ nombre: {}, direccion: {} });

/** Texto comparable: sin tildes, mayúsculas, espacios ni signos. */
export const clave = (s: string | undefined) => sinTildes(limpiar(s)).replace(/[^a-z0-9]/g, "");

function distancia(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** 1 = idénticos, 0 = nada en común (distancia de Levenshtein normalizada). */
export function similitud(a: string | undefined, b: string | undefined): number {
  const x = clave(a), y = clave(b);
  const m = Math.max(x.length, y.length);
  return m ? 1 - distancia(x, y) / m : 1;
}

export function aplicarCorrecciones(datos: DatosCliente[], c: Correcciones): DatosCliente[] {
  return datos.map((d) => ({ ...d, nombre: c.nombre[clave(d.nombre)] ?? d.nombre, direccion: c.direccion[clave(d.direccion)] ?? d.direccion }));
}

/** Si una fila se parece a una tienda que ya existe (nombre y dirección), usa los datos de la existente. */
export function corregirConConocidos(datos: DatosCliente[], conocidos: Cliente[]): { datos: DatosCliente[]; reconocidas: number } {
  let reconocidas = 0;
  const salida = datos.map((d) => {
    let mejor: Cliente | null = null, puntaje = 0;
    for (const k of conocidos) {
      const sn = similitud(d.nombre, k.nombre), sd = similitud(d.direccion, k.direccion);
      if (sn >= 0.85 && sd >= 0.75 && sn + sd > puntaje) { mejor = k; puntaje = sn + sd; }
    }
    if (!mejor) return d;
    reconocidas++;
    return { nombre: mejor.nombre, direccion: mejor.direccion, barrio: mejor.barrio, ciudad: mejor.ciudad, zona: mejor.zona, tipo: mejor.tipo, estado: mejor.estado };
  });
  return { datos: salida, reconocidas };
}

/** Compara lo que leyó el OCR con lo que dejó el usuario y guarda las diferencias (máx. 500 por campo). */
export function aprender(original: DatosCliente[], final: DatosCliente[], previas: Correcciones): Correcciones {
  const out: Correcciones = { nombre: { ...previas.nombre }, direccion: { ...previas.direccion } };
  for (const f of final) {
    if (!limpiar(f.nombre)) continue;
    let mejor: DatosCliente | null = null, p = 0.6;
    for (const o of original) {
      const s = (similitud(o.nombre, f.nombre) + similitud(o.direccion, f.direccion)) / 2;
      if (s >= p) { mejor = o; p = s; }
    }
    if (!mejor) continue;
    if (limpiar(mejor.nombre) !== limpiar(f.nombre) && clave(mejor.nombre)) out.nombre[clave(mejor.nombre)] = limpiar(f.nombre);
    if (limpiar(mejor.direccion) !== limpiar(f.direccion) && clave(mejor.direccion)) out.direccion[clave(mejor.direccion)] = limpiar(f.direccion);
  }
  for (const campo of ["nombre", "direccion"] as const) {
    const ks = Object.keys(out[campo]);
    for (const k of ks.slice(0, Math.max(0, ks.length - 500))) delete out[campo][k];
  }
  return out;
}

/** Motivos por los que una fila leída conviene revisarla a mano. */
export function revisar(c: Cliente): string[] {
  const r: string[] = [];
  if (!c.direccion.includes("#")) r.push("dirección sin #");
  if (/[^\p{L}\p{N}\s#.,\-°ªº/]/u.test(c.direccion)) r.push("símbolos raros en la dirección");
  if (/[@®©|_\\<>{}[\]~^=]/.test(c.nombre)) r.push("símbolos raros en el nombre");
  if (c.nombre.length < 3) r.push("nombre muy corto");
  if (!c.zona) r.push("sin zona");
  return r;
}

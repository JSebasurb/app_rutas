/**
 * Extracción de tiendas a partir del texto que devuelve el OCR de una captura de la app
 * (tarjetas con: nombre + insignia "Prospecto", dirección, y una línea "TIPO Ciudad · Zona · sin gestión").
 * Funciones puras y tolerantes a los errores típicos del OCR; el usuario revisa y corrige antes de importar.
 */
import type { DatosCliente } from "../types.ts";
import { limpiar, normalizarEstado, sinTildes } from "./silver.ts";

const RE_ESTADO = /(prospecto|cliente\s+activo|cliente\s+inactivo|perdido)/i;
const RE_DIR = /^(cll?|cra?|kr|calle|carrera|av|avenida|diag|diagonal|trans|transv|tv|circular)\.?\s*\d/i;
const RE_GESTION = /\s*[-·.]?\s*sin\s*gesti\S*\s*$/i;
const RE_RUIDO = /^\d{1,2}:\d{2}|\d{4,}\s*[-·.]\s*[A-Za-z]|mi cartera|^(resumen|ruta del d\S*)\b|edit with|lovable/i;
const CIUDADES_BASE = ["Cali", "Jamundí"];

interface Linea { t: string; estado?: string; eti: boolean }

function clasificar(raw: string): Linea | null {
  let t = limpiar(raw);
  if (!t || RE_RUIDO.test(t)) return null;
  const eti = /sin\s*gesti/i.test(t) || (/^[A-Z]{2,6}\s/.test(t) && /\bcali\s*-\s*\w+$/i.test(t));
  let estado: string | undefined;
  const m = t.match(RE_ESTADO);
  if (m) {
    estado = normalizarEstado(m[1].replace(/\s+/g, " "));
    // el OCR lee el punto de la insignia como @, ®, e, o…: se quita junto con la palabra
    t = limpiar(t.replace(RE_ESTADO, "")).replace(/\s+[eEoO0@®©•●○◉&]$/, "").replace(/[\s@®©•●○◉]+$/, "");
  }
  return t ? { t, estado, eti } : null;
}

/** Arregla fallos frecuentes del OCR en direcciones: "Cll54#8asur-60" → "Cll 54#8 a sur-60". */
export function repararDireccion(d: string): string {
  return limpiar(d)
    .replace(/^(Cll|Cra|Cl|Cr|Kr|Av|Diag|Trans)(?=\d)/i, "$1 ")
    .replace(/^(Cll|Cra|Cl|Cr|Kr)([lI|]{1,2})(?=\s*#)/i, (_m, p: string, n: string) => `${p} ${n.replace(/[lI|]/g, "1")}`)
    .replace(/(\d)a(sur|norte|oeste|este)\b/gi, "$1 a $2")
    .replace(/\b(a)(sur|norte|oeste|este)\b/gi, "$1 $2");
}

function restaurarCiudad(c: string, conocidas: string[]): string {
  const k = sinTildes(c);
  return [...conocidas, ...CIUDADES_BASE].find((x) => sinTildes(x) === k) ?? (c ? c.charAt(0).toUpperCase() + c.slice(1) : "");
}

function leerEtiqueta(t: string, conocidas: string[]) {
  let s = t.replace(RE_GESTION, "").trim();
  const m = s.match(/^([A-Z]{2,6})\b\s*(.*)$/);
  let tipo = "";
  if (m) { tipo = m[1]; s = m[2]; }
  const w = s.split(/[-·.•|=\s]+/).filter((x) => x.length > 1);
  return { tipo, ciudad: restaurarCiudad(w[0] ?? "", conocidas), zona: w.length > 1 ? restaurarCiudad(w[w.length - 1], []) : "" };
}

export function extraerDeTexto(texto: string, ciudadesConocidas: string[] = []): DatosCliente[] {
  const L = texto.split(/\r?\n/).map(clasificar).filter((x): x is Linea => !!x);
  const hayEti = L.some((x) => x.eti);
  const anclas: number[] = []; // índice de la línea de dirección de cada tarjeta
  L.forEach((x, i) => {
    if (hayEti) { if (x.eti && i > 0 && !L[i - 1].eti && !L[i - 1].estado && /\d/.test(L[i - 1].t)) anclas.push(i - 1); }
    else if (RE_DIR.test(x.t)) anclas.push(i);
  });
  const out: DatosCliente[] = [];
  let fin = -1;
  for (const a of anclas) {
    const previas = L.slice(fin + 1, a);
    let k = -1;
    previas.forEach((x, j) => { if (x.estado) k = j; });
    const lineas = k >= 0 ? previas.slice(k) : previas.slice(-2); // el nombre empieza en la línea de la insignia
    const nombre = limpiar(lineas.map((x) => x.t).join(" "));
    const e = hayEti ? L[a + 1] : undefined;
    fin = hayEti ? a + 1 : a;
    if (!nombre) continue;
    const u = e ? leerEtiqueta(e.t, ciudadesConocidas) : { tipo: "", ciudad: "", zona: "" };
    out.push({ nombre, direccion: repararDireccion(L[a].t), ciudad: u.ciudad, zona: u.zona, tipo: u.tipo, estado: lineas.find((x) => x.estado)?.estado ?? "" });
  }
  return out;
}

/** Tabla tabulada (con encabezado) lista para editar en el cuadro de importación. */
export function aTabla(datos: DatosCliente[]): string {
  const f = (d: DatosCliente) => [d.nombre, d.direccion, d.barrio ?? "", d.zona ?? "", d.ciudad ?? "", d.tipo ?? "", d.estado ?? ""].join("\t");
  return ["nombre\tdireccion\tbarrio\tarea\tciudad\ttipo\testado", ...datos.map(f)].join("\n");
}

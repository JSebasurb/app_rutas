import { ESTADOS } from "../types.ts";

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Rellena un <select> conservando la selección si sigue existiendo. */
export function llenar(el: HTMLSelectElement, primera: string | null, opciones: readonly string[]) {
  const cur = el.value;
  el.innerHTML = (primera !== null ? `<option value="">${esc(primera)}</option>` : "") + opciones.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
  if (opciones.includes(cur)) el.value = cur;
}

export const claseEstado = (e: string) => "e" + Math.max(0, ESTADOS.indexOf(e as (typeof ESTADOS)[number]));

export function descargar(blob: Blob, nombre: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

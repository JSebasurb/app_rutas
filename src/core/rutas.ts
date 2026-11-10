/** Utilidades de ruta: enlaces de Google Maps y texto para compartir por WhatsApp. */
import type { Cliente } from "../types.ts";
import { etiquetaArea } from "./gold.ts";

const PAIS = "Colombia";
export const consulta = (c: Cliente) => [c.direccion, c.barrio, c.ciudad, PAIS].filter(Boolean).join(", ");

export interface EnlaceRuta { url: string; etiqueta: string }

/** Google Maps admite origen + destino + 8 paradas: se parte en tramos de `max` puntos. */
export function enlacesMaps(cs: Cliente[], max = 10): EnlaceRuta[] {
  const urls: string[] = [];
  let ini = 0;
  while (cs.length && ini < cs.length) {
    const fin = Math.min(ini + max, cs.length);
    const tr = cs.slice(ini, fin);
    const p = new URLSearchParams({ api: "1", travelmode: "driving", destination: consulta(tr[tr.length - 1]) });
    if (tr.length > 1) {
      p.set("origin", consulta(tr[0]));
      if (tr.length > 2) p.set("waypoints", tr.slice(1, -1).map(consulta).join("|"));
    }
    urls.push("https://www.google.com/maps/dir/?" + p.toString());
    if (fin === cs.length) break;
    ini = fin - 1; // la última parada del tramo es el origen del siguiente
  }
  return urls.map((url, i) => ({ url, etiqueta: urls.length === 1 ? "Abrir en Maps" : `Maps ${i + 1}/${urls.length}` }));
}

export function textoRuta(titulo: string, cs: Cliente[]): string {
  return [titulo, ...cs.map((c, i) => `${i + 1}. ${c.nombre} — ${c.direccion}${c.barrio ? ", " + c.barrio : ""} (${etiquetaArea(c)})`)].join("\n");
}

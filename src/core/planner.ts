/** Autoplanificación: reparte tiendas por los días hábiles del mes agrupándolas por área y barrio. */
import type { Agenda, Cliente } from "../types.ts";
import { clave, diasEnMes, indiceSemana } from "./dates.ts";
import { etiquetaArea, filasMes } from "./gold.ts";

export interface OpcionesAuto {
  porDia: number;
  /** 0 = lunes … 6 = domingo */
  diasSemana: number[];
  soloSinAgendar: boolean;
  /** "" = todos los estados */
  estado: string;
  /** No agenda días anteriores a esta fecha (YYYY-MM-DD). */
  desde?: string;
}

const cmp = (a: string, b: string) => a.localeCompare(b, "es");
export const porZona = (a: Cliente, b: Cliente) => cmp(etiquetaArea(a), etiquetaArea(b)) || cmp(a.barrio, b.barrio) || cmp(a.nombre, b.nombre);

export function autoplanificar(cs: Cliente[], agenda: Agenda, y: number, m: number, o: OpcionesAuto) {
  const nueva: Agenda = Object.fromEntries(Object.entries(agenda).map(([k, v]) => [k, [...v]]));
  const yaAgendado = new Set(filasMes(cs, agenda, y, m).filter((r) => r.dias.length).map((r) => r.cliente.id));
  const cola = cs.filter((c) => (!o.estado || c.estado === o.estado) && (!o.soloSinAgendar || !yaAgendado.has(c.id))).sort(porZona);
  const dias: string[] = [];
  for (let d = 1; d <= diasEnMes(y, m); d++) {
    const k = clave(y, m, d);
    if (o.diasSemana.includes(indiceSemana(y, m, d)) && (!o.desde || k >= o.desde)) dias.push(k);
  }
  const porId = new Map(cs.map((c) => [c.id, c]));
  const tocados = new Set<string>();
  let i = 0, asignadas = 0;
  for (const k of dias) {
    const lista = nueva[k] ?? [];
    while (lista.length < Math.max(1, o.porDia) && i < cola.length) {
      const c = cola[i++];
      if (!lista.includes(c.id)) { lista.push(c.id); asignadas++; tocados.add(k); }
    }
    if (lista.length) nueva[k] = lista;
  }
  for (const k of tocados) nueva[k].sort((a, b) => (porId.has(a) && porId.has(b) ? porZona(porId.get(a)!, porId.get(b)!) : 0));
  return { agenda: nueva, asignadas, sinCupo: cola.length - i, diasUsados: tocados.size };
}

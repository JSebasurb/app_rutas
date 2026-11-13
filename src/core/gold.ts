/**
 * CAPA ORO — métricas listas para consumir (resumen de cartera y análisis mensual de agenda).
 */
import type { Agenda, Cliente, Hechas, Venta } from "../types.ts";
import { indiceSemana, prefijoMes } from "./dates.ts";

export const etiquetaArea = (c: Cliente) => (c.zona ? `${c.ciudad} · ${c.zona}` : c.ciudad || "Sin área");

function contar<T>(items: T[], f: (t: T) => string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const i of items) {
    const k = f(i) || "Sin dato";
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

export function resumenCartera(cs: Cliente[]) {
  return {
    generado: new Date().toISOString().slice(0, 10),
    total: cs.length,
    porCiudad: contar(cs, (c) => c.ciudad),
    porZona: contar(cs, (c) => c.zona),
    porArea: contar(cs, etiquetaArea),
    porTipo: contar(cs, (c) => c.tipo),
    porCategoria: contar(cs, (c) => c.categoria),
    porEstado: contar(cs, (c) => c.estado),
  };
}

export interface FilaMes {
  cliente: Cliente;
  dias: number[];
  /** cuántas de esas visitas ya se marcaron como hechas */
  hechas: number;
}

/** Para cada cliente, los días del mes en que está agendado. */
export function filasMes(cs: Cliente[], agenda: Agenda, y: number, m: number, hechas: Hechas = {}): FilaMes[] {
  const pre = prefijoMes(y, m);
  const mapa = new Map<string, number[]>();
  const hh = new Map<string, number>();
  for (const k of Object.keys(agenda).sort()) {
    if (!k.startsWith(pre)) continue;
    for (const id of agenda[k]) {
      let a = mapa.get(id);
      if (!a) mapa.set(id, (a = []));
      a.push(+k.slice(8));
      if (hechas[k]?.includes(id)) hh.set(id, (hh.get(id) ?? 0) + 1);
    }
  }
  return cs.map((c) => ({ cliente: c, dias: mapa.get(c.id) ?? [], hechas: hh.get(c.id) ?? 0 }));
}

export interface Grupo {
  clave: string;
  total: number;
  agendadas: number;
  visitas: number;
}

export function agrupar(filas: FilaMes[], f: (c: Cliente) => string, orden?: readonly string[]): Grupo[] {
  const m = new Map<string, Grupo>();
  (orden ?? []).forEach((k) => m.set(k, { clave: k, total: 0, agendadas: 0, visitas: 0 }));
  for (const r of filas) {
    const k = f(r.cliente) || "Sin dato";
    let g = m.get(k);
    if (!g) m.set(k, (g = { clave: k, total: 0, agendadas: 0, visitas: 0 }));
    g.total++;
    if (r.dias.length) g.agendadas++;
    g.visitas += r.dias.length;
  }
  const arr = [...m.values()];
  return orden ? arr : arr.sort((a, b) => a.clave.localeCompare(b.clave, "es"));
}

export function analisisMes(cs: Cliente[], agenda: Agenda, y: number, m: number, hechas: Hechas = {}, ventas: Venta[] = []) {
  const filas = filasMes(cs, agenda, y, m, hechas);
  const pre = prefijoMes(y, m);
  const ventasMes = ventas.filter((v) => v.fecha.startsWith(pre)).reduce((a, v) => a + v.monto, 0);
  const agendadas = filas.filter((r) => r.dias.length).length;
  const visitas = filas.reduce((a, r) => a + r.dias.length, 0);
  const realizadas = filas.reduce((a, r) => a + r.hechas, 0);
  const porSemana = [0, 0, 0, 0, 0, 0, 0];
  for (const r of filas) for (const d of r.dias) porSemana[indiceSemana(y, m, d)]++;
  return {
    filas,
    total: cs.length,
    agendadas,
    sinAgendar: cs.length - agendadas,
    visitas,
    realizadas,
    ventasMes,
    cumplimiento: visitas ? Math.round((realizadas * 100) / visitas) : 0,
    cobertura: cs.length ? Math.round((agendadas * 100) / cs.length) : 0,
    porSemana,
  };
}

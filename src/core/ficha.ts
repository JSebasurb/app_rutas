/** Ficha de cliente: historial de visitas, ventas y resumen para analizar cliente por cliente. */
import type { Agenda, Cliente, Hechas, Venta } from "../types.ts";
import { clave, similitud } from "./aprender.ts";

export type EstadoVisita = "hecha" | "vencida" | "agendada";
export interface VisitaFicha { fecha: string; estado: EstadoVisita }

export const formatoMonto = (n: number) => "$ " + Math.round(n).toLocaleString("es-CO");

export function fichaCliente(id: string, agenda: Agenda, hechas: Hechas, ventas: Venta[], hoyK: string) {
  const visitas: VisitaFicha[] = Object.keys(agenda).sort().filter((k) => agenda[k].includes(id)).map((k) => ({
    fecha: k,
    estado: hechas[k]?.includes(id) ? "hecha" : k < hoyK ? "vencida" : "agendada",
  }));
  const hechasV = visitas.filter((v) => v.estado === "hecha");
  const vencidas = visitas.filter((v) => v.estado === "vencida").length;
  const vs = ventas.filter((v) => v.clienteId === id).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const total = vs.reduce((a, v) => a + v.monto, 0);
  const mes = new Map<string, number>();
  for (const v of vs) mes.set(v.fecha.slice(0, 7), (mes.get(v.fecha.slice(0, 7)) ?? 0) + v.monto);
  return {
    visitas,
    ventas: vs,
    realizadas: hechasV.length,
    vencidas,
    agendadas: visitas.filter((v) => v.estado === "agendada").length,
    cumplimiento: hechasV.length + vencidas ? Math.round((hechasV.length * 100) / (hechasV.length + vencidas)) : 0,
    ultimaVisita: hechasV.at(-1)?.fecha ?? "",
    proximaVisita: visitas.find((v) => v.estado === "agendada")?.fecha ?? "",
    ventasTotal: total,
    ventasN: vs.length,
    ticket: vs.length ? total / vs.length : 0,
    ultimaVenta: vs.at(-1)?.fecha ?? "",
    ventasPorMes: [...mes.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12),
  };
}

/** Encuentra el cliente al que corresponde una fila de ventas (por nombre y, si hay, por dirección). */
export function resolverCliente(cs: Cliente[], nombre: string, direccion = ""): Cliente | null {
  const k = clave(nombre);
  if (!k) return null;
  let c = cs.filter((x) => clave(x.nombre) === k);
  if (!c.length) c = cs.filter((x) => similitud(x.nombre, nombre) >= 0.9);
  if (c.length > 1 && clave(direccion)) c = c.filter((x) => similitud(x.direccion, direccion) >= 0.75);
  return c.length === 1 ? c[0] : null;
}

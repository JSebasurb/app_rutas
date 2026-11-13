import type { Cliente } from "../types.ts";
import { app, buscar } from "../store.ts";
import { fichaCliente } from "../core/ficha.ts";
import { etiquetaArea } from "../core/gold.ts";
import { DIAS_LARGO, hoy, indiceSemana } from "../core/dates.ts";
import { descargar } from "../ui/dom.ts";

const COLS = ["Nombre", "Dirección", "Barrio", "Ciudad", "Zona", "Estado", "Tipo", "Categoría", "Contacto", "Teléfono", "Notas"];
const fila = (c: Cliente) => [c.nombre, c.direccion, c.barrio, c.ciudad, c.zona, c.estado, c.tipo, c.categoria, c.contacto, c.telefono, c.notas];

/** Clientes en CSV (se puede volver a importar tal cual con "Importar datos"). */
export function exportarCsv() {
  const q = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lineas = [COLS.join(","), ...app.clientes.map((c) => fila(c).map(q).join(","))];
  descargar(new Blob(["\ufeff" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" }), `clientes_${hoy()}.csv`);
}

/** Base de datos completa: Clientes, Ventas, Visitas y Resumen por cliente (las dos primeras hojas se pueden reimportar). */
export async function exportarBase() {
  const mod: any = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ruta de visitas";
  const hoja = (nombre: string, columnas: [string, number][]) => {
    const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columnas.map(([header, width]) => ({ header, width }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).eachCell((c: any) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5A46" } }; });
    return ws;
  };
  const filtro = (ws: any, n: number) => { ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: n } }; };

  const wc = hoja("Clientes", COLS.map((h, i) => [h, i === 0 || i === 1 || i === 10 ? 34 : 14]));
  app.clientes.forEach((c) => wc.addRow(fila(c)));
  filtro(wc, COLS.length);

  const wv = hoja("Ventas", [["Cliente", 34], ["Dirección", 30], ["Fecha", 12], ["Monto", 14], ["Nota", 30]]);
  [...app.ventas].sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((v) => {
    const c = buscar(v.clienteId);
    if (c) wv.addRow([c.nombre, c.direccion, v.fecha, v.monto, v.nota]);
  });
  wv.getColumn(4).numFmt = "#,##0";
  filtro(wv, 5);

  const wi = hoja("Visitas", [["Fecha", 12], ["Día", 12], ["Cliente", 34], ["Dirección", 30], ["Área", 18], ["Estado", 22]]);
  const h = hoy();
  for (const k of Object.keys(app.agenda).sort()) {
    const [y, m, d] = k.split("-").map(Number);
    for (const id of app.agenda[k]) {
      const c = buscar(id);
      if (c) wi.addRow([k, DIAS_LARGO[indiceSemana(y, m - 1, d)], c.nombre, c.direccion, etiquetaArea(c), app.hechas[k]?.includes(id) ? "Realizada" : k < h ? "Vencida" : "Agendada"]);
    }
  }
  filtro(wi, 6);

  const wr = hoja("Resumen por cliente", [["Cliente", 34], ["Área", 18], ["Estado", 16], ["Categoría", 12], ["Ventas totales", 16], ["N° ventas", 10], ["Ticket promedio", 16], ["Visitas realizadas", 16], ["Agendadas", 12], ["Vencidas", 10], ["Última visita", 13], ["Próxima visita", 13], ["Última venta", 13]]);
  for (const c of app.clientes) {
    const f = fichaCliente(c.id, app.agenda, app.hechas, app.ventas, h);
    wr.addRow([c.nombre, etiquetaArea(c), c.estado, c.categoria, f.ventasTotal, f.ventasN, Math.round(f.ticket), f.realizadas, f.agendadas, f.vencidas, f.ultimaVisita, f.proximaVisita, f.ultimaVenta]);
  }
  wr.getColumn(5).numFmt = "#,##0";
  wr.getColumn(7).numFmt = "#,##0";
  filtro(wr, 13);

  const buf = await wb.xlsx.writeBuffer();
  descargar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `base_clientes_${h}.xlsx`);
}

import { app, clientesDelDia } from "../store.ts";
import { DIAS_LARGO, MESES, clave, diaSemana, diasEnMes, matrizMes, pad } from "../core/dates.ts";
import { analisisMes, etiquetaArea } from "../core/gold.ts";
import { descargar } from "../ui/dom.ts";

const VERDE = "FF0F5A46", CLARO = "FFE3F1EC", NARANJA = "FFC8532F";
const relleno = (argb: string) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const borde = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

/** Excel .xlsx real con formato: hoja Calendario (+ Detalle, Análisis y Clientes en modo completo). */
export async function exportarXlsx(modo: "completo" | "nombres") {
  const mod: any = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const { year: y, month: m } = app;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ruta de visitas";

  // ---- Calendario
  const ws = wb.addWorksheet("Calendario", { views: [{ showGridLines: false }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = Array.from({ length: 7 }, () => ({ width: 30 }));
  ws.mergeCells(1, 1, 1, 7);
  const t = ws.getCell(1, 1);
  t.value = `Ruta de visitas — ${MESES[m]} ${y}`;
  t.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  t.fill = relleno(VERDE);
  t.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 30;
  DIAS_LARGO.forEach((d, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = d; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = relleno("FF1D6B55");
    c.alignment = { horizontal: "center" }; c.border = borde;
  });
  const celdas = matrizMes(y, m);
  for (let w = 0; w < celdas.length / 7; w++) {
    let lineas = 2;
    celdas.slice(w * 7, w * 7 + 7).forEach((c, col) => {
      const cell = ws.getCell(3 + w, col + 1);
      cell.border = borde;
      cell.alignment = { vertical: "top", wrapText: true };
      if (c.fuera) { cell.fill = relleno("FFEEEEEE"); return; }
      const L = clientesDelDia(c.k);
      const textos = L.map((x) => (modo === "nombres" ? `• ${x.nombre}` : `• ${x.nombre}\n   ${x.direccion}${x.barrio ? ", " + x.barrio : ""} (${etiquetaArea(x)})`));
      lineas = Math.max(lineas, 1 + textos.reduce((a, s) => a + s.split("\n").reduce((b, l) => b + Math.ceil(l.length / 30), 0), 0));
      cell.value = {
        richText: [
          { text: String(c.d), font: { bold: true, size: 12, color: { argb: VERDE } } },
          ...(L.length ? [{ text: `  (${L.length})`, font: { bold: true, size: 10, color: { argb: NARANJA } } }] : []),
          ...(textos.length ? [{ text: "\n" + textos.join("\n"), font: { size: 10 } }] : []),
        ],
      };
      if (L.length) cell.fill = relleno(CLARO);
      else if (col === 6) cell.fill = relleno("FFF3F3F3");
    });
    ws.getRow(3 + w).height = Math.max(70, lineas * 14);
  }

  if (modo === "completo") {
    const cabecera = (hoja: any, fila: number) => {
      const r = hoja.getRow(fila);
      r.font = { bold: true, color: { argb: "FFFFFFFF" } };
      r.eachCell((c: any) => { c.fill = relleno(VERDE); });
    };
    // ---- Detalle
    const wd = wb.addWorksheet("Detalle", { views: [{ state: "frozen", ySplit: 1 }] });
    wd.columns = [
      { header: "Fecha", key: "f", width: 12 }, { header: "Día", key: "d", width: 8 }, { header: "Orden", key: "o", width: 8 },
      { header: "Tienda", key: "t", width: 38 }, { header: "Dirección", key: "dir", width: 30 }, { header: "Barrio", key: "b", width: 20 }, { header: "Área", key: "a", width: 18 },
      { header: "Estado", key: "e", width: 16 }, { header: "Tipo", key: "tp", width: 10 },
    ];
    wd.columns = [...wd.columns, { header: "Hecha", key: "h", width: 8 }];
    cabecera(wd, 1);
    for (let d = 1; d <= diasEnMes(y, m); d++) {
      clientesDelDia(clave(y, m, d)).forEach((c, i) => wd.addRow({ f: `${pad(d)}/${pad(m + 1)}/${y}`, d: diaSemana(y, m, d), o: i + 1, t: c.nombre, dir: c.direccion, b: c.barrio, a: etiquetaArea(c), e: c.estado, tp: c.tipo, h: app.hechas[clave(y, m, d)]?.includes(c.id) ? "Sí" : "No" }));
    }
    wd.autoFilter = { from: "A1", to: "J1" };

    // ---- Análisis
    const wa = wb.addWorksheet("Análisis", { views: [{ state: "frozen", ySplit: 1 }] });
    wa.columns = [
      { header: "Tienda", key: "t", width: 38 }, { header: "Área", key: "a", width: 18 }, { header: "Estado", key: "e", width: 16 },
      { header: "Tipo", key: "tp", width: 10 }, { header: "Veces agendada", key: "n", width: 16 }, { header: "Días", key: "d", width: 40 },
    ];
    wa.columns = [...wa.columns, { header: "Hechas", key: "h", width: 10 }];
    cabecera(wa, 1);
    const r = analisisMes(app.clientes, app.agenda, y, m, app.hechas);
    [...r.filas].sort((a, b) => b.dias.length - a.dias.length || a.cliente.nombre.localeCompare(b.cliente.nombre, "es")).forEach(({ cliente: c, dias, hechas }) =>
      wa.addRow({ t: c.nombre, a: etiquetaArea(c), e: c.estado, tp: c.tipo, n: dias.length, h: hechas, d: dias.length ? dias.map((d) => `${d} (${diaSemana(y, m, d)})`).join(", ") : "Sin agendar" }));
    wa.autoFilter = { from: "A1", to: "G1" };
    wa.addRow([]);
    wa.addRow([`Cobertura: ${r.agendadas} de ${r.total} tiendas (${r.cobertura}%) · ${r.visitas} visitas en el mes`]).font = { bold: true };

    // ---- Clientes
    const wc = wb.addWorksheet("Clientes", { views: [{ state: "frozen", ySplit: 1 }] });
    wc.columns = [
      { header: "Tienda", key: "t", width: 38 }, { header: "Dirección", key: "d", width: 30 }, { header: "Barrio", key: "b", width: 20 }, { header: "Ciudad", key: "c", width: 14 },
      { header: "Zona", key: "z", width: 12 }, { header: "Estado", key: "e", width: 16 }, { header: "Tipo", key: "tp", width: 10 },
    ];
    cabecera(wc, 1);
    app.clientes.forEach((c) => wc.addRow({ t: c.nombre, d: c.direccion, b: c.barrio, c: c.ciudad, z: c.zona, e: c.estado, tp: c.tipo }));
    wc.autoFilter = { from: "A1", to: "G1" };
  }
  const buf = await wb.xlsx.writeBuffer();
  descargar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `ruta_visitas_${y}-${pad(m + 1)}${modo === "nombres" ? "_calendario" : ""}.xlsx`);
}

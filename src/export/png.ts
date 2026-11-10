import { app, clientesDelDia } from "../store.ts";
import { DIAS, MESES, matrizMes, pad } from "../core/dates.ts";
import { descargar } from "../ui/dom.ts";

/** Calendario del mes en imagen PNG: solo los nombres de las tiendas de cada día. */
export function exportarPng() {
  const { year: y, month: m } = app;
  const W = 1400, cw = W / 7, lh = 17, pd = 8, head = 84, dh = 30;
  const F = '13px "Segoe UI",Arial,sans-serif';
  const medir = document.createElement("canvas").getContext("2d")!;
  medir.font = F;
  const envolver = (t: string, ancho: number) => {
    const ls: string[] = [];
    let l = "";
    for (const w of t.split(" ")) {
      const tt = l ? l + " " + w : w;
      if (medir.measureText(tt).width > ancho && l) { ls.push(l); l = w; } else l = tt;
    }
    ls.push(l);
    return ls;
  };
  const celdas = matrizMes(y, m).map((c) => ({ ...c, items: c.fuera ? [] : clientesDelDia(c.k).map((x) => envolver(x.nombre, cw - 2 * pd - 10)) }));
  const semanas = celdas.length / 7;
  const alto: number[] = [];
  for (let w = 0; w < semanas; w++) {
    const mx = Math.max(...celdas.slice(w * 7, w * 7 + 7).map((c) => c.items.reduce((a, b) => a + b.length, 0) + c.items.length * 0.3));
    alto.push(Math.max(90, 30 + mx * lh + pd));
  }
  const H = head + dh + alto.reduce((a, b) => a + b, 0) + 10;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d")!;
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#0f5a46"; x.fillRect(0, 0, W, head);
  x.fillStyle = "#fff"; x.font = 'bold 30px "Segoe UI",Arial,sans-serif'; x.fillText(`Ruta de visitas — ${MESES[m]} ${y}`, 20, 52);
  x.font = '14px "Segoe UI",Arial,sans-serif'; x.fillText("Tiendas programadas por día", 20, 72);
  x.textAlign = "center";
  DIAS.forEach((n, i) => { x.fillStyle = "#1d6b55"; x.fillRect(i * cw, head, cw, dh); x.fillStyle = "#fff"; x.font = 'bold 14px "Segoe UI",Arial,sans-serif'; x.fillText(n, i * cw + cw / 2, head + 20); });
  x.textAlign = "left";
  let yy0 = head + dh;
  for (let w = 0; w < semanas; w++) {
    celdas.slice(w * 7, w * 7 + 7).forEach((c, col) => {
      const X = col * cw;
      x.fillStyle = c.fuera ? "#eef0ee" : col === 6 ? "#f6f6f4" : "#fff"; x.fillRect(X, yy0, cw, alto[w]);
      x.strokeStyle = "#c9d2cd"; x.strokeRect(X, yy0, cw, alto[w]);
      if (c.fuera) return;
      x.fillStyle = "#1d2a26"; x.font = 'bold 15px "Segoe UI",Arial,sans-serif'; x.fillText(String(c.d), X + pd, yy0 + 20);
      if (c.items.length) {
        x.fillStyle = "#c8532f"; x.font = '12px "Segoe UI",Arial,sans-serif'; x.textAlign = "right";
        x.fillText(`${c.items.length} ${c.items.length === 1 ? "visita" : "visitas"}`, X + cw - pd, yy0 + 20); x.textAlign = "left";
      }
      let yy = yy0 + 38;
      for (const ls of c.items) {
        const h = ls.length * lh;
        x.fillStyle = "#e3f1ec"; x.fillRect(X + pd - 2, yy - 13, cw - 2 * pd + 4, h + 3);
        x.fillStyle = "#0f5a46"; x.fillRect(X + pd - 2, yy - 13, 3, h + 3);
        x.fillStyle = "#1d2a26"; x.font = F;
        ls.forEach((l, i) => x.fillText(l, X + pd + 6, yy + i * lh));
        yy += h + 5;
      }
    });
    yy0 += alto[w];
  }
  cv.toBlob((b) => b && descargar(b, `ruta_visitas_${y}-${pad(m + 1)}.png`), "image/png");
}

import "./styles.css";
import { app, importarRespaldo, iniciar, respaldo, sincronizarSilver, suscribir, cambiarMes } from "./store.ts";
import { $, descargar } from "./ui/dom.ts";
import { bindPlanner, renderCal, renderFiltros, renderPool, renderRoute } from "./ui/planner.ts";
import { bindEditor } from "./ui/editor.ts";
import { bindImportar } from "./ui/importar.ts";
import { bindFicha, fijarFicha, renderFicha } from "./ui/ficha.ts";
import { exportarBase, exportarCsv } from "./export/base.ts";
import { abrirAuto, bindAuto } from "./ui/auto.ts";
import { bindAnalisis, renderAnalisis } from "./ui/analysis.ts";
import { exportarPng } from "./export/png.ts";
import { exportarXlsx } from "./export/xlsx.ts";
import { pad } from "./core/dates.ts";

function mostrar(n: 1 | 2 | 3) {
  ([1, 2, 3] as const).forEach((i) => {
    $("v" + i).hidden = n !== i;
    $("t" + i).classList.toggle("on", n === i);
  });
}

function pintar() {
  renderFiltros();
  renderCal();
  renderRoute();
  renderPool();
  renderAnalisis();
  renderFicha();
}

async function conCarga(btn: HTMLElement, f: () => Promise<void> | void) {
  const t = btn.textContent;
  btn.setAttribute("disabled", "");
  btn.textContent = "Generando…";
  try { await f(); } catch (e) { alert("No se pudo exportar: " + (e as Error).message); }
  btn.textContent = t;
  btn.removeAttribute("disabled");
}

bindPlanner();
bindEditor();
bindImportar();
bindAuto();
bindFicha(() => mostrar(1));
document.addEventListener("ver-ficha", (e) => { fijarFicha((e as CustomEvent<string>).detail); mostrar(3); renderFicha(); });
$("t3").onclick = () => mostrar(3);
$("xdb").onclick = (e) => conCarga(e.currentTarget as HTMLElement, exportarBase);
$("xcsv").onclick = exportarCsv;
$("auto").onclick = abrirAuto;
bindAnalisis(() => mostrar(1));
$("t1").onclick = () => mostrar(1);
$("t2").onclick = () => mostrar(2);
$("p2").onclick = () => cambiarMes(-1);
$("n2").onclick = () => cambiarMes(1);

$("png").onclick = exportarPng;
$("xlsx").onclick = (e) => conCarga(e.currentTarget as HTMLElement, () => exportarXlsx("completo"));
$("xlsxN").onclick = (e) => conCarga(e.currentTarget as HTMLElement, () => exportarXlsx("nombres"));

$("bk").onclick = () => descargar(new Blob([JSON.stringify(respaldo(), null, 2)], { type: "application/json" }), `respaldo_ruta_visitas_${app.year}-${pad(app.month + 1)}.json`);
$("imp").onclick = () => $<HTMLInputElement>("impf").click();
$<HTMLInputElement>("impf").onchange = async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  const err = importarRespaldo(await f.text());
  alert(err ?? "Respaldo restaurado.");
  (e.target as HTMLInputElement).value = "";
};
$("sync").onclick = async () => alert(`${await sincronizarSilver()} tiendas nuevas desde la capa plata.`);

suscribir(pintar);
iniciar();

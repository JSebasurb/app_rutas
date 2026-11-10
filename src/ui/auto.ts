import { ESTADOS } from "../types.ts";
import { app, aplicarAgenda, deshacerAuto } from "../store.ts";
import { autoplanificar } from "../core/planner.ts";
import { DIAS, MESES, hoy, prefijoMes } from "../core/dates.ts";
import { $, llenar } from "./dom.ts";

const dlg = () => $<HTMLDialogElement>("dauto");

function calcular() {
  const dias = [...document.querySelectorAll<HTMLInputElement>("#autoDias input")].filter((i) => i.checked).map((i) => Number(i.value));
  const h = hoy();
  return autoplanificar(app.clientes, app.agenda, app.year, app.month, {
    porDia: Number($<HTMLInputElement>("autoPorDia").value) || 1,
    diasSemana: dias,
    soloSinAgendar: $<HTMLInputElement>("autoSolo").checked,
    estado: $<HTMLSelectElement>("autoEstado").value,
    desde: h.startsWith(prefijoMes(app.year, app.month)) ? h : "", // en el mes actual no agenda días pasados
  });
}

function vista() {
  const r = calcular();
  $("autoVista").innerHTML = `Se agendarán <b>${r.asignadas}</b> tiendas en <b>${r.diasUsados}</b> días.` + (r.sinCupo ? ` <b>${r.sinCupo}</b> quedarían sin cupo (sube las visitas por día o suma días de trabajo).` : "");
  $<HTMLButtonElement>("autoOk").disabled = r.asignadas === 0;
}

export function abrirAuto() {
  $("autoTitulo").textContent = `Autoplanificar ${MESES[app.month]} ${app.year}`;
  llenar($<HTMLSelectElement>("autoEstado"), "Todos los estados", ESTADOS);
  vista();
  dlg().showModal();
}

export function bindAuto() {
  $("autoDias").innerHTML = DIAS.map((d, i) => `<label class="dd"><input type="checkbox" value="${i}" ${i < 6 ? "checked" : ""}> ${d}</label>`).join("");
  for (const id of ["autoPorDia", "autoEstado", "autoSolo", "autoDias"]) $(id).addEventListener("input", vista);
  $("autoCan").onclick = () => dlg().close();
  $("autoOk").onclick = () => { aplicarAgenda(calcular().agenda); dlg().close(); };
  $("undo").onclick = () => alert(deshacerAuto() ? "Autoplanificación deshecha." : "No hay nada que deshacer.");
}

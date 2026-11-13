import { app, agregarVenta, buscar, eliminarVenta, irAFecha } from "../store.ts";
import { DIAS, MESES, hoy, indiceSemana } from "../core/dates.ts";
import { etiquetaArea } from "../core/gold.ts";
import { fichaCliente, formatoMonto } from "../core/ficha.ts";
import { $, claseEstado, esc } from "./dom.ts";
import { abrirEditor } from "./editor.ts";

let fichaId = "";
export const fijarFicha = (id: string) => { fichaId = id; };
const val = (id: string) => $<HTMLInputElement>(id).value;

const fecha = (k: string) => {
  if (!k) return "—";
  const [y, m, d] = k.split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)} ${y} · ${DIAS[indiceSemana(y, m - 1, d)]}`;
};
const mesTxt = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${MESES[m - 1].slice(0, 3)} ${y}`; };
const ESTADO_TXT = { hecha: "Realizada ✓", vencida: "Vencida (sin realizar)", agendada: "Agendada" } as const;

export function renderFicha() {
  const lista = [...app.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.direccion.localeCompare(b.direccion, "es"));
  if (!buscar(fichaId)) fichaId = lista[0]?.id ?? "";
  const q = val("fcQ").toLowerCase();
  const vis = lista.filter((c) => c.id === fichaId || `${c.nombre} ${c.direccion} ${c.barrio}`.toLowerCase().includes(q));
  const sel = $<HTMLSelectElement>("fcSel");
  sel.innerHTML = vis.map((c) => `<option value="${c.id}">${esc(c.nombre)} — ${esc(c.direccion)}</option>`).join("");
  sel.value = fichaId;
  const c = buscar(fichaId);
  if (!c) { $("fcBody").innerHTML = '<div class="empty">Aún no hay clientes.</div>'; return; }

  const f = fichaCliente(c.id, app.agenda, app.hechas, app.ventas, hoy());
  const card = (v: string | number, l: string, chico = false) => `<div class="card"><b${chico ? ' class="chico"' : ""}>${v}</b><span>${l}</span></div>`;
  const mx = Math.max(1, ...f.ventasPorMes.map((m) => m[1]));
  $("fcBody").innerHTML = `
  <div class="box">
    <div class="fh"><div>
      <h2 style="margin:0">${esc(c.nombre)}</h2>
      <div class="v0">${esc(c.direccion)}${c.barrio ? " · " + esc(c.barrio) : ""}</div>
      <div style="margin-top:6px"><span class="tag">${esc(etiquetaArea(c))}</span><span class="tag ${claseEstado(c.estado)}">${esc(c.estado)}</span>${c.tipo ? `<span class="tag tp">${esc(c.tipo)}</span>` : ""}${c.categoria ? `<span class="tag cat">★ ${esc(c.categoria)}</span>` : ""}</div>
      ${c.contacto || c.telefono ? `<div class="v0" style="margin-top:6px">${esc(c.contacto)}${c.contacto && c.telefono ? " · " : ""}${c.telefono ? `<a class="lnk" href="tel:${esc(c.telefono)}">${esc(c.telefono)}</a>` : ""}</div>` : ""}
      ${c.notas ? `<div class="v0" style="margin-top:6px">📝 ${esc(c.notas)}</div>` : ""}
    </div><button data-fc="editar">Editar cliente</button></div>
  </div>
  <div class="box"><div class="cards">
    ${card(formatoMonto(f.ventasTotal), "Ventas totales")}${card(f.ventasN, "Ventas registradas")}${card(formatoMonto(f.ticket), "Ticket promedio")}
    ${card(f.realizadas, "Visitas realizadas")}${card(f.agendadas, "Visitas agendadas")}${card(f.vencidas, "Vencidas sin realizar")}${card(f.cumplimiento + "%", "Cumplimiento")}
    ${card(fecha(f.ultimaVisita), "Última visita", true)}${card(fecha(f.proximaVisita), "Próxima visita", true)}${card(fecha(f.ultimaVenta), "Última venta", true)}
  </div></div>
  <div class="brk">
    <div class="box"><h3>Historial de visitas (${f.visitas.length})</h3>
      <div class="scroll"><table class="tb">${f.visitas.length ? [...f.visitas].reverse().map((v) => `<tr><td>${fecha(v.fecha)}</td><td><span class="st ${v.estado}">${ESTADO_TXT[v.estado]}</span></td><td><a class="lnk" data-fc="dia" data-k="${v.fecha}">Ver día</a></td></tr>`).join("") : '<tr><td class="empty">Este cliente no tiene visitas agendadas.</td></tr>'}</table></div>
    </div>
    <div class="box"><h3>Ventas</h3>
      <div class="row"><input id="vf" type="date" value="${hoy()}"><input id="vm" type="number" min="0" step="any" placeholder="Monto"><input id="vn" placeholder="Nota (factura, producto…)"></div>
      <button class="p" data-fc="venta">Registrar venta</button>
      ${f.ventasPorMes.length ? `<h3 style="margin-top:14px">Ventas por mes</h3>${f.ventasPorMes.map(([m, t]) => `<div class="bar"><div>${mesTxt(m)}</div><div class="bt"><i style="width:${(t * 100) / mx}%"><u style="width:100%"></u></i></div><div class="bn">${formatoMonto(t)}</div></div>`).join("")}` : '<div class="empty">Aún no hay ventas registradas.</div>'}
      <div class="pool" style="max-height:260px">${[...f.ventas].reverse().slice(0, 40).map((v) => `<div class="item"><div class="t"><b>${formatoMonto(v.monto)}</b><span>${fecha(v.fecha)}${v.nota ? " · " + esc(v.nota) : ""}</span></div><button class="sm" data-fc="delv" data-id="${v.id}">Eliminar</button></div>`).join("")}</div>
    </div>
  </div>`;
}

export function bindFicha(irPlanificador: () => void) {
  $("fcSel").onchange = () => { fichaId = $<HTMLSelectElement>("fcSel").value; renderFicha(); };
  $("fcQ").addEventListener("input", renderFicha);
  $("fcBody").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-fc]");
    if (!b) return;
    if (b.dataset.fc === "editar") abrirEditor(fichaId);
    else if (b.dataset.fc === "dia") { irAFecha(b.dataset.k!); irPlanificador(); }
    else if (b.dataset.fc === "venta") { const err = agregarVenta(fichaId, val("vf"), Number(val("vm")), val("vn")); if (err) alert(err); }
    else if (b.dataset.fc === "delv" && confirm("¿Eliminar esta venta?")) eliminarVenta(b.dataset.id!);
  });
}

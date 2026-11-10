import { ESTADOS } from "../types.ts";
import { app, seleccionar } from "../store.ts";
import { DIAS, MESES, clave, diaSemana } from "../core/dates.ts";
import { agrupar, analisisMes, etiquetaArea } from "../core/gold.ts";
import type { Grupo } from "../core/gold.ts";
import { $, claseEstado, esc, llenar } from "./dom.ts";

const val = (id: string) => $<HTMLInputElement>(id).value;

function barras(titulo: string, grupos: Grupo[]) {
  const mx = Math.max(1, ...grupos.map((g) => g.total));
  return `<div class="box"><h3>${titulo}</h3>${grupos.map((g) => `<div class="bar"><div>${esc(g.clave)}</div>
    <div class="bt"><i style="width:${(g.total * 100) / mx}%"><u style="width:${g.total ? (g.agendadas * 100) / g.total : 0}%"></u></i></div>
    <div class="bn">${g.agendadas}/${g.total} agendadas · ${g.visitas} vis.</div></div>`).join("")}<div class="bn">Barra oscura = tiendas agendadas del total</div></div>`;
}

export function renderAnalisis() {
  const { year: y, month: m } = app;
  $("mes2").textContent = `${MESES[m]} ${y}`;
  const r = analisisMes(app.clientes, app.agenda, y, m, app.hechas);
  const card = (v: string | number, l: string) => `<div class="card"><b>${v}</b><span>${l}</span></div>`;
  $("cards").innerHTML = card(r.total, "Tiendas") + card(r.agendadas, "Agendadas este mes") + card(r.sinAgendar, "Sin agendar") + card(r.visitas, "Visitas del mes") + card(r.cobertura + "%", "Cobertura") + card(r.cumplimiento + "%", `Cumplimiento (${r.realizadas}/${r.visitas} hechas)`);

  const maxS = Math.max(1, ...r.porSemana);
  const semana = `<div class="box"><h3>Visitas por día de la semana</h3><div class="wk">${r.porSemana.map((n, i) => `<div><div class="wb" style="height:${(n * 70) / maxS + 2}px"></div><b>${n}</b><span>${DIAS[i]}</span></div>`).join("")}</div></div>`;
  $("brk").innerHTML = barras("Por área", agrupar(r.filas, etiquetaArea)) + barras("Por estado del cliente", agrupar(r.filas, (c) => c.estado, ESTADOS)) + barras("Por tipo de cliente", agrupar(r.filas, (c) => c.tipo || "Sin tipo")) + semana;

  llenar($<HTMLSelectElement>("aa"), "Todas las áreas", [...new Set(app.clientes.map(etiquetaArea))].sort((a, b) => a.localeCompare(b, "es")));
  llenar($<HTMLSelectElement>("ae"), "Todos los estados", ESTADOS);
  const sh = val("ash"), fa = val("aa"), fe = val("ae"), so = val("as");
  const cmp = (a: string, b: string) => a.localeCompare(b, "es");
  const R = r.filas.filter((f) => (!fa || etiquetaArea(f.cliente) === fa) && (!fe || f.cliente.estado === fe) && (sh === "all" || (sh === "yes" ? f.dias.length > 0 : sh === "no" ? !f.dias.length : f.dias.length > 1)));
  R.sort((a, b) => so === "nombre" ? cmp(a.cliente.nombre, b.cliente.nombre) : so === "area" ? cmp(etiquetaArea(a.cliente), etiquetaArea(b.cliente)) || cmp(a.cliente.nombre, b.cliente.nombre) : b.dias.length - a.dias.length || cmp(a.cliente.nombre, b.cliente.nombre));
  $("tb").innerHTML = "<tr><th>Tienda</th><th>Área</th><th>Estado</th><th>Tipo</th><th>Veces</th><th>Hechas</th><th>Días agendados</th></tr>" +
    (R.map(({ cliente: c, dias, hechas }) => `<tr><td><b>${esc(c.nombre)}</b><br><span class="v0">${esc(c.direccion)}${c.barrio ? " · " + esc(c.barrio) : ""}</span></td><td>${esc(etiquetaArea(c))}</td><td><span class="tag ${claseEstado(c.estado)}">${esc(c.estado)}</span></td><td>${esc(c.tipo)}</td><td><b>${dias.length}</b></td><td>${hechas}</td>
      <td>${dias.length ? dias.map((d) => `<a class="dchip" data-k="${clave(y, m, d)}">${d} ${diaSemana(y, m, d)}</a>`).join("") : '<span class="v0">Sin agendar</span>'}</td></tr>`).join("") || '<tr><td colspan="7" class="empty">Sin resultados.</td></tr>');
}

export function bindAnalisis(irAPlanificador: () => void) {
  for (const id of ["ash", "aa", "ae", "as"]) $(id).addEventListener("change", renderAnalisis);
  $("tb").addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>(".dchip");
    if (a) { seleccionar(a.dataset.k!); irAPlanificador(); }
  });
}

import { ESTADOS } from "../types.ts";
import { app, agendar, agregarCliente, alternarHecha, clientesDelDia, cambiarMes, irHoy, mover, ordenarPorZona, quitar, seleccionar } from "../store.ts";
import { DIAS, DIAS_LARGO, MESES, hoy, matrizMes } from "../core/dates.ts";
import { etiquetaArea, filasMes } from "../core/gold.ts";
import type { FilaMes } from "../core/gold.ts";
import { $, claseEstado, esc, llenar } from "./dom.ts";
import { enlacesMaps, textoRuta } from "../core/rutas.ts";
import { abrirEditor } from "./editor.ts";
import { abrirImportar } from "./importar.ts";

const val = (id: string) => $<HTMLInputElement>(id).value;
const unicos = (f: (c: FilaMes["cliente"]) => string) => [...new Set(app.clientes.map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

export function renderCal() {
  $("mes").textContent = `${MESES[app.month]} ${app.year}`;
  const hoyK = hoy();
  let h = DIAS.map((d) => `<div class="dh">${d}</div>`).join("");
  for (const c of matrizMes(app.year, app.month)) {
    const L = clientesDelDia(c.k);
    const hs = app.hechas[c.k] ?? [];
    const nh = L.filter((x) => hs.includes(x.id)).length;
    h += `<div class="day${c.fuera ? " out" : ""}${c.k === app.sel ? " sel" : ""}${c.k === hoyK ? " today" : ""}${c.col === 6 ? " sun" : ""}" data-k="${c.k}">
      <span class="n">${c.d}</span><span class="cnt">${L.length ? (nh ? `${nh}/${L.length} ✓` : L.length + " visitas") : ""}</span>
      ${L.slice(0, 3).map((x) => `<span class="chip${hs.includes(x.id) ? " ok" : ""}" title="${esc(x.nombre)}">${hs.includes(x.id) ? "✓ " : ""}${esc(x.nombre)}</span>`).join("")}
      ${L.length > 3 ? `<span class="more">+${L.length - 3} más</span>` : ""}</div>`;
  }
  $("cal").innerHTML = h;
}

export function renderRoute() {
  const k = app.sel;
  if (!k) {
    $("dtitle").textContent = "Selecciona un día";
    $("route").innerHTML = '<div class="empty">Toca un día del calendario y agrega tiendas desde la lista o arrástralas al día.</div>';
    return;
  }
  const [y, m, d] = k.split("-").map(Number);
  const L = clientesDelDia(k);
  const hs = app.hechas[k] ?? [];
  const nh = L.filter((c) => hs.includes(c.id)).length;
  $("dtitle").textContent = `${DIAS_LARGO[(new Date(y, m - 1, d).getDay() + 6) % 7]} ${d} de ${MESES[m - 1]} · ${L.length} visitas${L.length ? ` · ${nh} hechas` : ""}`;
  $("route").innerHTML = L.length
    ? `<div class="item-tools"><button class="sm" data-act="zona">Agrupar por zona</button> ${enlacesMaps(L).map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.etiqueta)}</a>`).join(" ")} <button class="sm" data-act="copiar">Copiar ruta</button></div>` +
      L.map((c, i) => `<div class="item${hs.includes(c.id) ? " hecha" : ""}"><input type="checkbox" data-act="ok" data-id="${c.id}" ${hs.includes(c.id) ? "checked" : ""} title="Marcar como visitada">
        <div class="t"><b>${i + 1}. ${esc(c.nombre)}</b><span>${esc(c.direccion)}${c.barrio ? ` · ${esc(c.barrio)}` : ""}</span><br><span class="tag">${esc(etiquetaArea(c))}</span>${c.tipo ? `<span class="tag tp">${esc(c.tipo)}</span>` : ""}</div>
        <div class="acts"><button class="sm" data-act="up" data-i="${i}" ${i === 0 ? "disabled" : ""}>↑</button><button class="sm" data-act="dn" data-i="${i}" ${i === L.length - 1 ? "disabled" : ""}>↓</button><button class="sm" data-act="rm" data-i="${i}">Quitar</button></div></div>`).join("")
    : '<div class="empty">Sin visitas este día. Agrega tiendas desde la lista.</div>';
}

export function renderFiltros() {
  llenar($<HTMLSelectElement>("fArea"), "Todas las áreas", unicos(etiquetaArea));
  llenar($<HTMLSelectElement>("fEstado"), "Todos los estados", ESTADOS);
  llenar($<HTMLSelectElement>("fTipo"), "Todos los tipos", unicos((c) => c.tipo));
  for (const [id, f] of [["dlCiudad", (c: FilaMes["cliente"]) => c.ciudad], ["dlZona", (c: FilaMes["cliente"]) => c.zona], ["dlTipo", (c: FilaMes["cliente"]) => c.tipo]] as const) {
    $(id).innerHTML = unicos(f).map((x) => `<option value="${esc(x)}">`).join("");
  }
}

export function renderPool() {
  const q = val("q").toLowerCase(), fa = val("fArea"), fe = val("fEstado"), ft = val("fTipo"), so = val("so");
  const cmp = (a: string, b: string) => a.localeCompare(b, "es");
  const filas = filasMes(app.clientes, app.agenda, app.year, app.month).filter(({ cliente: c }) =>
    (!fa || etiquetaArea(c) === fa) && (!fe || c.estado === fe) && (!ft || c.tipo === ft) &&
    [c.nombre, c.direccion, c.barrio, etiquetaArea(c), c.tipo, c.estado].join(" ").toLowerCase().includes(q));
  const nombre = (a: FilaMes, b: FilaMes) => cmp(a.cliente.nombre, b.cliente.nombre);
  filas.sort((a, b) => {
    const x = a.cliente, y = b.cliente;
    if (so === "nombre") return nombre(a, b);
    if (so === "estado") return ESTADOS.indexOf(x.estado) - ESTADOS.indexOf(y.estado) || nombre(a, b);
    if (so === "tipo") return cmp(x.tipo || "~", y.tipo || "~") || nombre(a, b);
    if (so === "visitas") return b.dias.length - a.dias.length || nombre(a, b);
    return cmp(etiquetaArea(x), etiquetaArea(y)) || nombre(a, b);
  });
  $("cn").textContent = String(app.clientes.length) + (filas.length !== app.clientes.length ? ` · ${filas.length} filtradas` : "");
  const grupo = (c: FilaMes["cliente"]) => so === "area" ? etiquetaArea(c) : so === "estado" ? c.estado : so === "tipo" ? c.tipo || "Sin tipo" : null;
  let g: string | null = null, h = "";
  for (const { cliente: c, dias } of filas) {
    const k = grupo(c);
    if (k !== null && k !== g) {
      g = k;
      h += `<div class="grp">${esc(k)} <span>(${filas.filter((x) => grupo(x.cliente) === k).length})</span></div>`;
    }
    h += `<div class="item" draggable="true" data-id="${c.id}"><div class="t"><b>${esc(c.nombre)}</b><span>${esc(c.direccion)}${c.barrio ? ` · ${esc(c.barrio)}` : ""}</span><br>
      <span class="tag">${esc(etiquetaArea(c))}</span><span class="tag ${claseEstado(c.estado)}">${esc(c.estado)}</span>${c.tipo ? `<span class="tag tp">${esc(c.tipo)}</span>` : ""}${dias.length ? `<span class="tag d">Día ${dias.join(", ")}</span>` : ""}</div>
      <div class="acts"><button class="sm" data-act="add" data-id="${c.id}" ${app.sel ? "" : "disabled"}>+ Día</button><button class="sm" data-act="edit" data-id="${c.id}">Editar</button></div></div>`;
  }
  $("pool").innerHTML = h || '<div class="empty">No hay tiendas con esos filtros.</div>';
}

export function bindPlanner() {
  $("prev").onclick = () => cambiarMes(-1);
  $("next").onclick = () => cambiarMes(1);
  $("hoy").onclick = irHoy;

  $("cal").addEventListener("click", (e) => {
    const d = (e.target as HTMLElement).closest<HTMLElement>(".day");
    if (d) seleccionar(d.dataset.k!);
  });
  $("cal").addEventListener("dragover", (e) => { if ((e.target as HTMLElement).closest(".day")) e.preventDefault(); });
  $("cal").addEventListener("drop", (e) => {
    const d = (e.target as HTMLElement).closest<HTMLElement>(".day");
    const id = e.dataTransfer?.getData("text/plain");
    if (d && id) { e.preventDefault(); app.sel = d.dataset.k!; agendar(d.dataset.k!, id); }
  });

  $("route").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!b || !app.sel) return;
    const i = Number(b.dataset.i);
    switch (b.dataset.act) {
      case "rm": quitar(app.sel, i); break;
      case "up": mover(app.sel, i, -1); break;
      case "dn": mover(app.sel, i, 1); break;
      case "zona": ordenarPorZona(app.sel); break;
      case "ok": alternarHecha(app.sel, b.dataset.id!); break;
      case "copiar": {
        const t = textoRuta($("dtitle").textContent ?? "", clientesDelDia(app.sel));
        navigator.clipboard?.writeText(t).then(() => alert("Ruta copiada. Pégala en WhatsApp o donde quieras."), () => prompt("Copia la ruta:", t));
        break;
      }
    }
  });

  $("pool").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
    if (!b) return;
    if (b.dataset.act === "edit") abrirEditor(b.dataset.id!);
    else if (app.sel) agendar(app.sel, b.dataset.id!);
  });
  $("pool").addEventListener("dragstart", (e) => {
    const it = (e.target as HTMLElement).closest<HTMLElement>(".item");
    if (it) e.dataTransfer?.setData("text/plain", it.dataset.id!);
  });

  $("q").addEventListener("input", renderPool);
  for (const id of ["fArea", "fEstado", "fTipo", "so"]) $(id).addEventListener("change", renderPool);

  $("add").onclick = () => {
    const err = agregarCliente({ nombre: val("fn"), direccion: val("fa"), barrio: val("fb"), ciudad: val("fc"), zona: val("fz"), estado: val("fe"), tipo: val("ft") });
    if (err) return alert(err);
    for (const id of ["fn", "fa", "fb"]) $<HTMLInputElement>(id).value = "";
    $("fn").focus();
  };
  $("abrirImp").onclick = abrirImportar;
  llenar($<HTMLSelectElement>("fe"), null, ESTADOS);
}

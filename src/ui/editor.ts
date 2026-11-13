import { ESTADOS } from "../types.ts";
import { buscar, editarCliente, eliminarCliente } from "../store.ts";
import { $, llenar } from "./dom.ts";

const dlg = () => $<HTMLDialogElement>("dlg");
const val = (id: string) => $<HTMLInputElement>(id).value;
let editId = "";

export function abrirEditor(id: string) {
  const c = buscar(id);
  if (!c) return;
  editId = id;
  $<HTMLInputElement>("en").value = c.nombre;
  $<HTMLInputElement>("ea").value = c.direccion;
  $<HTMLInputElement>("eb").value = c.barrio;
  $<HTMLInputElement>("ec").value = c.ciudad;
  $<HTMLInputElement>("ez").value = c.zona;
  $<HTMLInputElement>("et").value = c.tipo;
  $<HTMLInputElement>("ek").value = c.categoria;
  $<HTMLInputElement>("eco").value = c.contacto;
  $<HTMLInputElement>("etel").value = c.telefono;
  $<HTMLInputElement>("eno").value = c.notas;
  llenar($<HTMLSelectElement>("ee"), null, ESTADOS);
  $<HTMLSelectElement>("ee").value = c.estado;
  dlg().showModal();
}

export function bindEditor() {
  $("ecan").onclick = () => dlg().close();
  $("esave").onclick = () => {
    const err = editarCliente(editId, { nombre: val("en"), direccion: val("ea"), barrio: val("eb"), ciudad: val("ec"), zona: val("ez"), estado: val("ee"), tipo: val("et"), categoria: val("ek"), contacto: val("eco"), telefono: val("etel"), notas: val("eno") });
    if (err) alert(err);
    else dlg().close();
  };
  $("edel").onclick = () => {
    const c = buscar(editId);
    if (c && confirm(`¿Eliminar "${c.nombre}" de la base y de todas las rutas?`)) {
      eliminarCliente(editId);
      dlg().close();
    }
  };
}

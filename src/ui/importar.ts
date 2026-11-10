import { ESTADOS } from "../types.ts";
import type { Cliente, DatosCliente } from "../types.ts";
import { app, buscar, importarDatos } from "../store.ts";
import { crearCliente } from "../core/silver.ts";
import { etiquetaArea } from "../core/gold.ts";
import { PLANTILLA, leerTabla, mapearFilas } from "../core/importar.ts";
import { aTabla, extraerDeTexto } from "../core/ocr.ts";
import { aplicarCorrecciones, aprender, corregirConConocidos, revisar, sinCorrecciones } from "../core/aprender.ts";
import type { Correcciones } from "../core/aprender.ts";
import { leerImagenes } from "../ocr/leer.ts";
import { $, descargar, esc, llenar } from "./dom.ts";

const dlg = () => $<HTMLDialogElement>("dimp");
const val = (id: string) => $<HTMLInputElement>(id).value;
let filas: string[][] = [];
let listos: DatosCliente[] = [];
let ocrOriginal: DatosCliente[] = []; // lo que leyó el OCR, para aprender de tus correcciones

const MEM = "ruta-visitas:correcciones";
function leerMemoria(): Correcciones {
  try { return { ...sinCorrecciones(), ...JSON.parse(localStorage.getItem(MEM) ?? "") }; } catch { return sinCorrecciones(); }
}
function guardarMemoria(c: Correcciones) {
  try { localStorage.setItem(MEM, JSON.stringify(c)); } catch { /* sin almacenamiento */ }
}

async function leerXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const mod: any = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const out: string[][] = [];
  wb.worksheets[0]?.eachRow({ includeEmpty: false }, (row: any) => {
    const v: string[] = [];
    for (let i = 1; i <= row.cellCount; i++) v.push(String(row.getCell(i).text ?? "").trim());
    out.push(v);
  });
  return out;
}

function vista() {
  const { datos, encabezado } = mapearFilas(filas);
  const vistos = new Set<string>();
  const muestra: Cliente[] = [];
  let dup = 0, inv = 0, rev = 0;
  listos = [];
  for (const d of datos) {
    const x = { ...d, ciudad: d.ciudad || val("impCiudad"), estado: d.estado || val("impEstado"), tipo: d.tipo || val("impTipo") };
    const c = crearCliente(x);
    if (!c) { inv++; continue; }
    if (buscar(c.id) || vistos.has(c.id)) { dup++; continue; }
    vistos.add(c.id);
    listos.push(x);
    if (revisar(c).length) rev++;
    if (muestra.length < 12) muestra.push(c);
  }
  $("impVista").innerHTML = filas.length
    ? `<p class="hint"><b>${listos.length}</b> nuevas · ${dup} repetidas o ya existentes · ${inv} sin nombre o dirección${rev ? ` · <b>${rev}</b> para revisar ⚠` : ""}.
       ${encabezado ? "Encabezados detectados." : "Sin encabezado: se usa el orden nombre, dirección, barrio, área."}</p>` +
      (muestra.length ? `<div class="scroll"><table class="tb"><tr><th></th><th>Tienda</th><th>Dirección</th><th>Barrio</th><th>Área</th></tr>${muestra.map((c) => { const r = revisar(c); return `<tr><td title="${esc(r.join(", "))}">${r.length ? "⚠" : ""}</td><td>${esc(c.nombre)}</td><td>${esc(c.direccion)}</td><td>${esc(c.barrio)}</td><td>${esc(etiquetaArea(c))}</td></tr>`; }).join("")}</table></div>${listos.length > 12 ? `<p class="hint">…y ${listos.length - 12} más</p>` : ""}` : "")
    : "";
  const ok = $<HTMLButtonElement>("impOk");
  ok.disabled = !listos.length;
  ok.textContent = listos.length ? `Importar ${listos.length} tiendas` : "Importar";
}

/** Imagen → OCR → texto editable (tabla con tabulaciones) → misma vista previa que cualquier otra fuente. */
async function desdeImagenes(imgs: File[]) {
  const est = $("impOcr");
  $<HTMLButtonElement>("impOk").disabled = true;
  try {
    const textos = await leerImagenes(imgs, (m) => { est.textContent = m; });
    const ciudades = [...new Set(app.clientes.map((c) => c.ciudad).filter(Boolean))];
    const base = textos.flatMap((t) => extraerDeTexto(t, ciudades));
    ocrOriginal = base;
    const { datos, reconocidas } = corregirConConocidos(aplicarCorrecciones(base, leerMemoria()), app.clientes);
    $<HTMLTextAreaElement>("impTexto").value = aTabla(datos);
    filas = leerTabla(val("impTexto"));
    est.textContent = datos.length
      ? `Se detectaron ${datos.length} tiendas en ${imgs.length} imagen(es). ${reconocidas ? `${reconocidas} ya coinciden con tiendas que tienes. ` : ""}Revisa el texto (marcado con ⚠ lo dudoso): el OCR puede equivocarse y puedes corregirlo aquí mismo; la app recuerda tus correcciones.`
      : "No se detectaron tiendas. Prueba con una captura más nítida o escribe los datos a mano.";
  } catch (err) {
    est.textContent = `No se pudo leer la imagen: ${(err as Error).message}. La primera vez se necesita internet para descargar el idioma de lectura.`;
    filas = [];
  }
  vista();
}

export function abrirImportar() {
  filas = [];
  ocrOriginal = [];
  $<HTMLTextAreaElement>("impTexto").value = "";
  $<HTMLInputElement>("impArchivo").value = "";
  $("impOcr").textContent = "";
  llenar($<HTMLSelectElement>("impEstado"), null, ESTADOS);
  vista();
  dlg().showModal();
}

export function bindImportar() {
  $("impCan").onclick = () => dlg().close();
  $("plantilla").onclick = () => descargar(new Blob(["\uFEFF" + PLANTILLA], { type: "text/csv;charset=utf-8" }), "plantilla_tiendas.csv");
  const manejar = async (archivos: File[]) => {
    const imgs = archivos.filter((f) => f.type.startsWith("image/"));
    if (imgs.length) return desdeImagenes(imgs);
    const f = archivos[0];
    if (!f) return;
    try {
      filas = /\.xlsx$/i.test(f.name) ? await leerXlsx(await f.arrayBuffer()) : leerTabla(await f.text());
      $<HTMLTextAreaElement>("impTexto").value = "";
    } catch (err) {
      alert("No se pudo leer el archivo: " + (err as Error).message);
      filas = [];
    }
    vista();
  };
  $<HTMLInputElement>("impArchivo").onchange = (e) => void manejar([...((e.target as HTMLInputElement).files ?? [])]);
  dlg().addEventListener("paste", (e) => {
    const imgs = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (imgs.length) { e.preventDefault(); void desdeImagenes(imgs); }
  });
  dlg().addEventListener("dragover", (e) => e.preventDefault());
  dlg().addEventListener("drop", (e) => {
    const fs = [...(e.dataTransfer?.files ?? [])];
    if (fs.length) { e.preventDefault(); void manejar(fs); }
  });
  $("impTexto").addEventListener("input", () => { filas = leerTabla(val("impTexto")); vista(); });
  for (const id of ["impCiudad", "impEstado", "impTipo"]) $(id).addEventListener("input", vista);
  $("impOk").onclick = () => {
    if (ocrOriginal.length) {
      guardarMemoria(aprender(ocrOriginal, mapearFilas(filas).datos, leerMemoria()));
      ocrOriginal = [];
    }
    const r = importarDatos(listos);
    alert(`${r.nuevos} tiendas importadas. ${r.duplicados} repetidas omitidas, ${r.invalidos} inválidas.`);
    dlg().close();
  };
}

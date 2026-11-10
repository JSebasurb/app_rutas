import { test } from "node:test";
import assert from "node:assert/strict";
import { construirSilver, normalizarDireccion, parseUbicacion, crearCliente } from "../src/core/silver.ts";
import { analisisMes, resumenCartera } from "../src/core/gold.ts";
import { parseCsv } from "../pipeline/csv.ts";
import { leerTabla, mapearFilas } from "../src/core/importar.ts";
import { autoplanificar } from "../src/core/planner.ts";
import { enlacesMaps, textoRuta } from "../src/core/rutas.ts";
import { aTabla, extraerDeTexto, repararDireccion } from "../src/core/ocr.ts";
import { readFileSync, readdirSync } from "node:fs";
import { aplicarCorrecciones, aprender, corregirConConocidos, revisar, sinCorrecciones, similitud } from "../src/core/aprender.ts";

test("normaliza direcciones", () => {
  assert.equal(normalizarDireccion("Cra 11 # 9 - 53"), "Cra 11 # 9-53");
  assert.equal(normalizarDireccion("cll 11 #. 12 - 55"), "Cll 11 # 12-55");
});

test("separa ciudad y zona", () => {
  assert.deepEqual(parseUbicacion("Jamundí · Cali-Sur"), { ciudad: "Jamundí", zona: "Sur" });
  assert.deepEqual(parseUbicacion("Cali-Norte"), { ciudad: "Cali", zona: "Norte" });
});

test("plata deduplica y rechaza filas incompletas", () => {
  const f = [
    { nombre: "Tobi", direccion: "Cll 54 # 8 a sur - 60", ubicacion: "Jamundí · Cali-Sur", segmento: "spt" },
    { nombre: "TOBI ", direccion: "Cll 54 #8 a sur-60", ubicacion: "Jamundí · Cali-Sur", segmento: "SPT" },
    { nombre: "", direccion: "x", ubicacion: "" },
  ];
  const { clientes, calidad } = construirSilver(f);
  assert.equal(clientes.length, 1);
  assert.equal(calidad.duplicados.length, 1);
  assert.equal(calidad.rechazadas.length, 1);
  assert.equal(clientes[0].estado, "Prospecto");
  assert.equal(clientes[0].tipo, "SPT");
});

test("oro cuenta visitas por cliente en el mes", () => {
  const a = crearCliente({ nombre: "A", direccion: "Cra 1 # 1-1", ciudad: "Cali", zona: "Sur" })!;
  const b = crearCliente({ nombre: "B", direccion: "Cra 2 # 2-2", ciudad: "Cali", zona: "Norte" })!;
  const agenda = { "2026-11-03": [a.id], "2026-11-10": [a.id, b.id], "2026-12-01": [b.id] };
  const r = analisisMes([a, b], agenda, 2026, 10);
  assert.deepEqual(r.filas[0].dias, [3, 10]);
  assert.equal(r.visitas, 3);
  assert.equal(r.cobertura, 100);
  assert.equal(resumenCartera([a, b]).porZona["Sur"], 1);
});

test("csv con comillas", () => {
  const r = parseCsv('a,b\n"x, y",2\n');
  assert.deepEqual(r, [{ a: "x, y", b: "2" }]);
});

test("importa nombre, dirección, barrio y área (sin encabezado, pegado desde Excel)", () => {
  const { datos, encabezado } = mapearFilas(leerTabla("Tobi\tCll 54 # 8 sur - 60\tEl Lido\tCali-Sur\nMi Tienda\tCra 1 # 2-3\tCentro\tNorte"));
  assert.equal(encabezado, false);
  const c = crearCliente({ ...datos[0], ciudad: "Cali" })!;
  assert.equal(c.barrio, "El Lido");
  assert.equal(c.zona, "Sur");
  assert.equal(crearCliente(datos[1])!.zona, "Norte");
});

test("importa CSV con encabezado y columnas en otro orden", () => {
  const { datos, encabezado } = mapearFilas(leerTabla("Área;Nombre;Dirección;Barrio\nSur;Pet Plus;Cra 5 # 6-7;San Fernando"));
  assert.equal(encabezado, true);
  assert.equal(datos[0].nombre, "Pet Plus");
  assert.equal(datos[0].barrio, "San Fernando");
  assert.equal(datos[0].zona, "Sur");
});

const tienda = (n: string, zona: string, barrio: string) => crearCliente({ nombre: n, direccion: `Cra ${n.length} # 1-1`, ciudad: "Cali", zona, barrio })!;

test("autoplanificar agrupa por zona, respeta el máximo por día y no usa domingos", () => {
  const cs = [tienda("A1", "Sur", "x"), tienda("A22", "Sur", "x"), tienda("A333", "Sur", "y"), tienda("B1", "Norte", "z"), tienda("B22", "Norte", "z")];
  const r = autoplanificar(cs, {}, 2026, 10, { porDia: 2, diasSemana: [0, 1, 2, 3, 4, 5], soloSinAgendar: true, estado: "" });
  assert.equal(r.asignadas, 5);
  assert.equal(r.sinCupo, 0);
  for (const [k, ids] of Object.entries(r.agenda)) {
    assert.ok(ids.length <= 2);
    assert.notEqual(new Date(k + "T12:00:00").getDay(), 0); // domingo
  }
  const dia1 = r.agenda["2026-11-02"]; // primer lunes de noviembre 2026
  assert.deepEqual(dia1.map((id) => cs.find((c) => c.id === id)!.zona), ["Norte", "Norte"]);
});

test("autoplanificar no repite tiendas ya agendadas y reporta sin cupo", () => {
  const cs = [tienda("A1", "Sur", "x"), tienda("A22", "Sur", "x"), tienda("A333", "Sur", "x")];
  const r = autoplanificar(cs, { "2026-11-03": [cs[0].id] }, 2026, 10, { porDia: 1, diasSemana: [1], soloSinAgendar: true, estado: "", desde: "2026-11-10" });
  assert.equal(r.asignadas, 2);
  assert.equal(r.sinCupo, 0);
  const r2 = autoplanificar(cs, {}, 2026, 10, { porDia: 1, diasSemana: [1], soloSinAgendar: true, estado: "", desde: "2026-11-24" });
  assert.equal(r2.asignadas, 1);
  assert.equal(r2.sinCupo, 2);
});

test("enlaces de Maps y texto de ruta", () => {
  const cs = Array.from({ length: 12 }, (_, i) => tienda("T" + "x".repeat(i), "Sur", "b"));
  assert.equal(enlacesMaps(cs.slice(0, 3)).length, 1);
  assert.equal(enlacesMaps(cs).length, 2);
  assert.match(enlacesMaps(cs.slice(0, 3))[0].url, /waypoints=/);
  assert.match(textoRuta("Lunes", cs.slice(0, 2)), /^Lunes\n1\. T — /);
});

test("cumplimiento cuenta visitas hechas", () => {
  const a = tienda("A", "Sur", "x");
  const r = analisisMes([a], { "2026-11-03": [a.id], "2026-11-10": [a.id] }, 2026, 10, { "2026-11-03": [a.id] });
  assert.equal(r.realizadas, 1);
  assert.equal(r.cumplimiento, 50);
  assert.equal(r.filas[0].hechas, 1);
});

test("OCR: recupera las 26 tiendas de las capturas reales (texto de Tesseract)", () => {
  const esperado = new Set(construirSilver(parseCsv(readFileSync("data/bronze/cartera_capturas.csv", "utf8")) as any).clientes.map((c) => c.id));
  const obtenido = new Set<string>();
  for (const f of readdirSync("tests/fixtures").filter((x) => x.endsWith(".txt"))) {
    for (const d of extraerDeTexto(readFileSync("tests/fixtures/" + f, "utf8"))) {
      const c = crearCliente(d);
      if (c) obtenido.add(c.id);
    }
  }
  assert.equal(esperado.size, 26);
  assert.deepEqual([...obtenido].sort(), [...esperado].sort());
});

test("OCR: nombre en dos líneas, tipo, ciudad con tilde y zona", () => {
  const txt = "9:49 ruido\nMi cartera\nSpa De Mascotas Pet Groming e Prospecto\n\nHuellitas\n\nCll10#12-16\n\nSPT Jamundi-Cali-Sur - sin gestion\n";
  const [d] = extraerDeTexto(txt);
  assert.equal(d.nombre, "Spa De Mascotas Pet Groming Huellitas");
  assert.equal(d.direccion, "Cll 10#12-16");
  assert.deepEqual([d.ciudad, d.zona, d.tipo, d.estado], ["Jamundí", "Sur", "SPT", "Prospecto"]);
  assert.match(aTabla([d]), /^nombre\tdireccion\tbarrio\tarea\tciudad\ttipo\testado\nSpa De/);
});

test("OCR: repara direcciones pegadas", () => {
  assert.equal(repararDireccion("Crall#9-53"), "Cra 11#9-53");
  assert.equal(repararDireccion("Cll54#8asur-60"), "Cll 54#8 a sur-60");
});

test("aprendizaje local: reconoce tiendas conocidas aunque el OCR falle", () => {
  const k = [crearCliente({ nombre: "Petshop El Gran Simon", direccion: "Cra 70 n 1c -55", ciudad: "Cali", zona: "Sur", barrio: "Meléndez", tipo: "SPT" })!,
             crearCliente({ nombre: "Tienda De Mascotas", direccion: "Cra 8 # 8 - 28", ciudad: "Jamundí", zona: "Sur" })!,
             crearCliente({ nombre: "Tienda De Mascotas", direccion: "Cra 4 Sur # 5 - 14", ciudad: "Jamundí", zona: "Sur" })!];
  const { datos, reconocidas } = corregirConConocidos([
    { nombre: "Petshop EI Gran Simón", direccion: "Cra 70 n1c-55" },
    { nombre: "Tienda De Mascotas", direccion: "Cra 4 Sur#5-14" },
    { nombre: "Otra Tienda Nueva", direccion: "Cll 1 # 2-3" }], k);
  assert.equal(reconocidas, 2);
  assert.equal(datos[0].barrio, "Meléndez");
  assert.equal(crearCliente(datos[1])!.id, k[2].id); // distingue las tres "Tienda De Mascotas" por dirección
  assert.equal(datos[2].nombre, "Otra Tienda Nueva");
  assert.ok(similitud("Cra 70 n 1c -55", "Cra 70n1c-55") === 1);
});

test("aprendizaje local: recuerda correcciones del usuario y las aplica después", () => {
  const ocr = [{ nombre: "Karens Pet", direccion: "Cll2bn78a09" }];
  const fin = [{ nombre: "Karen's Pet", direccion: "Cll 2b n 78 a 09" }];
  const mem = aprender(ocr, fin, sinCorrecciones());
  const [d] = aplicarCorrecciones([{ nombre: "Karens Pet", direccion: "Cll2bn78a09" }], mem);
  assert.equal(d.nombre, "Karen's Pet");
  assert.equal(d.direccion, "Cll 2b n 78 a 09");
});

test("marca filas dudosas para revisar", () => {
  assert.deepEqual(revisar(crearCliente({ nombre: "Tobi", direccion: "Cll 54 # 8 sur-60", zona: "Sur" })!), []);
  const r = revisar(crearCliente({ nombre: "Pet@ Shop", direccion: "Calle sin numero" })!);
  assert.ok(r.includes("dirección sin #") && r.includes("símbolos raros en el nombre") && r.includes("sin zona"));
});

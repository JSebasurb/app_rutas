import { test } from "node:test";
import assert from "node:assert/strict";
import { construirSilver, normalizarDireccion, parseUbicacion, crearCliente } from "../src/core/silver.ts";
import { analisisMes, resumenCartera } from "../src/core/gold.ts";
import { parseCsv } from "../pipeline/csv.ts";

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

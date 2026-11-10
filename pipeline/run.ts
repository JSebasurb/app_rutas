/**
 * Pipeline medallón:  data/bronze/*.csv  →  data/silver/*.json  →  data/gold/*.json
 * Además copia silver y gold a public/data para que la app los sirva en GitHub Pages.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.ts";
import { construirSilver } from "../src/core/silver.ts";
import { resumenCartera } from "../src/core/gold.ts";
import type { BronzeRow } from "../src/types.ts";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function escribir(capa: string, nombre: string, datos: unknown) {
  const json = JSON.stringify(datos, null, 2) + "\n";
  for (const base of ["data", "public/data"]) {
    const dir = join(raiz, base, capa);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, nombre), json);
  }
}

// 1) BRONCE: leer todos los CSV tal cual
const dirBronce = join(raiz, "data", "bronze");
const filas = readdirSync(dirBronce)
  .filter((f) => f.endsWith(".csv"))
  .sort()
  .flatMap((f) => parseCsv(readFileSync(join(dirBronce, f), "utf8")) as unknown as Partial<BronzeRow>[]);

// 2) PLATA: limpiar, normalizar, deduplicar
const { clientes, calidad } = construirSilver(filas);
escribir("silver", "clientes.json", clientes);
escribir("silver", "calidad.json", calidad);

// 3) ORO: métricas de cartera
escribir("gold", "resumen_cartera.json", resumenCartera(clientes));

console.log(`bronce: ${calidad.filasEntrada} filas → plata: ${calidad.clientesSalida} clientes (${calidad.duplicados.length} duplicados, ${calidad.rechazadas.length} rechazadas)`);

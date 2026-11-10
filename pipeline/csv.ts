/** Lector CSV mínimo (soporta comillas y comas dentro de campos). */
export function parseCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let campo = "", fila: string[] = [], q = false;
  const t = texto.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') q = false;
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); if (fila.some((x) => x !== "")) filas.push(fila); }
  const [cab, ...resto] = filas;
  if (!cab) return [];
  return resto.map((r) => Object.fromEntries(cab.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

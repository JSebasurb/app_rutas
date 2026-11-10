/** OCR en el navegador con Tesseract.js (la imagen no sale del dispositivo; solo se descarga el idioma la primera vez). */

/** Prepara la captura para el OCR: amplía, pasa a grises, invierte si el fondo es oscuro y sube el contraste. */
async function preparar(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(3, Math.max(1, 1800 / bmp.width));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const img = g.getImageData(0, 0, c.width, c.height);
  const px = img.data, n = c.width * c.height, gris = new Uint8ClampedArray(n);
  let suma = 0;
  for (let i = 0; i < n; i++) { const v = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; gris[i] = v; suma += v; }
  const oscuro = suma / n < 128;
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) { if (oscuro) gris[i] = 255 - gris[i]; hist[gris[i]]++; }
  let acum = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acum += hist[v]; if (acum >= n * 0.01) { lo = v; break; } }
  acum = 0;
  for (let v = 255; v >= 0; v--) { acum += hist[v]; if (acum >= n * 0.01) { hi = v; break; } }
  const rango = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, ((gris[i] - lo) * 255) / rango));
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v;
    px[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Devuelve el texto reconocido de cada imagen (en el mismo orden). */
export async function leerImagenes(archivos: File[], estado: (mensaje: string) => void): Promise<string[]> {
  estado("Cargando el motor de lectura…");
  const mod: any = await import("tesseract.js");
  const createWorker = mod.createWorker ?? mod.default?.createWorker;
  let actual = 0;
  const worker = await createWorker("spa", 1, {
    logger: (m: any) => {
      if (m.status === "recognizing text") estado(`Leyendo imagen ${actual + 1}/${archivos.length}… ${Math.round(m.progress * 100)}%`);
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: "6" }); // un solo bloque de texto
    const textos: string[] = [];
    for (actual = 0; actual < archivos.length; actual++) {
      estado(`Preparando imagen ${actual + 1}/${archivos.length}…`);
      textos.push((await worker.recognize(await preparar(archivos[actual]))).data.text);
    }
    return textos;
  } finally {
    await worker.terminate();
  }
}

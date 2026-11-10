# Ruta de visitas

Planificador mensual de visitas a tiendas: calendario, rutas por día, análisis de clientes y exportación a **Excel (.xlsx con formato)** e **imagen PNG**. Hecho con **TypeScript + Vite** y una **arquitectura medallón** para los datos. Se publica solo en **GitHub Pages**.

## Arquitectura medallón

```
data/bronze/*.csv ──► pipeline ──► data/silver/*.json ──► data/gold/*.json ──► app
   (crudo)            (TypeScript)     (limpio)              (métricas)
```

| Capa | Carpeta | Qué contiene |
|------|---------|--------------|
| 🥉 Bronce | `data/bronze/` | CSV tal como se capturaron (duplicados, direcciones sucias, texto "Jamundí · Cali-Sur"). **No se edita a mano la plata, se agrega aquí.** |
| 🥈 Plata | `data/silver/` | `clientes.json` (limpio, con ciudad, zona, tipo, estado e id estable) y `calidad.json` (duplicados, rechazadas, advertencias). |
| 🥇 Oro | `data/gold/` | `resumen_cartera.json` (clientes por ciudad, zona, tipo y estado). El análisis mensual de la agenda se calcula en la app con el mismo código (`src/core/gold.ts`). |

La limpieza (`src/core/silver.ts`) la usan tanto el pipeline como la app: lo que escribes en pantalla se normaliza igual que los datos de bronce.

## Estructura

```
├─ data/{bronze,silver,gold}/     capas de datos
├─ pipeline/                      bronce → plata → oro (Node)
├─ src/core/                      lógica pura: silver, gold, fechas
├─ src/ui/                        planificador, análisis, editor
├─ src/export/                    xlsx (ExcelJS) y png (canvas)
├─ src/store.ts                   estado + localStorage + respaldo
├─ tests/                         pruebas del medallón
└─ .github/workflows/deploy.yml   publicación en Pages
```

## Uso local

```bash
npm install
npm run dev        # corre el pipeline y abre la app
npm test           # pruebas
npm run build      # genera dist/
```

## Publicar en GitHub Pages

1. Sube el proyecto a un repositorio (rama `main`). Incluye el `package-lock.json` que crea `npm install`.
2. En **Settings → Pages → Build and deployment → Source** elige **GitHub Actions**.
3. Cada `git push` a `main` prueba, construye y publica en `https://<usuario>.github.io/<repositorio>/`.

## Agregar o actualizar clientes

- **Desde la app:** formulario, pegar lista (`Nombre; Dirección; Ciudad; Zona; Estado; Tipo`) o botón *Editar*.
- **Desde el repositorio:** agrega un CSV en `data/bronze/` con las columnas `nombre,direccion,ubicacion,segmento,estado,gestion,fuente` (y opcional `barrio`), haz push y el pipeline regenera plata y oro. En la app, *Datos → Sincronizar con capa plata* suma las tiendas nuevas sin tocar tus ediciones.

## Funciones de planificación

- **Autoplanificar:** reparte las tiendas por los días hábiles del mes agrupando por área y barrio, con máximo de visitas por día, días de trabajo y filtro por estado. En el mes actual no agenda días pasados. Se deshace desde *Datos*.
- **Visitas realizadas:** casilla en cada visita del día; el calendario muestra `✓` y el análisis calcula el cumplimiento del mes.
- **Ruta del día:** botón *Abrir en Maps* (tramos de 10 paradas) y *Copiar ruta* para WhatsApp.

## Importar desde imagen (OCR)

En *Importar tiendas* sube o pega (Ctrl+V) una o varias capturas o fotos. El navegador las lee con **Tesseract.js** (la imagen no sale del dispositivo; la primera vez descarga el idioma español, así que necesita internet): las prepara (amplía, escala de grises, invierte fondos oscuros), reconoce el texto y extrae nombre, dirección, ciudad, zona, tipo y estado de cada tarjeta. El resultado aparece como texto editable con la misma vista previa que cualquier otra fuente, para corregir errores del OCR antes de importar. La lógica de extracción (`src/core/ocr.ts`) está probada con el texto real que produjo el OCR de las 9 capturas de ejemplo (`tests/fixtures/`).

### Mejoras locales del OCR (sin modelos externos)

`src/core/aprender.ts`: (1) si una fila leída se parece a una tienda que ya tienes (nombre ≥ 85 % y dirección ≥ 75 % de similitud) usa los datos de la existente, lo que evita duplicados por errores del OCR y recupera barrio, zona y tipo; (2) **recuerda tus correcciones**: lo que cambias en el cuadro de texto antes de importar se guarda en el navegador (`localStorage`) y se aplica automáticamente cuando el OCR vuelva a leer lo mismo; (3) marca con ⚠ las filas dudosas (dirección sin `#`, símbolos raros, sin zona).

## Importar tiendas

Botón **Importar tiendas** (o desde el CSV de bronce). Datos de entrada: **nombre, dirección, barrio y área**, en ese orden, con o sin encabezado. Acepta CSV, Excel `.xlsx` o filas pegadas desde Excel; hay plantilla descargable y una vista previa que cuenta nuevas, repetidas e inválidas antes de importar. Si el archivo trae encabezados, también reconoce `ciudad`, `tipo` y `estado` y las columnas pueden ir en cualquier orden. El área acepta "Sur" o "Cali-Sur".

## Datos del usuario

La agenda y las ediciones se guardan en el navegador (`localStorage`). Usa **Datos → Descargar respaldo** para llevarlas a otro dispositivo y **Restaurar respaldo** para cargarlas.

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
- **Desde el repositorio:** agrega un CSV en `data/bronze/` con las columnas `nombre,direccion,ubicacion,segmento,estado,gestion,fuente`, haz push y el pipeline regenera plata y oro. En la app, *Datos → Sincronizar con capa plata* suma las tiendas nuevas sin tocar tus ediciones.

## Datos del usuario

La agenda y las ediciones se guardan en el navegador (`localStorage`). Usa **Datos → Descargar respaldo** para llevarlas a otro dispositivo y **Restaurar respaldo** para cargarlas.

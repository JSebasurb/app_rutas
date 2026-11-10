export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DIAS_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const pad = (n: number) => String(n).padStart(2, "0");
export const clave = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const prefijoMes = (y: number, m: number) => `${y}-${pad(m + 1)}-`;
export const diasEnMes = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Columna (0 = lunes) en la que cae el día 1 del mes. */
export const offsetLunes = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;
/** Índice 0 = lunes … 6 = domingo. */
export const indiceSemana = (y: number, m: number, d: number) => (new Date(y, m, d).getDay() + 6) % 7;
export const diaSemana = (y: number, m: number, d: number) => DIAS[indiceSemana(y, m, d)];

export function hoy(): string {
  const n = new Date();
  return clave(n.getFullYear(), n.getMonth(), n.getDate());
}

export interface Celda {
  d: number;
  k: string;
  fuera: boolean;
  col: number;
}

/** Celdas del calendario del mes (semanas completas, lunes a domingo). */
export function matrizMes(y: number, m: number): Celda[] {
  const off = offsetLunes(y, m);
  const total = Math.ceil((off + diasEnMes(y, m)) / 7) * 7;
  const out: Celda[] = [];
  for (let i = 0; i < total; i++) {
    const dt = new Date(y, m, 1 - off + i);
    out.push({ d: dt.getDate(), k: clave(dt.getFullYear(), dt.getMonth(), dt.getDate()), fuera: dt.getMonth() !== m, col: i % 7 });
  }
  return out;
}

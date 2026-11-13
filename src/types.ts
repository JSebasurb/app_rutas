export const ESTADOS = ["Prospecto", "Cliente activo", "Cliente inactivo", "Perdido"] as const;
export type Estado = (typeof ESTADOS)[number];

/** Capa BRONCE: fila cruda tal como llegó (texto sin limpiar). */
export interface BronzeRow {
  nombre: string;
  direccion: string;
  ubicacion: string;
  barrio?: string;
  categoria?: string;
  contacto?: string;
  telefono?: string;
  notas?: string;
  segmento: string;
  estado: string;
  gestion: string;
  fuente: string;
}

/** Capa PLATA: cliente limpio, normalizado y con id estable. */
export interface Cliente {
  id: string;
  nombre: string;
  direccion: string;
  barrio: string;
  ciudad: string;
  zona: string;
  tipo: string;
  estado: Estado;
  /** categoría de cliente (A, B, VIP…) */
  categoria: string;
  contacto: string;
  telefono: string;
  notas: string;
}

export interface DatosCliente {
  nombre: string;
  direccion: string;
  barrio?: string;
  ciudad?: string;
  zona?: string;
  tipo?: string;
  estado?: string;
  categoria?: string;
  contacto?: string;
  telefono?: string;
  notas?: string;
}

/** Agenda: fecha (YYYY-MM-DD) → ids de clientes en el orden de visita. */
export type Agenda = Record<string, string[]>;

/** Venta registrada a un cliente. */
export interface Venta {
  id: string;
  clienteId: string;
  /** YYYY-MM-DD */
  fecha: string;
  monto: number;
  nota: string;
}

/** Visitas realizadas: fecha → ids marcados como hechos. */
export type Hechas = Record<string, string[]>;

export interface Respaldo {
  version: 2;
  clientes: Cliente[];
  agenda: Agenda;
  hechas?: Hechas;
  ventas?: Venta[];
}

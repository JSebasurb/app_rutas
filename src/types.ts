export const ESTADOS = ["Prospecto", "Cliente activo", "Cliente inactivo", "Perdido"] as const;
export type Estado = (typeof ESTADOS)[number];

/** Capa BRONCE: fila cruda tal como llegó (texto sin limpiar). */
export interface BronzeRow {
  nombre: string;
  direccion: string;
  ubicacion: string;
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
  ciudad: string;
  zona: string;
  tipo: string;
  estado: Estado;
}

export interface DatosCliente {
  nombre: string;
  direccion: string;
  ciudad?: string;
  zona?: string;
  tipo?: string;
  estado?: string;
}

/** Agenda: fecha (YYYY-MM-DD) → ids de clientes en el orden de visita. */
export type Agenda = Record<string, string[]>;

export interface Respaldo {
  version: 2;
  clientes: Cliente[];
  agenda: Agenda;
}

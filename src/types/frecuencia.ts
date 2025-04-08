// Interfaces para la configuración de frecuencia

export interface ConfiguracionFrecuenciaBase {
  tipo: string;
  hora: string;
}

export interface ConfiguracionFrecuenciaSemanal extends ConfiguracionFrecuenciaBase {
  dias_semana: number[];
}

export interface ConfiguracionFrecuenciaMensual extends ConfiguracionFrecuenciaBase {
  dias_mes: number[];
}

export type ConfiguracionFrecuencia = 
  | ConfiguracionFrecuenciaBase 
  | ConfiguracionFrecuenciaSemanal 
  | ConfiguracionFrecuenciaMensual;

export interface FrecuenciaTipo {
  id: number;
  nombre: string;
  descripcion?: string;
}

export interface Responsable {
  id: number;
  emisor_id: number;
  casilla_id: number;
  responsable_nombre: string;
  responsable_email: string;
  frecuencia_tipo_id: number;
  configuracion_frecuencia: string | ConfiguracionFrecuencia;
  ultimo_envio?: string;
  estado_retraso?: boolean;
  tiempo_retraso?: number;
}
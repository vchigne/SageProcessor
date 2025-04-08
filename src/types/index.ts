// Definición de tipos base
export interface BaseEntity {
  id: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// Organizaciones
export interface Organizacion extends BaseEntity {
  nombre: string;
  codigo: string;
  is_active: boolean;
  descripcion?: string;
}

// Productos
export interface Producto extends BaseEntity {
  nombre: string;
  codigo: string;
  is_active: boolean;
  descripcion?: string;
}

// Países
export interface Pais extends BaseEntity {
  nombre: string;
  codigo: string;
  is_active: boolean;
}

// Instalaciones
export interface Instalacion extends BaseEntity {
  nombre: string;
  organizacion_id: number;
  producto_id: number;
  pais_id: number;
  is_active: boolean;
  
  // Relaciones
  organizacion: Organizacion;
  producto: Producto;
  pais: Pais;
}

// Yaml Content (estructura básica de un archivo YAML)
export interface YamlContent {
  name?: string;
  description?: string;
  version?: string;
  rules?: any[];
  [key: string]: any;
}

// Casillas (anteriormente casillas_recepcion)
export interface Casilla extends BaseEntity {
  instalacion_id: number;
  api_endpoint?: string;
  email_casilla?: string;
  is_active: boolean;
  nombre_yaml?: string;
  yaml_content?: YamlContent;
  yaml_contenido?: string;
  configuracion_id?: number;
  nombre?: string;
  descripcion?: string;
  
  // Relaciones
  instalacion: Instalacion;
}

// Emisores
export interface Emisor extends BaseEntity {
  casilla_id: number;
  nombre: string;
  email: string;
  is_active: boolean;
  
  // Relaciones
  casilla?: Casilla;
}

// Suscripciones
export interface Suscripcion extends BaseEntity {
  casilla_id: number;
  nombre: string;
  email: string;
  tipo: 'error' | 'warning' | 'info' | 'all';
  is_active: boolean;
  
  // Relaciones
  casilla?: Casilla;
}

// Ejecuciones
export interface Ejecucion extends BaseEntity {
  casilla_id: number;
  nombre_archivo: string;
  fecha_ejecucion: Date | string;
  resultado: 'success' | 'error' | 'warning';
  detalles?: string;
  
  // Relaciones
  casilla?: Casilla;
}

// Tipos de respuesta API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Filtros para búsqueda
export interface CasillasFilter {
  search?: string;
  isActive?: boolean;
  instalacionId?: number;
  organizacionId?: number;
  productoId?: number;
  paisId?: number;
}
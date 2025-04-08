
-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tablas principales
CREATE TABLE IF NOT EXISTS organizaciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS paises (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS instalaciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  organizacion_id INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  pais_id INTEGER NOT NULL REFERENCES paises(id) ON DELETE RESTRICT,
  activo BOOLEAN DEFAULT true,
  UNIQUE(nombre, organizacion_id)
);

CREATE TABLE IF NOT EXISTS casillas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  instalacion_id INTEGER NOT NULL REFERENCES instalaciones(id) ON DELETE RESTRICT,
  email_casilla VARCHAR(255),
  tipo_envio VARCHAR(50) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portales (
  uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suscripciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portal_id UUID NOT NULL REFERENCES portales(uuid) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(portal_id, email)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_instalaciones_org ON instalaciones(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_instalaciones_prod ON instalaciones(producto_id);
CREATE INDEX IF NOT EXISTS idx_instalaciones_pais ON instalaciones(pais_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_portal ON suscripciones(portal_id);
CREATE INDEX IF NOT EXISTS idx_casillas_instalacion ON casillas(instalacion_id);

-- Insertar datos de prueba
INSERT INTO organizaciones (nombre) VALUES 
('Organización A'),
('Organización B'),
('Organización C');

INSERT INTO productos (nombre) VALUES 
('Producto X'),
('Producto Y'),
('Producto Z');

INSERT INTO paises (nombre) VALUES 
('México'),
('Colombia'),
('Perú');

INSERT INTO instalaciones (nombre, organizacion_id, producto_id, pais_id) VALUES 
('Instalación 1', 1, 1, 1),
('Instalación 2', 2, 2, 2),
('Instalación 3', 3, 3, 3);

INSERT INTO portales (nombre, descripcion) VALUES 
('Portal Principal', 'Portal principal de notificaciones'),
('Portal Secundario', 'Portal secundario de reportes');

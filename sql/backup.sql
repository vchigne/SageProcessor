
-- Backup completo de la base de datos SAGE
-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tablas principales
CREATE TABLE public.organizaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT true
);

CREATE TABLE public.productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT true
);

CREATE TABLE public.paises (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT true
);

CREATE TABLE public.instalaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    organizacion_id INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    pais_id INTEGER NOT NULL REFERENCES paises(id) ON DELETE RESTRICT,
    activo BOOLEAN DEFAULT true,
    UNIQUE(nombre, organizacion_id)
);

CREATE TABLE public.casillas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    instalacion_id INTEGER NOT NULL REFERENCES instalaciones(id) ON DELETE RESTRICT,
    email_casilla VARCHAR(255),
    tipo_envio VARCHAR(50) NOT NULL,
    yaml_contenido TEXT,
    nombre_yaml VARCHAR(255),
    configuracion JSONB,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.portales (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.suscripciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portal_id UUID NOT NULL REFERENCES portales(uuid) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portal_id, email)
);

CREATE TABLE public.ejecuciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    casilla_id UUID REFERENCES casillas(id),
    fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50),
    mensaje TEXT,
    archivos_procesados INTEGER DEFAULT 0,
    errores INTEGER DEFAULT 0
);

CREATE TABLE public.archivos_procesados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ejecucion_id UUID REFERENCES ejecuciones(id),
    nombre_archivo VARCHAR(255),
    estado VARCHAR(50),
    mensaje TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_instalaciones_org ON instalaciones(organizacion_id);
CREATE INDEX idx_instalaciones_prod ON instalaciones(producto_id);
CREATE INDEX idx_instalaciones_pais ON instalaciones(pais_id);
CREATE INDEX idx_casillas_instalacion ON casillas(instalacion_id);
CREATE INDEX idx_suscripciones_portal ON suscripciones(portal_id);
CREATE INDEX idx_ejecuciones_casilla ON ejecuciones(casilla_id);
CREATE INDEX idx_archivos_ejecucion ON archivos_procesados(ejecucion_id);

-- Datos de ejemplo
INSERT INTO organizaciones (nombre) VALUES 
('Organización A'),
('Organización B'),
('Organización C'),
('Cliente Principal'),
('Cliente Secundario');

INSERT INTO productos (nombre) VALUES 
('Producto X'),
('Producto Y'),
('Producto Z'),
('SAGE Basic'),
('SAGE Premium');

INSERT INTO paises (nombre) VALUES 
('México'),
('Colombia'),
('Perú'),
('Argentina'),
('Chile');

INSERT INTO instalaciones (nombre, organizacion_id, producto_id, pais_id) VALUES 
('Instalación 1', 1, 1, 1),
('Instalación 2', 2, 2, 2),
('Instalación 3', 3, 3, 3),
('Principal MX', 4, 4, 1),
('Secundaria CO', 5, 5, 2);

INSERT INTO portales (nombre, descripcion) VALUES 
('Portal Principal', 'Portal principal de notificaciones'),
('Portal Secundario', 'Portal secundario de reportes'),
('Portal Clientes', 'Portal de acceso para clientes'),
('Portal Interno', 'Portal para uso interno'),
('Portal Pruebas', 'Portal de pruebas y desarrollo');

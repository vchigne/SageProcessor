-- Tabla para servidores de materialización
CREATE TABLE IF NOT EXISTS materializacion_servidores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('local', 'remote', 'container')),
    url VARCHAR(255) NOT NULL,
    api_key VARCHAR(255),
    capacidad INTEGER DEFAULT 10,
    configuracion JSONB DEFAULT '{}',
    estado VARCHAR(50) DEFAULT 'pendiente',
    metricas JSONB DEFAULT '{}',
    ultimo_test TIMESTAMP WITH TIME ZONE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_materializacion_servidores_tipo ON materializacion_servidores (tipo);
CREATE INDEX IF NOT EXISTS idx_materializacion_servidores_estado ON materializacion_servidores (estado);
-- Tabla para conexiones a bases de datos
CREATE TABLE IF NOT EXISTS database_connections (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    secret_id INTEGER NOT NULL REFERENCES db_secrets(id),
    base_datos VARCHAR(255) NOT NULL,
    esquema VARCHAR(255),
    configuracion JSONB DEFAULT '{}',
    estado_conexion VARCHAR(50) DEFAULT 'pendiente',
    ultimo_test TIMESTAMP WITH TIME ZONE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_database_connections_secret_id ON database_connections (secret_id);
CREATE INDEX IF NOT EXISTS idx_database_connections_nombre ON database_connections (nombre);
CREATE INDEX IF NOT EXISTS idx_database_connections_estado ON database_connections (estado_conexion);
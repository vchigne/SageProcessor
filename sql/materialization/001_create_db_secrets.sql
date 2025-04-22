-- Tabla para almacenar secretos de bases de datos
CREATE TABLE IF NOT EXISTS db_secrets (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo_servidor VARCHAR(50) NOT NULL CHECK (tipo_servidor IN ('postgresql', 'mysql', 'sqlserver', 'duckdb')),
    credenciales JSONB NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE
);

-- Índices para buscar secretos por nombre y tipo
CREATE INDEX IF NOT EXISTS idx_db_secrets_nombre ON db_secrets (nombre);
CREATE INDEX IF NOT EXISTS idx_db_secrets_tipo ON db_secrets (tipo_servidor);
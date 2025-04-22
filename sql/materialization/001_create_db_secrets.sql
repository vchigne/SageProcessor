-- Migración: Crear tabla db_secrets
-- Esta tabla almacena las credenciales de servidores de bases de datos

CREATE TABLE IF NOT EXISTS db_secrets (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo_servidor VARCHAR(50) NOT NULL CHECK (tipo_servidor IN ('postgresql', 'mysql', 'sqlserver', 'duckdb')),
    credenciales JSONB NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_db_secrets_tipo_servidor ON db_secrets(tipo_servidor);
CREATE INDEX IF NOT EXISTS idx_db_secrets_activo ON db_secrets(activo);

-- Comentarios
COMMENT ON TABLE db_secrets IS 'Almacena credenciales y configuración de servidores de bases de datos';
COMMENT ON COLUMN db_secrets.id IS 'Identificador único';
COMMENT ON COLUMN db_secrets.nombre IS 'Nombre descriptivo del servidor de base de datos';
COMMENT ON COLUMN db_secrets.descripcion IS 'Descripción detallada del servidor';
COMMENT ON COLUMN db_secrets.tipo_servidor IS 'Tipo de servidor: postgresql, mysql, sqlserver, duckdb';
COMMENT ON COLUMN db_secrets.credenciales IS 'Credenciales de conexión en formato JSON (host, puerto, usuario, contraseña, etc.)';
COMMENT ON COLUMN db_secrets.creado_en IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN db_secrets.modificado_en IS 'Fecha y hora de última modificación';
COMMENT ON COLUMN db_secrets.activo IS 'Indica si el servidor está activo';
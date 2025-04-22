-- Migración: Crear tabla database_connections
-- Esta tabla almacena las conexiones a bases de datos específicas

CREATE TABLE IF NOT EXISTS database_connections (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    secret_id INTEGER NOT NULL REFERENCES db_secrets(id) ON DELETE CASCADE,
    base_datos VARCHAR(255) NOT NULL,
    esquema VARCHAR(255),
    configuracion JSONB,
    estado_conexion VARCHAR(50) DEFAULT 'pendiente',
    ultimo_test TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_database_connections_secret_id ON database_connections(secret_id);
CREATE INDEX IF NOT EXISTS idx_database_connections_activo ON database_connections(activo);
CREATE INDEX IF NOT EXISTS idx_database_connections_estado ON database_connections(estado_conexion);

-- Comentarios
COMMENT ON TABLE database_connections IS 'Almacena conexiones a bases de datos específicas';
COMMENT ON COLUMN database_connections.id IS 'Identificador único';
COMMENT ON COLUMN database_connections.nombre IS 'Nombre descriptivo de la conexión';
COMMENT ON COLUMN database_connections.descripcion IS 'Descripción detallada de la conexión';
COMMENT ON COLUMN database_connections.secret_id IS 'ID del servidor de base de datos en db_secrets';
COMMENT ON COLUMN database_connections.base_datos IS 'Nombre de la base de datos';
COMMENT ON COLUMN database_connections.esquema IS 'Esquema de la base de datos (opcional)';
COMMENT ON COLUMN database_connections.configuracion IS 'Configuración adicional de la conexión en formato JSON';
COMMENT ON COLUMN database_connections.estado_conexion IS 'Estado de la conexión: pendiente, activa, error';
COMMENT ON COLUMN database_connections.ultimo_test IS 'Fecha y hora del último test de conexión';
COMMENT ON COLUMN database_connections.creado_en IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN database_connections.modificado_en IS 'Fecha y hora de última modificación';
COMMENT ON COLUMN database_connections.activo IS 'Indica si la conexión está activa';
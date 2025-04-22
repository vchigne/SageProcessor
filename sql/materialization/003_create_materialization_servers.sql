-- Migración: Crear tabla materialization_servers
-- Esta tabla almacena información sobre servidores de materialización

CREATE TABLE IF NOT EXISTS materialization_servers (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('local', 'remote', 'container')),
    endpoint VARCHAR(255),
    secret_id INTEGER REFERENCES cloud_secrets(id),
    capacidad INTEGER DEFAULT 100,
    estado VARCHAR(50) DEFAULT 'inactivo',
    metricas JSONB,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_materialization_servers_tipo ON materialization_servers(tipo);
CREATE INDEX IF NOT EXISTS idx_materialization_servers_estado ON materialization_servers(estado);
CREATE INDEX IF NOT EXISTS idx_materialization_servers_activo ON materialization_servers(activo);

-- Comentarios
COMMENT ON TABLE materialization_servers IS 'Almacena información sobre servidores de materialización';
COMMENT ON COLUMN materialization_servers.id IS 'Identificador único';
COMMENT ON COLUMN materialization_servers.nombre IS 'Nombre descriptivo del servidor';
COMMENT ON COLUMN materialization_servers.descripcion IS 'Descripción detallada del servidor';
COMMENT ON COLUMN materialization_servers.tipo IS 'Tipo de servidor: local, remote, container';
COMMENT ON COLUMN materialization_servers.endpoint IS 'URL o endpoint del servidor remoto';
COMMENT ON COLUMN materialization_servers.secret_id IS 'ID del secreto para autenticación (en cloud_secrets)';
COMMENT ON COLUMN materialization_servers.capacidad IS 'Capacidad relativa del servidor (1-100)';
COMMENT ON COLUMN materialization_servers.estado IS 'Estado del servidor: inactivo, activo, error, ocupado';
COMMENT ON COLUMN materialization_servers.metricas IS 'Métricas de rendimiento en formato JSON';
COMMENT ON COLUMN materialization_servers.creado_en IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN materialization_servers.modificado_en IS 'Fecha y hora de última modificación';
COMMENT ON COLUMN materialization_servers.activo IS 'Indica si el servidor está activo';

-- Insertar servidor local por defecto
INSERT INTO materialization_servers (nombre, descripcion, tipo, estado, activo)
VALUES ('Servidor Local', 'Servidor de materialización integrado en SAGE', 'local', 'activo', TRUE)
ON CONFLICT DO NOTHING;
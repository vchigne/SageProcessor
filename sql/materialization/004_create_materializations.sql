-- Migración: Crear tabla materializations
-- Esta tabla almacena configuraciones de materialización a nivel de casilla

CREATE TABLE IF NOT EXISTS materializations (
    id SERIAL PRIMARY KEY,
    casilla_id INTEGER NOT NULL REFERENCES data_boxes(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    configuracion_general JSONB DEFAULT '{}',
    ultimo_analisis TIMESTAMP WITH TIME ZONE,
    ultima_materializacion TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'pendiente',
    servidor_id INTEGER REFERENCES materialization_servers(id),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_materializations_casilla_id ON materializations(casilla_id);
CREATE INDEX IF NOT EXISTS idx_materializations_estado ON materializations(estado);
CREATE INDEX IF NOT EXISTS idx_materializations_activo ON materializations(activo);
CREATE INDEX IF NOT EXISTS idx_materializations_servidor_id ON materializations(servidor_id);

-- Comentarios
COMMENT ON TABLE materializations IS 'Almacena configuraciones de materialización a nivel de casilla';
COMMENT ON COLUMN materializations.id IS 'Identificador único';
COMMENT ON COLUMN materializations.casilla_id IS 'ID de la casilla asociada';
COMMENT ON COLUMN materializations.nombre IS 'Nombre descriptivo de la materialización';
COMMENT ON COLUMN materializations.descripcion IS 'Descripción detallada de la materialización';
COMMENT ON COLUMN materializations.configuracion_general IS 'Configuración general en formato JSON';
COMMENT ON COLUMN materializations.ultimo_analisis IS 'Fecha y hora del último análisis de estructura';
COMMENT ON COLUMN materializations.ultima_materializacion IS 'Fecha y hora de la última materialización';
COMMENT ON COLUMN materializations.estado IS 'Estado de la materialización: pendiente, analizado, error, completado';
COMMENT ON COLUMN materializations.servidor_id IS 'ID del servidor de materialización (opcional)';
COMMENT ON COLUMN materializations.creado_en IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN materializations.modificado_en IS 'Fecha y hora de última modificación';
COMMENT ON COLUMN materializations.activo IS 'Indica si la materialización está activa';
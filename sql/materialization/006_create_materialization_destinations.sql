-- Migración: Crear tabla materialization_destinations
-- Esta tabla almacena los destinos de materialización

CREATE TABLE IF NOT EXISTS materialization_destinations (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER NOT NULL REFERENCES materializations(id) ON DELETE CASCADE,
    tipo_destino VARCHAR(50) NOT NULL CHECK (tipo_destino IN ('cloud', 'database')),
    destino_id INTEGER NOT NULL,
    formato VARCHAR(50) NOT NULL CHECK (formato IN ('parquet', 'iceberg', 'hudi', 'sql')),
    configuracion JSONB,
    ultimo_refresh TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'pendiente',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    
    -- Restricción para validar el tipo de destino
    CONSTRAINT chk_destino_tipo_valido CHECK (
        (tipo_destino = 'cloud' AND destino_id IN (SELECT id FROM clouds)) OR
        (tipo_destino = 'database' AND destino_id IN (SELECT id FROM database_connections))
    )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_materialization_destinations_materializacion_id ON materialization_destinations(materializacion_id);
CREATE INDEX IF NOT EXISTS idx_materialization_destinations_tipo_destino ON materialization_destinations(tipo_destino);
CREATE INDEX IF NOT EXISTS idx_materialization_destinations_destino_id ON materialization_destinations(destino_id);
CREATE INDEX IF NOT EXISTS idx_materialization_destinations_formato ON materialization_destinations(formato);
CREATE INDEX IF NOT EXISTS idx_materialization_destinations_activo ON materialization_destinations(activo);

-- Comentarios
COMMENT ON TABLE materialization_destinations IS 'Almacena los destinos de materialización';
COMMENT ON COLUMN materialization_destinations.id IS 'Identificador único';
COMMENT ON COLUMN materialization_destinations.materializacion_id IS 'ID de la materialización asociada';
COMMENT ON COLUMN materialization_destinations.tipo_destino IS 'Tipo de destino: cloud, database';
COMMENT ON COLUMN materialization_destinations.destino_id IS 'ID del destino (referencia a clouds o database_connections según tipo_destino)';
COMMENT ON COLUMN materialization_destinations.formato IS 'Formato de materialización: parquet, iceberg, hudi, sql';
COMMENT ON COLUMN materialization_destinations.configuracion IS 'Configuración adicional en formato JSON';
COMMENT ON COLUMN materialization_destinations.ultimo_refresh IS 'Fecha y hora del último refresco';
COMMENT ON COLUMN materialization_destinations.estado IS 'Estado del destino: pendiente, activo, error';
COMMENT ON COLUMN materialization_destinations.creado_en IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN materialization_destinations.modificado_en IS 'Fecha y hora de última modificación';
COMMENT ON COLUMN materialization_destinations.activo IS 'Indica si el destino está activo';
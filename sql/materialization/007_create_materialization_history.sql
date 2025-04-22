-- Migración: Crear tabla materialization_history
-- Esta tabla almacena el historial de materializaciones ejecutadas

CREATE TABLE IF NOT EXISTS materialization_history (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER NOT NULL REFERENCES materializations(id) ON DELETE CASCADE,
    tabla_id INTEGER REFERENCES materialization_tables(id) ON DELETE SET NULL,
    destino_id INTEGER REFERENCES materialization_destinations(id) ON DELETE SET NULL,
    servidor_id INTEGER REFERENCES materialization_servers(id) ON DELETE SET NULL,
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    tamaño_datos BIGINT,
    filas_procesadas INTEGER,
    estado VARCHAR(50) NOT NULL,
    mensaje_error TEXT,
    metricas JSONB,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_materialization_history_materializacion_id ON materialization_history(materializacion_id);
CREATE INDEX IF NOT EXISTS idx_materialization_history_tabla_id ON materialization_history(tabla_id);
CREATE INDEX IF NOT EXISTS idx_materialization_history_destino_id ON materialization_history(destino_id);
CREATE INDEX IF NOT EXISTS idx_materialization_history_servidor_id ON materialization_history(servidor_id);
CREATE INDEX IF NOT EXISTS idx_materialization_history_fecha_inicio ON materialization_history(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_materialization_history_estado ON materialization_history(estado);

-- Comentarios
COMMENT ON TABLE materialization_history IS 'Almacena el historial de materializaciones ejecutadas';
COMMENT ON COLUMN materialization_history.id IS 'Identificador único';
COMMENT ON COLUMN materialization_history.materializacion_id IS 'ID de la materialización asociada';
COMMENT ON COLUMN materialization_history.tabla_id IS 'ID de la tabla materializada (si aplica)';
COMMENT ON COLUMN materialization_history.destino_id IS 'ID del destino de materialización';
COMMENT ON COLUMN materialization_history.servidor_id IS 'ID del servidor que ejecutó la materialización';
COMMENT ON COLUMN materialization_history.fecha_inicio IS 'Fecha y hora de inicio de la materialización';
COMMENT ON COLUMN materialization_history.fecha_fin IS 'Fecha y hora de finalización de la materialización';
COMMENT ON COLUMN materialization_history.tamaño_datos IS 'Tamaño en bytes de los datos materializados';
COMMENT ON COLUMN materialization_history.filas_procesadas IS 'Número de filas procesadas';
COMMENT ON COLUMN materialization_history.estado IS 'Estado: iniciado, completado, error, cancelado';
COMMENT ON COLUMN materialization_history.mensaje_error IS 'Mensaje de error en caso de fallo';
COMMENT ON COLUMN materialization_history.metricas IS 'Métricas de rendimiento en formato JSON';
COMMENT ON COLUMN materialization_history.creado_en IS 'Fecha y hora de creación del registro';
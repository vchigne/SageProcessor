-- Migración: Crear tabla materialization_tables
-- Esta tabla almacena la configuración de cada tabla detectada en YAML

CREATE TABLE IF NOT EXISTS materialization_tables (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER NOT NULL REFERENCES materializations(id) ON DELETE CASCADE,
    archivo_fuente VARCHAR(255) NOT NULL,
    nombre_tabla VARCHAR(255) NOT NULL,
    esquema_definido JSONB NOT NULL,
    clave_primaria TEXT[] NOT NULL,
    partitioning JSONB,
    update_strategy VARCHAR(50) NOT NULL DEFAULT 'upsert' CHECK (update_strategy IN ('upsert', 'delete_insert', 'append_only', 'truncate_insert')),
    configuracion JSONB,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_materialization_tables_materializacion_id ON materialization_tables(materializacion_id);
CREATE INDEX IF NOT EXISTS idx_materialization_tables_activo ON materialization_tables(activo);
CREATE INDEX IF NOT EXISTS idx_materialization_tables_update_strategy ON materialization_tables(update_strategy);

-- Comentarios
COMMENT ON TABLE materialization_tables IS 'Almacena la configuración de cada tabla detectada en YAML';
COMMENT ON COLUMN materialization_tables.id IS 'Identificador único';
COMMENT ON COLUMN materialization_tables.materializacion_id IS 'ID de la materialización asociada';
COMMENT ON COLUMN materialization_tables.archivo_fuente IS 'Nombre del archivo fuente en el YAML';
COMMENT ON COLUMN materialization_tables.nombre_tabla IS 'Nombre de la tabla en el destino';
COMMENT ON COLUMN materialization_tables.esquema_definido IS 'Esquema de la tabla en formato JSON (columnas, tipos, etc.)';
COMMENT ON COLUMN materialization_tables.clave_primaria IS 'Array de columnas que forman la clave primaria';
COMMENT ON COLUMN materialization_tables.partitioning IS 'Configuración de particionamiento en formato JSON';
COMMENT ON COLUMN materialization_tables.update_strategy IS 'Estrategia de actualización: upsert, delete_insert, append_only, truncate_insert';
COMMENT ON COLUMN materialization_tables.configuracion IS 'Configuración adicional en formato JSON';
COMMENT ON COLUMN materialization_tables.activo IS 'Indica si la tabla está activa';
COMMENT ON COLUMN materialization_tables.creado_en IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN materialization_tables.modificado_en IS 'Fecha y hora de última modificación';
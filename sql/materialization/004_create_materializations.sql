-- Tabla principal para materializaciones
CREATE TABLE IF NOT EXISTS materializaciones (
    id SERIAL PRIMARY KEY,
    casilla_id INTEGER NOT NULL REFERENCES data_boxes(id),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    configuracion_general JSONB DEFAULT '{}',
    ultimo_analisis TIMESTAMP WITH TIME ZONE,
    ultima_materializacion TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'pendiente',
    servidor_id INTEGER REFERENCES materializacion_servidores(id),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla para definir las tablas de cada materialización
CREATE TABLE IF NOT EXISTS materializacion_tablas (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER NOT NULL REFERENCES materializaciones(id) ON DELETE CASCADE,
    archivo_fuente VARCHAR(255) NOT NULL,
    nombre_tabla VARCHAR(255) NOT NULL,
    esquema_definido JSONB NOT NULL,
    clave_primaria VARCHAR(255)[] DEFAULT '{}',
    partitioning JSONB DEFAULT '{}',
    update_strategy VARCHAR(50) DEFAULT 'append' CHECK (update_strategy IN ('upsert', 'delete_insert', 'append', 'truncate_insert')),
    configuracion JSONB DEFAULT '{}',
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla para destinos de materialización
CREATE TABLE IF NOT EXISTS materializacion_destinos (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER NOT NULL REFERENCES materializaciones(id) ON DELETE CASCADE,
    tipo_destino VARCHAR(50) NOT NULL CHECK (tipo_destino IN ('cloud', 'database')),
    destino_id INTEGER NOT NULL,
    formato VARCHAR(50) DEFAULT 'parquet' CHECK (formato IN ('parquet', 'iceberg', 'hudi', 'csv', 'json')),
    configuracion JSONB DEFAULT '{}',
    ultimo_refresh TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'pendiente',
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT check_destino_tipo CHECK (
        (tipo_destino = 'cloud' AND EXISTS (
            SELECT 1 FROM clouds WHERE id = destino_id
        )) OR
        (tipo_destino = 'database' AND EXISTS (
            SELECT 1 FROM database_connections WHERE id = destino_id
        ))
    )
);

-- Tabla para historial de materializaciones
CREATE TABLE IF NOT EXISTS materializacion_historial (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER NOT NULL REFERENCES materializaciones(id),
    tabla_id INTEGER REFERENCES materializacion_tablas(id),
    destino_id INTEGER REFERENCES materializacion_destinos(id),
    servidor_id INTEGER REFERENCES materializacion_servidores(id),
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    tamano_datos BIGINT,
    filas_procesadas INTEGER,
    estado VARCHAR(50) NOT NULL,
    mensaje_error TEXT,
    metricas JSONB DEFAULT '{}'
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_materializaciones_casilla_id ON materializaciones (casilla_id);
CREATE INDEX IF NOT EXISTS idx_materializaciones_servidor_id ON materializaciones (servidor_id);
CREATE INDEX IF NOT EXISTS idx_materializacion_tablas_materializacion_id ON materializacion_tablas (materializacion_id);
CREATE INDEX IF NOT EXISTS idx_materializacion_destinos_materializacion_id ON materializacion_destinos (materializacion_id);
CREATE INDEX IF NOT EXISTS idx_materializacion_destinos_tipo_destino ON materializacion_destinos (tipo_destino);
CREATE INDEX IF NOT EXISTS idx_materializacion_historial_materializacion_id ON materializacion_historial (materializacion_id);
CREATE INDEX IF NOT EXISTS idx_materializacion_historial_estado ON materializacion_historial (estado);
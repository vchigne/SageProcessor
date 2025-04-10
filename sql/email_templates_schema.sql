-- Esquema para el sistema de plantillas de email SAGE
-- Creado: 10/04/2025

-- Tabla para almacenar las plantillas de email
CREATE TABLE IF NOT EXISTS plantillas_email (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL, -- 'notificacion', 'respuesta_daemon', etc.
    subtipo VARCHAR(50), -- 'detallado', 'resumido_emisor', etc.
    variante VARCHAR(50) DEFAULT 'standard', -- 'standard', 'marketing', etc.
    canal VARCHAR(50) DEFAULT 'email', -- 'email', 'whatsapp', 'telegram', etc.
    idioma VARCHAR(10) DEFAULT 'es',
    asunto VARCHAR(200), -- Para email
    contenido_html TEXT, -- Para email
    contenido_texto TEXT, -- Versión texto plano
    es_predeterminada BOOLEAN DEFAULT FALSE, -- Si es la plantilla predeterminada
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creador_id INTEGER,
    version INTEGER DEFAULT 1,
    estado VARCHAR(20) DEFAULT 'activo', -- 'activo', 'borrador', 'inactivo'
    UNIQUE(tipo, subtipo, variante, canal, idioma, es_predeterminada)
);

-- Comentarios para documentación
COMMENT ON TABLE plantillas_email IS 'Almacena plantillas para comunicaciones por email y otros canales';
COMMENT ON COLUMN plantillas_email.tipo IS 'Tipo principal de la plantilla (notificacion, respuesta_daemon, etc.)';
COMMENT ON COLUMN plantillas_email.subtipo IS 'Subtipo específico (detallado, resumido_emisor, etc.)';
COMMENT ON COLUMN plantillas_email.es_predeterminada IS 'Indica si esta es la plantilla predeterminada para su tipo/subtipo';

-- Verificar si existe la tabla suscripciones antes de añadir la columna
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suscripciones') THEN
        -- Verificar si la columna ya existe antes de intentar crearla
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'suscripciones' AND column_name = 'plantilla_id') THEN
            ALTER TABLE suscripciones ADD COLUMN plantilla_id INTEGER REFERENCES plantillas_email(id);
            COMMENT ON COLUMN suscripciones.plantilla_id IS 'Referencia a la plantilla preferida del suscriptor';
        END IF;
    END IF;
END $$;

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_plantillas_email_tipo_subtipo 
ON plantillas_email(tipo, subtipo);

CREATE INDEX IF NOT EXISTS idx_plantillas_email_predeterminada 
ON plantillas_email(es_predeterminada);

-- Plantillas predeterminadas para carga inicial
-- Para cargar estas plantillas, ejecutar el script 'initialize_templates_db.py'
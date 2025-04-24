-- Agregar nuevos campos a la tabla de emisores

-- Agregar campo codigo_interno (formato compatible con buckets)
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS codigo_interno VARCHAR(25) UNIQUE;

-- Agregar campo para código de agente Merlin
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS codigo_agente_merlin VARCHAR(25);

-- Agregar campos para tipo de origen de datos
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS tipo_origen VARCHAR(20) CHECK (tipo_origen IN ('sftp', 'bucket', NULL));

-- Campos para conexión SFTP
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS sftp_servidor VARCHAR(255);
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS sftp_puerto INTEGER DEFAULT 22;
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS sftp_usuario VARCHAR(255);
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS sftp_clave VARCHAR(255);
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS sftp_directorio VARCHAR(255);

-- Campos para conexión a Bucket
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS cloud_secret_id INTEGER REFERENCES cloud_secrets(id) ON DELETE SET NULL;
ALTER TABLE public.emisores ADD COLUMN IF NOT EXISTS bucket_nombre VARCHAR(255);

-- Índice para búsqueda rápida por código interno
CREATE INDEX IF NOT EXISTS idx_emisores_codigo_interno ON public.emisores(codigo_interno);

-- Índice no único para el código de agente Merlin (para futuras relaciones)
CREATE INDEX IF NOT EXISTS idx_emisores_codigo_agente_merlin ON public.emisores(codigo_agente_merlin);

-- Comentarios para documentar los nuevos campos
COMMENT ON COLUMN public.emisores.codigo_interno IS 'Código interno único del emisor (compatible con formato de bucket: letras minúsculas, números, puntos)';
COMMENT ON COLUMN public.emisores.codigo_agente_merlin IS 'Código de agente Merlin para extracción (para futura integración)';
COMMENT ON COLUMN public.emisores.tipo_origen IS 'Tipo de origen de datos: sftp, bucket, o null';
COMMENT ON COLUMN public.emisores.sftp_servidor IS 'Servidor SFTP';
COMMENT ON COLUMN public.emisores.sftp_puerto IS 'Puerto SFTP (por defecto 22)';
COMMENT ON COLUMN public.emisores.sftp_usuario IS 'Usuario SFTP';
COMMENT ON COLUMN public.emisores.sftp_clave IS 'Clave SFTP (encriptada)';
COMMENT ON COLUMN public.emisores.sftp_directorio IS 'Directorio en el servidor SFTP';
COMMENT ON COLUMN public.emisores.cloud_secret_id IS 'ID del secreto cloud (referencia a cloud_secrets)';
COMMENT ON COLUMN public.emisores.bucket_nombre IS 'Nombre del bucket en el servicio cloud';
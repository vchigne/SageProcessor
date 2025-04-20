-- Tabla para gestionar secretos de nube independientes de los proveedores
CREATE TABLE IF NOT EXISTS cloud_secrets (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL,
    secretos JSONB NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creación de índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_cloud_secrets_tipo ON cloud_secrets(tipo);
CREATE INDEX IF NOT EXISTS idx_cloud_secrets_activo ON cloud_secrets(activo);

-- Modificar la tabla de proveedores para permitir referencia opcional a secretos
ALTER TABLE cloud_providers ADD COLUMN IF NOT EXISTS secreto_id INTEGER REFERENCES cloud_secrets(id);

-- Comentarios para documentación
COMMENT ON TABLE cloud_secrets IS 'Almacena credenciales de acceso a servicios cloud separadas de los proveedores';
COMMENT ON COLUMN cloud_secrets.id IS 'Identificador único del secreto';
COMMENT ON COLUMN cloud_secrets.nombre IS 'Nombre descriptivo del secreto';
COMMENT ON COLUMN cloud_secrets.descripcion IS 'Descripción detallada del propósito del secreto';
COMMENT ON COLUMN cloud_secrets.tipo IS 'Tipo de proveedor (minio, s3, azure, gcp, sftp)';
COMMENT ON COLUMN cloud_secrets.secretos IS 'Credenciales en formato JSON (access_key, secret_key, etc.)';
COMMENT ON COLUMN cloud_secrets.activo IS 'Indica si el secreto está habilitado para uso';
COMMENT ON COLUMN cloud_providers.secreto_id IS 'Referencia opcional a un secreto reutilizable';
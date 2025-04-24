-- Migración para añadir campos de subdirectorio SFTP y prefijo bucket a la tabla emisores_por_casilla
-- Esta migración añade la capacidad de especificar subdirectorios y prefijos específicos
-- al vincular emisores con casillas.

-- Añadir campo para subdirectorio SFTP del emisor
ALTER TABLE emisores_por_casilla 
ADD COLUMN emisor_sftp_subdirectorio VARCHAR(255);

-- Añadir campo para prefijo de bucket del emisor
ALTER TABLE emisores_por_casilla 
ADD COLUMN emisor_bucket_prefijo VARCHAR(255);

-- Comentarios en la tabla
COMMENT ON COLUMN emisores_por_casilla.emisor_sftp_subdirectorio IS 'Subdirectorio específico dentro del SFTP del emisor para esta casilla';
COMMENT ON COLUMN emisores_por_casilla.emisor_bucket_prefijo IS 'Prefijo específico dentro del bucket del emisor para esta casilla';
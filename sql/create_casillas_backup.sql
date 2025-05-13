-- Crear tabla para almacenar backups de YAML
CREATE TABLE IF NOT EXISTS casillas_backup (
  id SERIAL PRIMARY KEY,
  casilla_id UUID NOT NULL,
  nombre_backup VARCHAR(255) NOT NULL,
  yaml_contenido TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_casilla FOREIGN KEY (casilla_id) REFERENCES casillas(id) ON DELETE CASCADE
);

-- Crear índice para mejorar las búsquedas por casilla_id
CREATE INDEX IF NOT EXISTS idx_casillas_backup_casilla_id ON casillas_backup(casilla_id);

-- Crear índice para ordenar por fecha de creación
CREATE INDEX IF NOT EXISTS idx_casillas_backup_created_at ON casillas_backup(created_at);

-- Comentarios para documentar la tabla
COMMENT ON TABLE casillas_backup IS 'Almacena backups históricos del contenido YAML de casillas';
COMMENT ON COLUMN casillas_backup.id IS 'Identificador único del backup';
COMMENT ON COLUMN casillas_backup.casilla_id IS 'ID de la casilla a la que pertenece el backup';
COMMENT ON COLUMN casillas_backup.nombre_backup IS 'Nombre descriptivo del backup (incluye timestamp)';
COMMENT ON COLUMN casillas_backup.yaml_contenido IS 'Contenido completo del YAML respaldado';
COMMENT ON COLUMN casillas_backup.created_at IS 'Fecha y hora de creación del backup';
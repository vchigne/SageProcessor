import os

# Asegurarse de que el directorio docker/init-scripts existe
os.makedirs('docker/init-scripts', exist_ok=True)

# Contenido del archivo init-db.sh
init_db_content = """#!/bin/bash
set -e

echo "Executing database initialization script..."

# Verifica si la base de datos ya existe
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Crear extensiones necesarias
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Crear esquema si no existe
    CREATE SCHEMA IF NOT EXISTS public;
EOSQL

echo "Database initialization completed!"
"""

# Escribir el contenido al archivo
with open('docker/init-scripts/init-db.sh', 'w') as f:
    f.write(init_db_content)

print("Script de inicialización creado exitosamente en docker/init-scripts/init-db.sh")
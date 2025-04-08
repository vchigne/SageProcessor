#!/bin/bash
set -e

echo "Executing database initialization script..."

# Verifica si la base de datos ya existe
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Crear extensiones necesarias
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Crear esquema si no existe
    CREATE SCHEMA IF NOT EXISTS public;
EOSQL

# Ejecutar script SQL de backup si existe
if [ -f "/docker-entrypoint-sql/backup_completo.sql" ]; then
    echo "Importing database backup..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-sql/backup_completo.sql
fi

echo "Database initialization completed!"

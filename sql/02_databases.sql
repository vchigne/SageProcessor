-- Crear tabla para bases de datos en los servidores
CREATE TABLE duckdb_databases (
    id INTEGER PRIMARY KEY,
    server_id INTEGER,
    database_name VARCHAR(255) NOT NULL,
    database_path VARCHAR(255) NOT NULL,
    size_mb DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
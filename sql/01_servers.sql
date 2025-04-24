-- Crear tabla de ejemplo para servidores DuckDB
CREATE TABLE IF NOT EXISTS duckdb_servers (
    id INTEGER PRIMARY KEY,
    server_name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar algunos datos de ejemplo
INSERT INTO duckdb_servers (id, server_name, host, port)
VALUES 
    (1, 'duckdb-server-1', 'server1.example.com', 9000),
    (2, 'duckdb-server-2', 'server2.example.com', 9000),
    (3, 'duckdb-server-3', 'server3.example.com', 9000);
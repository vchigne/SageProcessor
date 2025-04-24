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

-- Crear tabla para bases de datos en los servidores
CREATE TABLE IF NOT EXISTS duckdb_databases (
    id INTEGER PRIMARY KEY,
    server_id INTEGER,
    database_name VARCHAR(255) NOT NULL,
    database_path VARCHAR(255) NOT NULL,
    size_mb DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla para métricas de servidor
CREATE TABLE IF NOT EXISTS server_metrics (
    id INTEGER PRIMARY KEY,
    server_id INTEGER,
    cpu_usage DOUBLE PRECISION,
    memory_usage DOUBLE PRECISION,
    disk_usage DOUBLE PRECISION,
    query_count INTEGER DEFAULT 0,
    active_connections INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar algunos datos de ejemplo
INSERT INTO duckdb_servers (id, server_name, host, port)
VALUES 
    (1, 'duckdb-server-1', 'server1.example.com', 9000),
    (2, 'duckdb-server-2', 'server2.example.com', 9000),
    (3, 'duckdb-server-3', 'server3.example.com', 9000);

-- Insertar algunas bases de datos de ejemplo
INSERT INTO duckdb_databases (id, server_id, database_name, database_path, size_mb)
VALUES 
    (1, 1, 'analytics', '/data/analytics.duckdb', 125.5),
    (2, 1, 'reporting', '/data/reporting.duckdb', 78.2),
    (3, 2, 'marketing', '/data/marketing.duckdb', 256.7),
    (4, 3, 'sales', '/data/sales.duckdb', 198.3);

-- Insertar algunas métricas de ejemplo
INSERT INTO server_metrics (id, server_id, cpu_usage, memory_usage, disk_usage, query_count, active_connections)
VALUES 
    (1, 1, 45.2, 62.5, 58.7, 1250, 8),
    (2, 2, 32.8, 48.2, 72.1, 980, 5),
    (3, 3, 67.3, 78.9, 45.6, 1560, 12);
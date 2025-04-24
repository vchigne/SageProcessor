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

-- Insertar algunas métricas de ejemplo
INSERT INTO server_metrics (id, server_id, cpu_usage, memory_usage, disk_usage, query_count, active_connections)
VALUES 
    (1, 1, 45.2, 62.5, 58.7, 1250, 8),
    (2, 2, 32.8, 48.2, 72.1, 980, 5),
    (3, 3, 67.3, 78.9, 45.6, 1560, 12);
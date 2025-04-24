-- Insertar algunas bases de datos de ejemplo
INSERT INTO duckdb_databases (id, server_id, database_name, database_path, size_mb)
VALUES 
    (1, 1, 'analytics', '/data/analytics.duckdb', 125.5),
    (2, 1, 'reporting', '/data/reporting.duckdb', 78.2),
    (3, 2, 'marketing', '/data/marketing.duckdb', 256.7),
    (4, 3, 'sales', '/data/sales.duckdb', 198.3);
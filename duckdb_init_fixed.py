#!/usr/bin/env python3
"""
Inicializador de DuckDB para el enjambre (swarm) de servidores DuckDB
"""
import os
import duckdb
from yato import Yato

def main():
    # Crear el directorio de datos si no existe
    os.makedirs('duckdb_data', exist_ok=True)
    
    # Conexión a DuckDB
    db_path = 'duckdb_data/analytics.duckdb'
    print(f"Conectando a la base de datos DuckDB en: {db_path}")
    
    # Inicializar la base de datos con las tablas y datos de ejemplo
    try:
        conn = duckdb.connect(db_path)
        print("Conexión establecida exitosamente")
        
        # Crear tabla de servidores DuckDB
        print("Creando tabla de servidores DuckDB...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS duckdb_servers (
                id INTEGER PRIMARY KEY,
                hostname VARCHAR(255) NOT NULL,
                port INTEGER DEFAULT 1294,
                status VARCHAR(50) DEFAULT 'active',
                server_type VARCHAR(50) DEFAULT 'general',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insertar datos de ejemplo en la tabla de servidores
        print("Insertando datos en la tabla de servidores...")
        conn.execute("""
            INSERT INTO duckdb_servers (id, hostname, port, status, server_type)
            VALUES 
                (1, 'duckdb-server-01', 1294, 'active', 'analytics'),
                (2, 'duckdb-server-02', 1295, 'active', 'reporting'),
                (3, 'duckdb-server-03', 1296, 'standby', 'backup')
        """)
        
        # Crear tabla de bases de datos (usando nombre alternativo para evitar el error)
        print("Creando tabla de bases de datos...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS db_instances (
                id INTEGER PRIMARY KEY,
                server_id INTEGER,
                database_name VARCHAR(255) NOT NULL,
                database_path VARCHAR(255) NOT NULL,
                size_mb DOUBLE PRECISION DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insertar datos de ejemplo en la tabla de bases de datos
        print("Insertando datos en la tabla de bases de datos...")
        conn.execute("""
            INSERT INTO db_instances (id, server_id, database_name, database_path, size_mb)
            VALUES 
                (1, 1, 'analytics', '/data/analytics.duckdb', 125.5),
                (2, 1, 'reporting', '/data/reporting.duckdb', 78.2),
                (3, 2, 'marketing', '/data/marketing.duckdb', 256.7),
                (4, 3, 'sales', '/data/sales.duckdb', 198.3)
        """)
        
        # Crear tabla para métricas de servidor
        print("Creando tabla de métricas de servidor...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS server_metrics (
                id INTEGER PRIMARY KEY,
                server_id INTEGER,
                cpu_usage DOUBLE PRECISION,
                memory_usage DOUBLE PRECISION,
                disk_usage DOUBLE PRECISION,
                query_count INTEGER DEFAULT 0,
                active_connections INTEGER DEFAULT 0,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insertar datos de ejemplo en la tabla de métricas
        print("Insertando datos en la tabla de métricas...")
        conn.execute("""
            INSERT INTO server_metrics (id, server_id, cpu_usage, memory_usage, disk_usage, query_count, active_connections)
            VALUES 
                (1, 1, 45.2, 62.5, 58.7, 1250, 8),
                (2, 2, 32.8, 48.2, 72.1, 980, 5),
                (3, 3, 67.3, 78.9, 45.6, 1560, 12)
        """)
        
        # Verificar las tablas creadas
        result = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
        print("Tablas creadas:", [r[0] for r in result])
        
        # Ver datos de ejemplo
        for table in [r[0] for r in result]:
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"Registros en tabla {table}: {count}")
        
        # Inicializar Yato para orquestar transformaciones
        try:
            print("Configurando Yato para orquestar transformaciones SQL...")
            yato = Yato(
                database_path=db_path,
                sql_folder="sql/",
                schema="transform"
            )
            print("Configuración de Yato completada")
        except Exception as e:
            print(f"Error al configurar Yato: {e}")
        
        print("Inicialización completada")
        
    except Exception as e:
        print(f"Error durante la inicialización: {e}")
    finally:
        if 'conn' in locals():
            conn.close()
            print("Conexión cerrada")

if __name__ == "__main__":
    main()
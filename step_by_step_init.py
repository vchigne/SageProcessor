#!/usr/bin/env python3
"""
Script que inicializa DuckDB paso a paso para identificar donde está el error
"""
import os
import duckdb

def main():
    # Crear el directorio de datos si no existe
    os.makedirs('duckdb_data', exist_ok=True)
    
    # Conexión a DuckDB
    db_path = 'duckdb_data/analytics.duckdb'
    print(f"Conectando a la base de datos DuckDB en: {db_path}")
    
    try:
        # Crear conexión
        conn = duckdb.connect(db_path)
        print("Conexión establecida exitosamente")
        
        # Paso 1: Listar tablas existentes
        print("\nPaso 1: Tablas existentes antes de comenzar")
        result = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
        print("Tablas existentes:", [r[0] for r in result])
        
        # Paso 2: Crear tabla duckdb_servers
        print("\nPaso 2: Crear tabla duckdb_servers")
        try:
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
            print("Tabla duckdb_servers creada exitosamente")
        except Exception as e:
            print(f"Error al crear tabla duckdb_servers: {e}")
        
        # Paso 3: Verificar tabla creada
        print("\nPaso 3: Verificar tabla creada")
        result = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
        print("Tablas después de crear duckdb_servers:", [r[0] for r in result])
        
        # Paso 4: Crear tabla duckdb_databases
        print("\nPaso 4: Crear tabla duckdb_databases")
        try:
            conn.execute("""
                CREATE TABLE duckdb_databases (
                    id INTEGER PRIMARY KEY,
                    server_id INTEGER,
                    database_name VARCHAR(255),
                    database_path VARCHAR(255),
                    size_mb DOUBLE,
                    created_at TIMESTAMP,
                    last_updated TIMESTAMP
                )
            """)
            print("Tabla duckdb_databases creada exitosamente")
        except Exception as e:
            print(f"Error al crear tabla duckdb_databases: {e}")
        
        # Paso 5: Verificar tablas después de crear duckdb_databases
        print("\nPaso 5: Verificar tablas después de crear duckdb_databases")
        result = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
        print("Tablas después de crear duckdb_databases:", [r[0] for r in result])
        
        # Paso 6: Intentar con un nombre de tabla diferente
        print("\nPaso 6: Intentar con un nombre de tabla diferente")
        try:
            conn.execute("""
                CREATE TABLE db_instances (
                    id INTEGER PRIMARY KEY,
                    server_id INTEGER,
                    database_name VARCHAR(255),
                    database_path VARCHAR(255)
                )
            """)
            print("Tabla db_instances creada exitosamente")
        except Exception as e:
            print(f"Error al crear tabla db_instances: {e}")
        
        # Paso 7: Verificar tablas finales
        print("\nPaso 7: Verificar tablas finales")
        result = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
        print("Tablas finales:", [r[0] for r in result])
        
    except Exception as e:
        print(f"Error general: {e}")
    finally:
        if 'conn' in locals():
            conn.close()
            print("\nConexión cerrada")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Inicializador de DuckDB para el enjambre (swarm) de servidores DuckDB
"""
import os
import duckdb
from yato import Yato
import glob

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
        
        # Obtener los archivos SQL ordenados por número
        sql_files = sorted(glob.glob('sql/[0-9]*_*.sql'))
        print(f"Archivos SQL encontrados: {sql_files}")
        
        # Ejecutar cada archivo SQL en orden
        for sql_file in sql_files:
            try:
                print(f"Ejecutando archivo SQL: {sql_file}...")
                
                # Leer el contenido del archivo
                with open(sql_file, 'r') as f:
                    sql_content = f.read()
                
                # Ejecutar el SQL
                conn.execute(sql_content)
                print(f"Archivo {sql_file} ejecutado con éxito")
            except Exception as e:
                print(f"Error al ejecutar {sql_file}: {e}")
        
        # Verificar las tablas creadas
        try:
            result = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
            print("Tablas creadas:", [r[0] for r in result])
            
            # Ver datos de ejemplo
            for table in [r[0] for r in result]:
                count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                print(f"Registros en tabla {table}: {count}")
        except Exception as e:
            print(f"Error al verificar las tablas: {e}")
        
        # Inicializar Yato para orquestar transformaciones
        try:
            print("Configurando Yato para orquestar transformaciones SQL...")
            yato = Yato(
                database_path=db_path,
                sql_folder="sql/",
                schema="transform"
            )
            
            # Ejecutar las transformaciones (si hubiera archivos SQL adicionales)
            # yato.run()
            
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
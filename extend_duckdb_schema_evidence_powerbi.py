#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extender el esquema de DuckDB con las tablas necesarias para:
1. Gestión de proyectos Evidence.dev
2. Gestión de datasets PowerBI
"""

import os
import sys
import uuid
import logging
import datetime
import duckdb

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('extend_schema_evidence_powerbi')

# Ruta de la base de datos
DUCKDB_PATH = os.environ.get('DUCKDB_PATH', 'duckdb_data/duckdb_swarm.db')

def create_base_tables(conn):
    """Crea las tablas base necesarias"""
    logger.info("Creando tablas base (servidores y bases de datos)...")
    
    # Tabla de servidores DuckDB
    conn.execute("""
        CREATE TABLE IF NOT EXISTS servers (
            id VARCHAR PRIMARY KEY,
            name VARCHAR NOT NULL,
            host VARCHAR NOT NULL,
            port INTEGER NOT NULL,
            api_key VARCHAR,
            description VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR DEFAULT 'active',
            is_local BOOLEAN DEFAULT FALSE,
            connection_string VARCHAR
        )
    """)
    
    # Tabla de bases de datos
    conn.execute("""
        CREATE TABLE IF NOT EXISTS databases (
            id VARCHAR PRIMARY KEY,
            server_id VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            description VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR DEFAULT 'active',
            path VARCHAR,
            FOREIGN KEY (server_id) REFERENCES servers(id)
        )
    """)
    
    # Insertar el servidor local si no existe
    result = conn.execute("SELECT COUNT(*) FROM servers WHERE name = 'local'").fetchone()
    if result[0] == 0:
        logger.info("Agregando servidor local...")
        server_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO servers (id, name, host, port, description, is_local, status)
            VALUES (?, 'local', 'localhost', 5001, 'Servidor local DuckDB', TRUE, 'active')
        """, [server_id])
        
        # Agregar una base de datos local
        conn.execute("""
            INSERT INTO databases (id, server_id, name, description, path, status)
            VALUES (?, ?, 'main', 'Base de datos principal', 'duckdb_data/duckdb_swarm.db', 'active')
        """, [str(uuid.uuid4()), server_id])

def create_evidence_tables(conn):
    """Crea las tablas para la gestión de Evidence.dev"""
    logger.info("Creando tablas para Evidence.dev...")
    
    # Tabla de proyectos Evidence.dev
    conn.execute("""
        CREATE TABLE IF NOT EXISTS evidence_projects (
            id VARCHAR PRIMARY KEY,
            name VARCHAR NOT NULL,
            description VARCHAR,
            folder_path VARCHAR NOT NULL,
            git_repo VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR,
            status VARCHAR DEFAULT 'active'
        )
    """)
    
    # Tabla para las fuentes de datos
    conn.execute("""
        CREATE TABLE IF NOT EXISTS evidence_data_sources (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            database_id VARCHAR NOT NULL,
            query VARCHAR NOT NULL,
            description VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES evidence_projects(id),
            FOREIGN KEY (database_id) REFERENCES databases(id)
        )
    """)
    
    # Tabla para los reportes
    conn.execute("""
        CREATE TABLE IF NOT EXISTS evidence_reports (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            path VARCHAR NOT NULL,
            description VARCHAR,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR,
            FOREIGN KEY (project_id) REFERENCES evidence_projects(id)
        )
    """)
    
    # Tabla para los builds/despliegues
    conn.execute("""
        CREATE TABLE IF NOT EXISTS evidence_builds (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR NOT NULL,
            version VARCHAR,
            status VARCHAR,
            build_log TEXT,
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP,
            output_path VARCHAR,
            FOREIGN KEY (project_id) REFERENCES evidence_projects(id)
        )
    """)
    
    logger.info("Tablas para Evidence.dev creadas correctamente")

def create_powerbi_tables(conn):
    """Crea las tablas para la gestión de datasets de PowerBI"""
    logger.info("Creando tablas para PowerBI...")
    
    # Tabla de datasets PowerBI
    conn.execute("""
        CREATE TABLE IF NOT EXISTS powerbi_datasets (
            id VARCHAR PRIMARY KEY,
            name VARCHAR NOT NULL,
            description VARCHAR,
            duckling_id VARCHAR NOT NULL,
            refresh_schedule VARCHAR,
            last_refresh TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR,
            status VARCHAR DEFAULT 'active',
            FOREIGN KEY (duckling_id) REFERENCES servers(id)
        )
    """)
    
    # Tabla para las tablas dentro de los datasets
    conn.execute("""
        CREATE TABLE IF NOT EXISTS powerbi_tables (
            id VARCHAR PRIMARY KEY,
            dataset_id VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            query VARCHAR NOT NULL,
            is_incremental BOOLEAN DEFAULT FALSE,
            incremental_key VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dataset_id) REFERENCES powerbi_datasets(id)
        )
    """)
    
    # Tabla para los refrescos históricos
    conn.execute("""
        CREATE TABLE IF NOT EXISTS powerbi_refresh_history (
            id VARCHAR PRIMARY KEY,
            dataset_id VARCHAR NOT NULL,
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP,
            status VARCHAR,
            error_message VARCHAR,
            rows_processed INTEGER,
            duration_ms INTEGER,
            FOREIGN KEY (dataset_id) REFERENCES powerbi_datasets(id)
        )
    """)
    
    logger.info("Tablas para PowerBI creadas correctamente")

def insert_example_data(conn):
    """Inserta datos de ejemplo para probar la funcionalidad"""
    logger.info("Insertando datos de ejemplo...")
    
    # Verificar si ya hay datos
    result = conn.execute("SELECT COUNT(*) FROM evidence_projects").fetchone()
    if result[0] > 0:
        logger.info("Ya existen datos de ejemplo para Evidence.dev, omitiendo...")
    else:
        # Crear un proyecto de ejemplo para Evidence.dev
        project_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO evidence_projects (id, name, description, folder_path, git_repo, created_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            project_id,
            "Dashboard de Ventas",
            "Dashboard para análisis de ventas y productos",
            "evidence/ventas",
            None,
            "admin",
            "active"
        ])
        
        # Obtener el id de la base de datos local (si existe)
        result = conn.execute("SELECT id FROM servers WHERE name = 'local' LIMIT 1").fetchone()
        server_id = result[0] if result else str(uuid.uuid4())
        
        # Obtener el id de una base de datos (si existe)
        result = conn.execute("SELECT id FROM databases LIMIT 1").fetchone()
        database_id = result[0] if result else str(uuid.uuid4())
        
        # Crear una fuente de datos
        conn.execute("""
            INSERT INTO evidence_data_sources (id, project_id, name, database_id, query, description)
            VALUES (?, ?, ?, ?, ?, ?)
        """, [
            str(uuid.uuid4()),
            project_id,
            "Ventas Mensuales",
            database_id,
            "SELECT * FROM ventas_mensuales",
            "Consulta de ventas agrupadas por mes"
        ])
        
        # Crear un reporte
        conn.execute("""
            INSERT INTO evidence_reports (id, project_id, name, path, description, content, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            str(uuid.uuid4()),
            project_id,
            "Reporte de Ventas",
            "/ventas",
            "Reporte principal de ventas",
            "# Ventas Mensuales\n\n```sql ventas\nSELECT * FROM ventas_mensuales\n```\n\n<BarChart data={ventas} x=mes y=ventas />",
            "admin"
        ])
        
        logger.info("Datos de ejemplo para Evidence.dev insertados correctamente")
    
    # Verificar si ya hay datos para PowerBI
    result = conn.execute("SELECT COUNT(*) FROM powerbi_datasets").fetchone()
    if result[0] > 0:
        logger.info("Ya existen datos de ejemplo para PowerBI, omitiendo...")
    else:
        # Obtener el id del servidor local (si existe)
        result = conn.execute("SELECT id FROM servers WHERE name = 'local' LIMIT 1").fetchone()
        server_id = result[0] if result else str(uuid.uuid4())
        
        # Crear un dataset de ejemplo para PowerBI
        dataset_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO powerbi_datasets (id, name, description, duckling_id, refresh_schedule, created_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            dataset_id,
            "Dataset de Ventas",
            "Dataset para el reporte de ventas en PowerBI",
            server_id,
            "0 0 * * *",  # Todos los días a medianoche
            "admin",
            "active"
        ])
        
        # Crear tablas para el dataset
        conn.execute("""
            INSERT INTO powerbi_tables (id, dataset_id, name, query, is_incremental, incremental_key)
            VALUES (?, ?, ?, ?, ?, ?)
        """, [
            str(uuid.uuid4()),
            dataset_id,
            "Ventas",
            "SELECT * FROM ventas",
            False,
            None
        ])
        
        conn.execute("""
            INSERT INTO powerbi_tables (id, dataset_id, name, query, is_incremental, incremental_key)
            VALUES (?, ?, ?, ?, ?, ?)
        """, [
            str(uuid.uuid4()),
            dataset_id,
            "Productos",
            "SELECT * FROM productos",
            False,
            None
        ])
        
        logger.info("Datos de ejemplo para PowerBI insertados correctamente")

def main():
    """Función principal"""
    try:
        # Verificar que exista el directorio para la base de datos
        os.makedirs(os.path.dirname(DUCKDB_PATH), exist_ok=True)
        
        # Conectar a la base de datos
        logger.info(f"Conectando a la base de datos en {DUCKDB_PATH}")
        conn = duckdb.connect(DUCKDB_PATH)
        
        # Crear tablas base
        create_base_tables(conn)
        
        # Crear tablas para Evidence.dev
        create_evidence_tables(conn)
        
        # Crear tablas para PowerBI
        create_powerbi_tables(conn)
        
        # Insertar datos de ejemplo
        insert_example_data(conn)
        
        # Mostrar las tablas creadas
        result = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
        table_names = [row[0] for row in result]
        logger.info(f"Tablas creadas: {table_names}")
        
        # Cerrar conexión
        conn.close()
        
        logger.info("Proceso completado con éxito")
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
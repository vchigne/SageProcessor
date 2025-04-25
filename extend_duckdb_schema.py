#!/usr/bin/env python3
"""
Script para extender el esquema de DuckDB con las tablas necesarias para:
1. Gestión de pipelines
2. Ejecución de pipelines
3. Gestión de reportes Evidence.dev
4. Integración con almacenamiento MinIO
"""
import os
import duckdb
import json
import time
import uuid

def main():
    # Verificar que la base de datos exista
    db_path = 'duckdb_data/analytics.duckdb'
    if not os.path.exists(db_path):
        print(f"Error: La base de datos {db_path} no existe")
        print("Ejecute primero duckdb_init_fixed.py para inicializar la base de datos")
        return False
    
    try:
        # Conectar a la base de datos
        conn = duckdb.connect(db_path)
        print("Conexión establecida exitosamente")
        
        # 1. Crear tabla para la gestión de pipelines
        print("Creando tabla de pipelines...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pipelines (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                version VARCHAR(50) DEFAULT '1.0.0',
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                schedule_type VARCHAR(50) DEFAULT 'on_demand',
                schedule_cron VARCHAR(100),
                schedule_timezone VARCHAR(50),
                input_duckling_id INTEGER,
                input_database VARCHAR(255),
                input_schema VARCHAR(255),
                output_duckling_id INTEGER,
                output_database VARCHAR(255),
                output_schema VARCHAR(255),
                output_table_prefix VARCHAR(100)
            )
        """)
        
        # 2. Crear tabla para los pasos de los pipelines
        print("Creando tabla de pasos de pipelines...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pipeline_steps (
                id VARCHAR(36) PRIMARY KEY,
                pipeline_id VARCHAR(36) NOT NULL,
                name VARCHAR(255) NOT NULL,
                step_order INTEGER NOT NULL,
                step_type VARCHAR(50) NOT NULL,
                code TEXT,
                depends_on VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
            )
        """)
        
        # 3. Crear tabla para las ejecuciones de pipelines
        print("Creando tabla de ejecuciones de pipelines...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pipeline_executions (
                id VARCHAR(36) PRIMARY KEY,
                pipeline_id VARCHAR(36) NOT NULL,
                status VARCHAR(50) NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                duckling_id INTEGER,
                triggered_by VARCHAR(255),
                parameters TEXT,
                duration_ms INTEGER,
                rows_processed INTEGER,
                memory_used_mb FLOAT,
                error_code VARCHAR(50),
                error_message TEXT,
                error_step_id VARCHAR(36),
                FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
            )
        """)
        
        # 4. Crear tabla para los logs de ejecuciones de pipelines
        print("Creando tabla de logs de ejecuciones...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS execution_logs (
                id VARCHAR(36) PRIMARY KEY,
                execution_id VARCHAR(36) NOT NULL,
                step_id VARCHAR(36),
                log_level VARCHAR(20) NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (execution_id) REFERENCES pipeline_executions(id)
            )
        """)
        
        # 5. Crear tabla para los proyectos de Evidence.dev
        print("Creando tabla de proyectos Evidence.dev...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS evidence_projects (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                template_id VARCHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                owner VARCHAR(255),
                theme VARCHAR(50),
                logo_url TEXT,
                color_scheme VARCHAR(50),
                display_options TEXT,
                git_repository_url TEXT,
                git_branch VARCHAR(100),
                git_credentials_id VARCHAR(36),
                auto_rebuild BOOLEAN DEFAULT FALSE,
                rebuild_on_data_change BOOLEAN DEFAULT FALSE,
                rebuild_schedule VARCHAR(100),
                notebook_defaults TEXT
            )
        """)
        
        # 6. Crear tabla para los reportes de Evidence.dev
        print("Creando tabla de reportes Evidence.dev...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS evidence_reports (
                id VARCHAR(36) PRIMARY KEY,
                project_id VARCHAR(36) NOT NULL,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL,
                description TEXT,
                author VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_published TIMESTAMP,
                status VARCHAR(50) DEFAULT 'draft',
                content TEXT,
                parameters TEXT,
                FOREIGN KEY (project_id) REFERENCES evidence_projects(id)
            )
        """)
        
        # 7. Crear tabla para las fuentes de datos de reportes
        print("Creando tabla de fuentes de datos para reportes...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS report_data_sources (
                id VARCHAR(36) PRIMARY KEY,
                report_id VARCHAR(36) NOT NULL,
                name VARCHAR(255) NOT NULL,
                query_id VARCHAR(36),
                pipeline_id VARCHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (report_id) REFERENCES evidence_reports(id),
                FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
            )
        """)
        
        # 8. Crear tabla para las versiones de reportes
        print("Creando tabla de versiones de reportes...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS report_versions (
                id VARCHAR(36) PRIMARY KEY,
                report_id VARCHAR(36) NOT NULL,
                version VARCHAR(50) NOT NULL,
                published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                published_by VARCHAR(255),
                snapshot_id VARCHAR(36),
                FOREIGN KEY (report_id) REFERENCES evidence_reports(id)
            )
        """)
        
        # 9. Crear tabla para los datasets de PowerBI
        print("Creando tabla de datasets PowerBI...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS powerbi_datasets (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_refreshed TIMESTAMP,
                owner VARCHAR(255),
                status VARCHAR(50) DEFAULT 'draft',
                source_type VARCHAR(50),
                source_id VARCHAR(36),
                source_config TEXT,
                schema_definition TEXT,
                refresh_schedule_type VARCHAR(50) DEFAULT 'manual',
                refresh_time VARCHAR(5),
                refresh_days TEXT,
                refresh_timezone VARCHAR(50),
                workspace_id VARCHAR(36),
                published_dataset_id VARCHAR(36),
                last_published TIMESTAMP,
                refresh_url TEXT
            )
        """)
        
        # 10. Crear tabla para los proveedores de almacenamiento
        print("Creando tabla de proveedores de almacenamiento...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS storage_providers (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                provider_type VARCHAR(50) NOT NULL,
                endpoint VARCHAR(255),
                region VARCHAR(50),
                access_key VARCHAR(255),
                secret_key VARCHAR(255),
                default_bucket VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )
        """)
        
        # 11. Crear tabla de relación entre ducklings y proveedores de almacenamiento
        print("Creando tabla de relación duckling-almacenamiento...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS duckling_storage (
                duckling_id INTEGER NOT NULL,
                storage_provider_id VARCHAR(36) NOT NULL,
                bucket_name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_primary BOOLEAN DEFAULT FALSE,
                PRIMARY KEY (duckling_id, storage_provider_id),
                FOREIGN KEY (duckling_id) REFERENCES duckdb_servers(id),
                FOREIGN KEY (storage_provider_id) REFERENCES storage_providers(id)
            )
        """)
        
        # Insertar datos de ejemplo para el pipeline
        print("Insertando datos de ejemplo para pipeline...")
        pipeline_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO pipelines (
                id, name, description, version, created_by, 
                input_duckling_id, input_database, output_duckling_id, output_database
            )
            VALUES (?, 'Transformación de ventas', 'Pipeline para transformar datos de ventas', '1.0.0', 'admin',
                    1, 'analytics', 1, 'reporting')
        """, [pipeline_id])
        
        # Insertar pasos de ejemplo para el pipeline
        print("Insertando pasos de ejemplo para pipeline...")
        conn.execute("""
            INSERT INTO pipeline_steps (id, pipeline_id, name, step_order, step_type, code)
            VALUES (?, ?, 'Limpieza de datos', 1, 'sql', 
                   'SELECT * FROM ventas WHERE monto > 0 AND fecha IS NOT NULL')
        """, [str(uuid.uuid4()), pipeline_id])
        
        conn.execute("""
            INSERT INTO pipeline_steps (id, pipeline_id, name, step_order, step_type, code)
            VALUES (?, ?, 'Agregación por región', 2, 'sql', 
                   'SELECT region, SUM(monto) as total, COUNT(*) as cantidad FROM clean_data GROUP BY region')
        """, [str(uuid.uuid4()), pipeline_id])
        
        # Insertar proyecto de Evidence.dev de ejemplo
        print("Insertando proyecto Evidence.dev de ejemplo...")
        project_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO evidence_projects (id, name, description, owner, theme)
            VALUES (?, 'Dashboard de Ventas', 'Análisis de ventas por región y producto', 'admin', 'default')
        """, [project_id])
        
        # Insertar reporte de Evidence.dev de ejemplo
        print("Insertando reporte Evidence.dev de ejemplo...")
        report_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO evidence_reports (id, project_id, name, slug, description, author, status)
            VALUES (?, ?, 'Reporte Trimestral', 'reporte-trimestral', 'Análisis del trimestre actual', 'admin', 'draft')
        """, [report_id, project_id])
        
        # Verificar las tablas creadas
        result = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
        print("Tablas existentes:", [r[0] for r in result])
        
        # Contar registros en las tablas
        all_tables = [r[0] for r in result]
        for table in all_tables:
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"Registros en tabla {table}: {count}")
        
        print("Extensión del esquema completada exitosamente")
        return True
        
    except Exception as e:
        print(f"Error durante la extensión del esquema: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()
            print("Conexión cerrada")

if __name__ == "__main__":
    main()
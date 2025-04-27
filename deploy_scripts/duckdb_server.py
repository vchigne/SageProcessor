#!/usr/bin/env python3
"""
Servidor DuckDB Flask para el enjambre (swarm) de servidores DuckDB

Este script implementa un servidor REST simple para DuckDB que proporciona:
1. Acceso remoto a bases de datos DuckDB
2. Ejecución de consultas SQL
3. Obtención de metadatos y esquemas
4. Métricas de rendimiento
5. Operaciones de sincronización

Ambiente:
- DUCKDB_PORT: Puerto en el que escucha el servidor (por defecto: 1294)
- DUCKDB_SERVER_KEY: Clave de autenticación para el servidor (opcional)
- DUCKDB_DATA_DIR: Directorio para datos de DuckDB (por defecto: ./duckdb_data)
"""

import os
import sys
import json
import time
import uuid
import logging
import tempfile
import traceback
from datetime import datetime
from functools import wraps

import duckdb
from flask import Flask, request, jsonify, g
from flask_cors import CORS

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('duckdb_server')

# Configuración del servidor
SERVER_PORT = int(os.environ.get('DUCKDB_PORT', 1294))
SERVER_KEY = os.environ.get('DUCKDB_SERVER_KEY')
DATA_DIR = os.environ.get('DUCKDB_DATA_DIR', './duckdb_data')

# Crear directorio de datos si no existe
os.makedirs(DATA_DIR, exist_ok=True)

# Ruta a la base de datos de sistema
SYSTEM_DB_PATH = os.path.join(DATA_DIR, 'system.duckdb')

# Crear la aplicación Flask
app = Flask(__name__)
CORS(app)

# Middleware de autenticación
def authenticate(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not SERVER_KEY:
            return f(*args, **kwargs)
        
        auth_key = request.headers.get('X-API-Key')
        if not auth_key:
            return jsonify({'error': 'No se proporcionó clave de API'}), 401
        
        if auth_key != SERVER_KEY:
            return jsonify({'error': 'Clave de API inválida'}), 403
        
        return f(*args, **kwargs)
    return decorated

# Utilidad para obtener conexión a la base de datos del sistema
def get_system_connection():
    conn = duckdb.connect(SYSTEM_DB_PATH)
    
    # Inicializar la base de datos del sistema si es necesaria
    try:
        # Verificar si las tablas existen
        result = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='databases'").fetchall()
        if not result:
            # Crear las tablas necesarias
            conn.execute("""
                CREATE TABLE databases (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    path VARCHAR NOT NULL,
                    description VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR DEFAULT 'active'
                )
            """)
            
            # Tabla de métricas del sistema
            conn.execute("""
                CREATE TABLE system_metrics (
                    id INTEGER PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    cpu_usage FLOAT,
                    memory_usage FLOAT,
                    disk_usage FLOAT,
                    active_connections INTEGER
                )
            """)
            
            # Tabla de consultas ejecutadas
            conn.execute("""
                CREATE TABLE query_history (
                    id INTEGER PRIMARY KEY,
                    database_id INTEGER,
                    query TEXT,
                    duration_ms INTEGER,
                    result_rows INTEGER,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR,
                    error TEXT,
                    FOREIGN KEY (database_id) REFERENCES databases(id)
                )
            """)
            
            # Tabla de sincronización con almacenamiento externo
            conn.execute("""
                CREATE TABLE sync_operations (
                    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                    database_id INTEGER,
                    operation_type VARCHAR,
                    external_uri VARCHAR,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    status VARCHAR,
                    rows_processed INTEGER,
                    error TEXT,
                    FOREIGN KEY (database_id) REFERENCES databases(id)
                )
            """)
    except Exception as e:
        logger.error(f"Error al inicializar la base de datos del sistema: {str(e)}")
        
    return conn

# Endpoint de salud para monitoreo
@app.route('/health', methods=['GET'])
def health_check():
    """Verificar la salud del servidor"""
    try:
        system_conn = get_system_connection()
        
        # Ejecutar una consulta simple para verificar que DuckDB funciona
        system_conn.execute("SELECT 1").fetchone()
        system_conn.close()
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'version': duckdb.__version__
        })
    except Exception as e:
        logger.error(f"Error en health check: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

# NUEVO ENDPOINT /status (muy simple)
@app.route('/status', methods=['GET'])
def status_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()}), 200
    
# Listar bases de datos
@app.route('/databases', methods=['GET'])
@authenticate
def list_databases():
    """Listar todas las bases de datos gestionadas por este servidor"""
    system_conn = get_system_connection()
    
    try:
        result = system_conn.execute("""
            SELECT id, name, path, description, created_at, updated_at, status
            FROM databases
            ORDER BY name
        """).fetchall()
        
        databases = []
        for row in result:
            databases.append({
                'id': row[0],
                'name': row[1],
                'path': row[2],
                'description': row[3],
                'created_at': row[4].isoformat() if row[4] else None,
                'updated_at': row[5].isoformat() if row[5] else None,
                'status': row[6]
            })
        
        return jsonify({'databases': databases})
    except Exception as e:
        logger.error(f"Error al listar bases de datos: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        system_conn.close()

# Crear base de datos
@app.route('/databases', methods=['POST'])
@authenticate
def create_database():
    """Crear una nueva base de datos"""
    data = request.json
    system_conn = get_system_connection()
    
    try:
        if not data or 'name' not in data:
            return jsonify({'error': 'Se requiere un nombre para la base de datos'}), 400
        
        # Usar el nombre para el path si no se proporciona
        path = data.get('path')
        if not path:
            path = os.path.join(DATA_DIR, f"{data['name'].lower().replace(' ', '_')}.duckdb")
            
        # Verificar si ya existe una base de datos con ese nombre
        result = system_conn.execute(
            "SELECT id FROM databases WHERE name = ?", 
            [data['name']]
        ).fetchone()
        
        if result:
            return jsonify({'error': f"Ya existe una base de datos con el nombre '{data['name']}'"}), 409
        
        # Obtener el siguiente ID
        result = system_conn.execute("SELECT MAX(id) FROM databases").fetchone()
        next_id = 1 if result[0] is None else result[0] + 1
        
        # Insertar la nueva base de datos
        system_conn.execute("""
            INSERT INTO databases (id, name, path, description)
            VALUES (?, ?, ?, ?)
        """, [
            next_id,
            data['name'],
            path,
            data.get('description')
        ])
        
        # Intentar crear la base de datos física
        try:
            # Solo crear la conexión e inicializarla
            db_conn = duckdb.connect(path)
            db_conn.close()
        except Exception as db_error:
            logger.error(f"Error al crear la base de datos física: {str(db_error)}")
            # Eliminar el registro si no se pudo crear la base de datos
            system_conn.execute("DELETE FROM databases WHERE id = ?", [next_id])
            return jsonify({'error': f"Error al crear la base de datos: {str(db_error)}"}), 500
        
        return jsonify({
            'id': next_id,
            'name': data['name'],
            'path': path,
            'description': data.get('description'),
            'created_at': datetime.now().isoformat(),
            'status': 'active'
        }), 201
    except Exception as e:
        logger.error(f"Error al crear base de datos: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        system_conn.close()

# Ejecutar consulta en una base de datos
@app.route('/databases/<int:db_id>/query', methods=['POST'])
@authenticate
def execute_query(db_id):
    """Ejecutar una consulta SQL en una base de datos específica"""
    data = request.json
    system_conn = get_system_connection()
    
    try:
        if not data or 'query' not in data:
            return jsonify({'error': 'Se requiere una consulta SQL'}), 400
        
        # Obtener la ruta de la base de datos
        result = system_conn.execute(
            "SELECT path FROM databases WHERE id = ?", 
            [db_id]
        ).fetchone()
        
        if not result:
            return jsonify({'error': f'Base de datos con ID {db_id} no encontrada'}), 404
            
        db_path = result[0]
        
        # Validar que la base de datos existe físicamente
        if not os.path.exists(db_path):
            return jsonify({'error': f'El archivo de base de datos no existe: {db_path}'}), 404
            
        # Ejecutar la consulta
        query = data['query']
        start_time = time.time()
        query_db = duckdb.connect(db_path)
        
        try:
            result = query_db.execute(query).fetchall()
            columns = query_db.execute("SELECT * FROM pragma_last_result_column_names").fetchall()
            column_names = [col[0] for col in columns]
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Registrar la consulta en el historial
            system_conn.execute("""
                INSERT INTO query_history 
                (database_id, query, duration_ms, result_rows, status)
                VALUES (?, ?, ?, ?, ?)
            """, [
                db_id,
                query,
                duration_ms,
                len(result),
                'success'
            ])
            
            # Convertir a formato JSON
            rows = []
            for row in result:
                rows.append([
                    str(val) if isinstance(val, (datetime, uuid.UUID)) else val 
                    for val in row
                ])
            
            return jsonify({
                'success': True,
                'columns': column_names,
                'rows': rows,
                'row_count': len(rows),
                'duration_ms': duration_ms
            })
            
        except Exception as query_error:
            error_msg = str(query_error)
            logger.error(f"Error al ejecutar consulta: {error_msg}")
            
            # Registrar el error en el historial
            system_conn.execute("""
                INSERT INTO query_history 
                (database_id, query, duration_ms, status, error)
                VALUES (?, ?, ?, ?, ?)
            """, [
                db_id,
                query,
                int((time.time() - start_time) * 1000),
                'error',
                error_msg
            ])
            
            return jsonify({
                'success': False,
                'error': error_msg
            }), 400
            
    except Exception as e:
        logger.error(f"Error en la API al procesar consulta: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'query_db' in locals():
            query_db.close()
        system_conn.close()

# Obtener esquema de una base de datos
@app.route('/databases/<int:db_id>/schema', methods=['GET'])
@authenticate
def get_database_schema(db_id):
    """Obtener el esquema completo de una base de datos"""
    system_conn = get_system_connection()
    
    try:
        # Obtener la ruta de la base de datos
        result = system_conn.execute(
            "SELECT path FROM databases WHERE id = ?", 
            [db_id]
        ).fetchone()
        
        if not result:
            return jsonify({'error': f'Base de datos con ID {db_id} no encontrada'}), 404
            
        db_path = result[0]
        
        # Validar que la base de datos existe físicamente
        if not os.path.exists(db_path):
            return jsonify({'error': f'El archivo de base de datos no existe: {db_path}'}), 404
            
        # Conectar a la base de datos y obtener su esquema
        db_conn = duckdb.connect(db_path)
        
        try:
            # Obtener tablas
            tables_result = db_conn.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'main'
                ORDER BY table_name
            """).fetchall()
            
            tables = []
            for table_row in tables_result:
                table_name = table_row[0]
                
                # Obtener columnas de la tabla
                columns_result = db_conn.execute(f"""
                    SELECT 
                        column_name, 
                        data_type,
                        is_nullable,
                        column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'main' AND table_name = '{table_name}'
                    ORDER BY ordinal_position
                """).fetchall()
                
                columns = []
                for col in columns_result:
                    columns.append({
                        'name': col[0],
                        'type': col[1],
                        'nullable': col[2] == 'YES',
                        'default': col[3]
                    })
                
                tables.append({
                    'name': table_name,
                    'columns': columns
                })
            
            return jsonify({
                'tables': tables
            })
            
        finally:
            db_conn.close()
            
    except Exception as e:
        logger.error(f"Error al obtener esquema: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        system_conn.close()

# Actualizar una base de datos desde un archivo externo
@app.route('/databases/<int:db_id>/sync', methods=['POST'])
@authenticate
def sync_database(db_id):
    """Sincronizar una base de datos con un archivo externo"""
    data = request.json
    system_conn = get_system_connection()
    
    try:
        if not data or 'source_uri' not in data:
            return jsonify({'error': 'Se requiere una URI de origen'}), 400
        
        source_uri = data.get('source_uri')
        operation = data.get('operation', 'import')  # import o export
        table_name = data.get('table_name')
        
        # Obtener la ruta de la base de datos
        result = system_conn.execute(
            "SELECT path FROM databases WHERE id = ?", 
            [db_id]
        ).fetchone()
        
        if not result:
            return jsonify({'error': f'Base de datos con ID {db_id} no encontrada'}), 404
            
        db_path = result[0]
        
        # Validar que la base de datos existe físicamente
        if not os.path.exists(db_path):
            return jsonify({'error': f'El archivo de base de datos no existe: {db_path}'}), 404
            
        # Registrar la operación de sincronización
        sync_id = system_conn.execute("""
            INSERT INTO sync_operations 
            (database_id, operation_type, external_uri, status)
            VALUES (?, ?, ?, ?)
            RETURNING id
        """, [
            db_id,
            operation,
            source_uri,
            'in_progress'
        ]).fetchone()[0]
            
        # Conectar a la base de datos
        db_conn = duckdb.connect(db_path)
        
        try:
            start_time = time.time()
            rows_processed = 0
            
            if operation == 'import':
                # Importar datos a la base de datos
                if source_uri.lower().endswith('.parquet'):
                    # Para archivos Parquet
                    if table_name:
                        # Crear o reemplazar tabla
                        db_conn.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM read_parquet('{source_uri}')")
                        rows_processed = db_conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    else:
                        return jsonify({'error': 'Se requiere un nombre de tabla para importar datos'}), 400
                        
                elif source_uri.lower().endswith('.csv'):
                    # Para archivos CSV
                    if table_name:
                        # Crear o reemplazar tabla
                        db_conn.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM read_csv_auto('{source_uri}')")
                        rows_processed = db_conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    else:
                        return jsonify({'error': 'Se requiere un nombre de tabla para importar datos'}), 400
                        
                else:
                    return jsonify({'error': 'Formato de archivo no soportado. Use .parquet o .csv'}), 400
                    
            elif operation == 'export':
                # Exportar datos desde la base de datos
                if not table_name:
                    return jsonify({'error': 'Se requiere un nombre de tabla para exportar datos'}), 400
                
                # Verificar si la tabla existe
                result = db_conn.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'").fetchall()
                if not result:
                    return jsonify({'error': f'La tabla {table_name} no existe en la base de datos'}), 404
                
                if source_uri.lower().endswith('.parquet'):
                    # Exportar a Parquet
                    db_conn.execute(f"COPY {table_name} TO '{source_uri}' (FORMAT 'parquet')")
                    rows_processed = db_conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    
                elif source_uri.lower().endswith('.csv'):
                    # Exportar a CSV
                    db_conn.execute(f"COPY {table_name} TO '{source_uri}' (FORMAT CSV, HEADER)")
                    rows_processed = db_conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    
                else:
                    return jsonify({'error': 'Formato de archivo no soportado. Use .parquet o .csv'}), 400
                    
            else:
                return jsonify({'error': f'Operación no soportada: {operation}. Use "import" o "export"'}), 400
                
            # Actualizar el registro de sincronización
            system_conn.execute("""
                UPDATE sync_operations
                SET completed_at = CURRENT_TIMESTAMP, status = 'success', rows_processed = ?
                WHERE id = ?
            """, [rows_processed, sync_id])
            
            return jsonify({
                'success': True,
                'operation': operation,
                'source_uri': source_uri,
                'table_name': table_name,
                'rows_processed': rows_processed,
                'duration_ms': int((time.time() - start_time) * 1000)
            })
            
        except Exception as sync_error:
            error_msg = str(sync_error)
            logger.error(f"Error en sincronización: {error_msg}")
            
            # Actualizar el registro de sincronización con el error
            system_conn.execute("""
                UPDATE sync_operations
                SET completed_at = CURRENT_TIMESTAMP, status = 'error', error = ?
                WHERE id = ?
            """, [error_msg, sync_id])
            
            return jsonify({
                'success': False,
                'operation': operation,
                'error': error_msg
            }), 500
            
    except Exception as e:
        logger.error(f"Error en la API al procesar sincronización: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'db_conn' in locals():
            db_conn.close()
        system_conn.close()

# Obtener métricas del sistema
@app.route('/metrics', methods=['GET'])
@authenticate
def get_system_metrics():
    """Obtener métricas actuales del sistema"""
    system_conn = get_system_connection()
    
    try:
        # Obtener métricas actuales (simuladas en este ejemplo)
        # En una implementación real, se obtendrían del sistema operativo
        import random
        metrics = {
            'cpu_usage': round(random.uniform(10, 90), 2),
            'memory_usage': round(random.uniform(20, 85), 2),
            'disk_usage': round(random.uniform(30, 95), 2),
            'active_connections': random.randint(1, 10)
        }
        
        # Registrar las métricas en la base de datos
        system_conn.execute("""
            INSERT INTO system_metrics 
            (cpu_usage, memory_usage, disk_usage, active_connections)
            VALUES (?, ?, ?, ?)
        """, [
            metrics['cpu_usage'],
            metrics['memory_usage'],
            metrics['disk_usage'],
            metrics['active_connections']
        ])
        
        # Obtener métricas históricas (últimas 10)
        history = system_conn.execute("""
            SELECT timestamp, cpu_usage, memory_usage, disk_usage, active_connections
            FROM system_metrics
            ORDER BY timestamp DESC
            LIMIT 10
        """).fetchall()
        
        metrics_history = []
        for row in history:
            metrics_history.append({
                'timestamp': row[0].isoformat() if row[0] else None,
                'cpu_usage': row[1],
                'memory_usage': row[2],
                'disk_usage': row[3],
                'active_connections': row[4]
            })
        
        return jsonify({
            'current': metrics,
            'history': metrics_history,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error al obtener métricas: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        system_conn.close()

# Obtener historial de consultas
@app.route('/query-history', methods=['GET'])
@authenticate
def get_query_history():
    """Obtener el historial de consultas ejecutadas"""
    system_conn = get_system_connection()
    
    try:
        # Opciones de filtrado
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        status = request.args.get('status')
        database_id = request.args.get('database_id')
        
        # Construir la consulta SQL con filtros
        sql = """
            SELECT qh.id, qh.database_id, d.name as database_name, 
                  qh.query, qh.duration_ms, qh.result_rows, 
                  qh.executed_at, qh.status, qh.error
            FROM query_history qh
            JOIN databases d ON qh.database_id = d.id
        """
        
        conditions = []
        params = []
        
        if status:
            conditions.append("qh.status = ?")
            params.append(status)
            
        if database_id:
            try:
                db_id = int(database_id)
                conditions.append("qh.database_id = ?")
                params.append(db_id)
            except ValueError:
                pass
        
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
            
        sql += " ORDER BY qh.executed_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        result = system_conn.execute(sql, params).fetchall()
        
        # Construir la respuesta
        history = []
        for row in result:
            history.append({
                'id': row[0],
                'database': {
                    'id': row[1],
                    'name': row[2]
                },
                'query': row[3],
                'duration_ms': row[4],
                'result_rows': row[5],
                'executed_at': row[6].isoformat() if row[6] else None,
                'status': row[7],
                'error': row[8]
            })
            
        # Obtener el total de registros (para paginación)
        count_sql = "SELECT COUNT(*) FROM query_history"
        if conditions:
            count_sql += " WHERE " + " AND ".join(conditions)
            
        total = system_conn.execute(count_sql, params[:-2] if params else []).fetchone()[0]
        
        return jsonify({
            'history': history,
            'total': total,
            'limit': limit,
            'offset': offset
        })
        
    except Exception as e:
        logger.error(f"Error al obtener historial de consultas: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        system_conn.close()

# Manejar errores 404
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint no encontrado'}), 404

if __name__ == '__main__':
    try:
        # Inicializar la base de datos del sistema al inicio
        system_conn = get_system_connection()
        system_conn.close()
        
        logger.info(f"Servidor DuckDB iniciado en puerto {SERVER_PORT}")
        app.run(host='0.0.0.0', port=SERVER_PORT)
    except Exception as e:
        logger.error(f"Error al iniciar el servidor: {str(e)}")
        sys.exit(1)
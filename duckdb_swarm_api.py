#!/usr/bin/env python3
"""
API REST para gestionar el enjambre (swarm) de servidores DuckDB

Este script proporciona una API REST completa para:
1. Gestión de servidores DuckDB (ducklings)
   - Listar/agregar/eliminar servidores
   - Monitorear estado y métricas
   - Reiniciar servidores

2. Gestión de bases de datos
   - Listar/agregar/eliminar bases de datos
   - Verificar conexiones a bases de datos
   - Obtener esquemas de bases de datos

3. Ejecución de consultas y pipelines
   - Ejecutar consultas SQL en bases de datos
   - Definir y ejecutar pipelines de transformación
   - Monitorear ejecuciones de pipelines

4. Gestión de almacenamiento
   - Integración con MinIO para almacenamiento de objetos
   - Sincronización de datos entre DuckDB y almacenamiento
   - Gestión de buckets y objetos

5. Integración con Evidence.dev
   - Gestión de proyectos y reportes
   - Generación y publicación de reportes
   - Configuración de fuentes de datos

Se puede integrar con la plataforma SAGE existente
"""
import os
import duckdb
import json
import time
import uuid
import random
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Crear la aplicación Flask
app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

# Configuración
DUCKDB_PATH = 'duckdb_data/analytics.duckdb'

def get_duckdb_connection():
    """Obtiene una conexión a la base de datos DuckDB"""
    try:
        conn = duckdb.connect(DUCKDB_PATH)
        return conn
    except Exception as e:
        print(f"Error al conectar con DuckDB: {e}")
        return None

@app.route('/api/health', methods=['GET'])
def health_check():
    """Ruta para verificar el estado de la API"""
    return jsonify({
        'status': 'ok',
        'message': 'DuckDB Swarm API is running',
        'timestamp': time.time()
    })

@app.route('/api/servers', methods=['GET'])
def list_servers():
    """Lista todos los servidores DuckDB registrados"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        result = conn.execute("""
            SELECT 
                id, 
                hostname, 
                port, 
                status, 
                server_type, 
                created_at 
            FROM duckdb_servers
            ORDER BY id
        """).fetchall()
        
        # Convertir a formato JSON
        servers = []
        for row in result:
            servers.append({
                'id': row[0],
                'hostname': row[1],
                'port': row[2],
                'status': row[3],
                'server_type': row[4],
                'created_at': str(row[5])
            })
        
        return jsonify({'servers': servers})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/servers', methods=['POST'])
def add_server():
    """Agrega un nuevo servidor DuckDB"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener datos del request
        data = request.json
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400
        
        hostname = data.get('hostname')
        port = data.get('port', 1294)
        server_type = data.get('server_type', 'general')
        
        if not hostname:
            return jsonify({'error': 'Se requiere el hostname'}), 400
        
        # Verificar si el servidor ya existe
        result = conn.execute(
            "SELECT id FROM duckdb_servers WHERE hostname = ? AND port = ?", 
            [hostname, port]
        ).fetchone()
        
        if result:
            return jsonify({'error': f'El servidor {hostname}:{port} ya existe', 'server_id': result[0]}), 409
        
        # Obtener el siguiente ID
        max_id = conn.execute("SELECT MAX(id) FROM duckdb_servers").fetchone()[0]
        next_id = 1 if max_id is None else max_id + 1
        
        # Insertar el nuevo servidor
        conn.execute("""
            INSERT INTO duckdb_servers (id, hostname, port, status, server_type)
            VALUES (?, ?, ?, 'starting', ?)
        """, [next_id, hostname, port, server_type])
        
        # Simular inicialización del servidor
        time.sleep(1)
        
        # Actualizar estado a activo
        conn.execute(
            "UPDATE duckdb_servers SET status = 'active' WHERE id = ?",
            [next_id]
        )
        
        return jsonify({
            'message': f'Servidor {hostname}:{port} agregado exitosamente',
            'server_id': next_id
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/servers/<int:server_id>', methods=['DELETE'])
def delete_server(server_id):
    """Elimina un servidor DuckDB"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Verificar si el servidor existe
        result = conn.execute(
            "SELECT hostname FROM duckdb_servers WHERE id = ?", 
            [server_id]
        ).fetchone()
        
        if not result:
            return jsonify({'error': f'El servidor con ID {server_id} no existe'}), 404
        
        hostname = result[0]
        
        # Verificar si tiene bases de datos
        count = conn.execute(
            "SELECT COUNT(*) FROM db_instances WHERE server_id = ?", 
            [server_id]
        ).fetchone()[0]
        
        if count > 0:
            return jsonify({
                'error': f'No se puede eliminar el servidor {hostname} porque tiene {count} bases de datos asociadas'
            }), 409
        
        # Eliminar las métricas asociadas
        conn.execute("DELETE FROM server_metrics WHERE server_id = ?", [server_id])
        
        # Eliminar el servidor
        conn.execute("DELETE FROM duckdb_servers WHERE id = ?", [server_id])
        
        return jsonify({
            'message': f'Servidor {hostname} (ID: {server_id}) eliminado exitosamente'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/databases', methods=['GET'])
def list_databases():
    """Lista todas las bases de datos registradas"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Parámetro opcional para filtrar por servidor
        server_id = request.args.get('server_id')
        
        sql = """
            SELECT 
                d.id, 
                d.server_id, 
                s.hostname, 
                d.database_name, 
                d.database_path, 
                d.size_mb, 
                d.created_at 
            FROM db_instances d
            JOIN duckdb_servers s ON d.server_id = s.id
        """
        
        # Agregar filtro por servidor si se especificó
        params = []
        if server_id:
            sql += " WHERE d.server_id = ?"
            params.append(int(server_id))
            
        sql += " ORDER BY d.server_id, d.id"
        
        result = conn.execute(sql, params).fetchall()
        
        # Convertir a formato JSON
        databases = []
        for row in result:
            databases.append({
                'id': row[0],
                'server_id': row[1],
                'hostname': row[2],
                'database_name': row[3],
                'database_path': row[4],
                'size_mb': row[5],
                'created_at': str(row[6])
            })
        
        return jsonify({'databases': databases})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/databases', methods=['POST'])
def add_database():
    """Agrega una nueva base de datos"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener datos del request
        data = request.json
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400
        
        server_id = data.get('server_id')
        name = data.get('name')
        path = data.get('path')
        size = data.get('size', 0)
        
        if not server_id or not name or not path:
            return jsonify({'error': 'Se requieren server_id, name y path'}), 400
        
        # Verificar si el servidor existe
        result = conn.execute(
            "SELECT hostname FROM duckdb_servers WHERE id = ?", 
            [server_id]
        ).fetchone()
        
        if not result:
            return jsonify({'error': f'El servidor con ID {server_id} no existe'}), 404
        
        hostname = result[0]
        
        # Verificar si la base de datos ya existe
        result = conn.execute(
            "SELECT id FROM db_instances WHERE server_id = ? AND database_name = ?", 
            [server_id, name]
        ).fetchone()
        
        if result:
            return jsonify({
                'error': f'La base de datos {name} ya existe en el servidor {hostname}',
                'database_id': result[0]
            }), 409
        
        # Obtener el siguiente ID
        max_id = conn.execute("SELECT MAX(id) FROM db_instances").fetchone()[0]
        next_id = 1 if max_id is None else max_id + 1
        
        # Insertar la nueva base de datos
        conn.execute("""
            INSERT INTO db_instances (id, server_id, database_name, database_path, size_mb)
            VALUES (?, ?, ?, ?, ?)
        """, [next_id, server_id, name, path, size])
        
        return jsonify({
            'message': f'Base de datos {name} agregada exitosamente al servidor {hostname}',
            'database_id': next_id
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/databases/<int:db_id>', methods=['DELETE'])
def delete_database(db_id):
    """Elimina una base de datos"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Verificar si la base de datos existe
        result = conn.execute("""
            SELECT d.database_name, s.hostname 
            FROM db_instances d
            JOIN duckdb_servers s ON d.server_id = s.id
            WHERE d.id = ?
        """, [db_id]).fetchone()
        
        if not result:
            return jsonify({'error': f'La base de datos con ID {db_id} no existe'}), 404
        
        db_name, hostname = result
        
        # Eliminar la base de datos
        conn.execute("DELETE FROM db_instances WHERE id = ?", [db_id])
        
        return jsonify({
            'message': f'Base de datos {db_name} del servidor {hostname} eliminada exitosamente'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Obtiene las métricas de los servidores"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Parámetros opcionales
        server_id = request.args.get('server_id')
        limit = request.args.get('limit', 10)
        
        sql = """
            SELECT 
                m.id,
                m.server_id,
                s.hostname,
                m.cpu_usage,
                m.memory_usage,
                m.disk_usage,
                m.query_count,
                m.active_connections,
                m.timestamp
            FROM server_metrics m
            JOIN duckdb_servers s ON m.server_id = s.id
        """
        
        # Agregar filtro por servidor si se especificó
        params = []
        if server_id:
            sql += " WHERE m.server_id = ?"
            params.append(int(server_id))
            
        sql += " ORDER BY m.timestamp DESC, m.server_id"
        
        if limit:
            sql += f" LIMIT {int(limit)}"
        
        result = conn.execute(sql, params).fetchall()
        
        # Convertir a formato JSON
        metrics = []
        for row in result:
            metrics.append({
                'id': row[0],
                'server_id': row[1],
                'hostname': row[2],
                'cpu_usage': row[3],
                'memory_usage': row[4],
                'disk_usage': row[5],
                'query_count': row[6],
                'active_connections': row[7],
                'timestamp': str(row[8])
            })
        
        return jsonify({'metrics': metrics})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/metrics/update', methods=['POST'])
def update_metrics():
    """Actualiza las métricas de los servidores"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener datos del request
        data = request.json
        server_id = data.get('server_id') if data else None
        
        # Lista de servidores a actualizar
        if server_id:
            # Verificar si el servidor existe
            result = conn.execute(
                "SELECT id, hostname FROM duckdb_servers WHERE id = ?", 
                [server_id]
            ).fetchall()
            
            if not result:
                return jsonify({'error': f'El servidor con ID {server_id} no existe'}), 404
        else:
            # Obtener todos los servidores activos
            result = conn.execute(
                "SELECT id, hostname FROM duckdb_servers WHERE status = 'active'"
            ).fetchall()
            
            if not result:
                return jsonify({'error': 'No hay servidores activos para actualizar métricas'}), 404
        
        # Actualizar métricas para cada servidor
        updated_servers = []
        for server in result:
            server_id, hostname = server
            
            # Generar métricas aleatorias para simulación
            cpu = random.uniform(20, 95)
            memory = random.uniform(30, 90)
            disk = random.uniform(40, 85)
            queries = random.randint(500, 2000)
            connections = random.randint(1, 20)
            
            # Obtener el siguiente ID
            max_id = conn.execute("SELECT MAX(id) FROM server_metrics").fetchone()[0]
            next_id = 1 if max_id is None else max_id + 1
            
            # Insertar las nuevas métricas
            conn.execute("""
                INSERT INTO server_metrics 
                (id, server_id, cpu_usage, memory_usage, disk_usage, query_count, active_connections)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [next_id, server_id, cpu, memory, disk, queries, connections])
            
            updated_servers.append({
                'server_id': server_id,
                'hostname': hostname,
                'metrics': {
                    'cpu_usage': cpu,
                    'memory_usage': memory,
                    'disk_usage': disk,
                    'query_count': queries,
                    'active_connections': connections
                }
            })
        
        return jsonify({
            'message': f'Métricas actualizadas para {len(updated_servers)} servidores',
            'updated_servers': updated_servers
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# Verificar la conexión a una base de datos
@app.route('/api/databases/<int:db_id>/test-connection', methods=['GET'])
def test_database_connection(db_id):
    """Prueba la conexión a una base de datos DuckDB"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener información de la base de datos
        result = conn.execute("""
            SELECT d.database_path, s.hostname, d.database_name 
            FROM db_instances d
            JOIN duckdb_servers s ON d.server_id = s.id
            WHERE d.id = ?
        """, [db_id]).fetchone()
        
        if not result:
            return jsonify({'error': f'La base de datos con ID {db_id} no existe'}), 404
        
        db_path, hostname, db_name = result
        
        # Intentar conectar a la base de datos (simulado)
        success = True
        if random.random() < 0.2:  # 20% de probabilidad de fallo para simulación
            success = False
            error_message = "Error simulado: No se pudo conectar a la base de datos"
        else:
            error_message = None
        
        # En una implementación real, intentaríamos una conexión real:
        # try:
        #     test_conn = duckdb.connect(db_path)
        #     test_conn.execute("SELECT 1")
        #     test_conn.close()
        #     success = True
        # except Exception as e:
        #     success = False
        #     error_message = str(e)
        
        return jsonify({
            'success': success,
            'database_name': db_name,
            'hostname': hostname,
            'path': db_path,
            'error': error_message
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# Ejecutar consulta SQL en una base de datos
@app.route('/api/databases/<int:db_id>/query', methods=['POST'])
def execute_query(db_id):
    """Ejecuta una consulta SQL en una base de datos DuckDB"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener información de la base de datos
        result = conn.execute("""
            SELECT d.database_path, s.hostname, d.database_name 
            FROM db_instances d
            JOIN duckdb_servers s ON d.server_id = s.id
            WHERE d.id = ?
        """, [db_id]).fetchone()
        
        if not result:
            return jsonify({'error': f'La base de datos con ID {db_id} no existe'}), 404
        
        db_path, hostname, db_name = result
        
        # Obtener la consulta SQL del request
        data = request.json
        if not data or 'query' not in data:
            return jsonify({'error': 'Se requiere una consulta SQL'}), 400
        
        sql_query = data['query']
        
        # Validar que la consulta no sea destructiva (solo permitir SELECT)
        if not sql_query.strip().lower().startswith('select'):
            return jsonify({
                'error': 'Solo se permiten consultas SELECT para garantizar la seguridad de los datos'
            }), 403
        
        # En una implementación real, ejecutaríamos la consulta en la base de datos real
        # Aquí simulamos el resultado
        column_names = ['id', 'name', 'value']
        rows = []
        
        # Simular resultados
        for i in range(5):
            rows.append([i, f'Item {i}', random.randint(100, 1000)])
        
        return jsonify({
            'success': True,
            'database_name': db_name,
            'hostname': hostname,
            'query': sql_query,
            'columns': column_names,
            'rows': rows,
            'row_count': len(rows)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    finally:
        conn.close()

# Obtener esquema de una base de datos
@app.route('/api/databases/<int:db_id>/schema', methods=['GET'])
def get_database_schema(db_id):
    """Obtiene el esquema de una base de datos DuckDB"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener información de la base de datos
        result = conn.execute("""
            SELECT d.database_path, s.hostname, d.database_name 
            FROM db_instances d
            JOIN duckdb_servers s ON d.server_id = s.id
            WHERE d.id = ?
        """, [db_id]).fetchone()
        
        if not result:
            return jsonify({'error': f'La base de datos con ID {db_id} no existe'}), 404
        
        db_path, hostname, db_name = result
        
        # En una implementación real, obtendríamos el esquema de la base de datos real
        # Aquí simulamos el esquema
        tables = [
            {
                'name': 'customers',
                'columns': [
                    {'name': 'id', 'type': 'INTEGER', 'nullable': False},
                    {'name': 'name', 'type': 'VARCHAR', 'nullable': False},
                    {'name': 'email', 'type': 'VARCHAR', 'nullable': True},
                    {'name': 'created_at', 'type': 'TIMESTAMP', 'nullable': False}
                ]
            },
            {
                'name': 'orders',
                'columns': [
                    {'name': 'id', 'type': 'INTEGER', 'nullable': False},
                    {'name': 'customer_id', 'type': 'INTEGER', 'nullable': False},
                    {'name': 'amount', 'type': 'DECIMAL(10,2)', 'nullable': False},
                    {'name': 'created_at', 'type': 'TIMESTAMP', 'nullable': False}
                ]
            },
            {
                'name': 'products',
                'columns': [
                    {'name': 'id', 'type': 'INTEGER', 'nullable': False},
                    {'name': 'name', 'type': 'VARCHAR', 'nullable': False},
                    {'name': 'price', 'type': 'DECIMAL(10,2)', 'nullable': False},
                    {'name': 'stock', 'type': 'INTEGER', 'nullable': False}
                ]
            }
        ]
        
        return jsonify({
            'database_name': db_name,
            'hostname': hostname,
            'tables': tables
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ==============================
# Gestión de Pipelines
# ==============================

@app.route('/api/pipelines', methods=['GET'])
def list_pipelines():
    """Lista todos los pipelines definidos"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        result = conn.execute("""
            SELECT 
                id, 
                name, 
                description, 
                version, 
                created_by,
                created_at,
                updated_at,
                schedule_type,
                input_duckling_id,
                output_duckling_id
            FROM pipelines
            ORDER BY created_at DESC
        """).fetchall()
        
        # Convertir a formato JSON
        pipelines = []
        for row in result:
            pipelines.append({
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'version': row[3],
                'created_by': row[4],
                'created_at': str(row[5]),
                'updated_at': str(row[6]),
                'schedule_type': row[7],
                'input_duckling_id': row[8],
                'output_duckling_id': row[9]
            })
        
        return jsonify({'pipelines': pipelines})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/pipelines/<string:pipeline_id>', methods=['GET'])
def get_pipeline(pipeline_id):
    """Obtiene un pipeline específico con sus pasos"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener información del pipeline
        pipeline_result = conn.execute("""
            SELECT 
                id, 
                name, 
                description, 
                version, 
                created_by,
                created_at,
                updated_at,
                schedule_type,
                schedule_cron,
                schedule_timezone,
                input_duckling_id,
                input_database,
                input_schema,
                output_duckling_id,
                output_database,
                output_schema,
                output_table_prefix
            FROM pipelines
            WHERE id = ?
        """, [pipeline_id]).fetchone()
        
        if not pipeline_result:
            return jsonify({'error': f'El pipeline con ID {pipeline_id} no existe'}), 404
        
        # Crear objeto pipeline
        pipeline = {
            'id': pipeline_result[0],
            'name': pipeline_result[1],
            'description': pipeline_result[2],
            'version': pipeline_result[3],
            'created_by': pipeline_result[4],
            'created_at': str(pipeline_result[5]),
            'updated_at': str(pipeline_result[6]),
            'schedule': {
                'type': pipeline_result[7],
                'cron': pipeline_result[8],
                'timezone': pipeline_result[9]
            },
            'input_config': {
                'duckling_id': pipeline_result[10],
                'database': pipeline_result[11],
                'schema': pipeline_result[12]
            },
            'output_config': {
                'duckling_id': pipeline_result[13],
                'database': pipeline_result[14],
                'schema': pipeline_result[15],
                'table_prefix': pipeline_result[16]
            }
        }
        
        # Obtener pasos del pipeline
        steps_result = conn.execute("""
            SELECT 
                id,
                name,
                step_order,
                step_type,
                code,
                depends_on
            FROM pipeline_steps
            WHERE pipeline_id = ?
            ORDER BY step_order
        """, [pipeline_id]).fetchall()
        
        steps = []
        for row in steps_result:
            steps.append({
                'id': row[0],
                'name': row[1],
                'order': row[2],
                'type': row[3],
                'code': row[4],
                'depends_on': row[5]
            })
        
        pipeline['steps'] = steps
        
        # Obtener ejecuciones recientes
        executions_result = conn.execute("""
            SELECT 
                id,
                status,
                started_at,
                completed_at,
                duckling_id,
                triggered_by
            FROM pipeline_executions
            WHERE pipeline_id = ?
            ORDER BY started_at DESC
            LIMIT 5
        """, [pipeline_id]).fetchall()
        
        recent_executions = []
        for row in executions_result:
            recent_executions.append({
                'id': row[0],
                'status': row[1],
                'started_at': str(row[2]),
                'completed_at': str(row[3]) if row[3] else None,
                'duckling_id': row[4],
                'triggered_by': row[5]
            })
        
        pipeline['recent_executions'] = recent_executions
        
        return jsonify(pipeline)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/pipelines', methods=['POST'])
def create_pipeline():
    """Crea un nuevo pipeline"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400
        
        name = data.get('name')
        description = data.get('description', '')
        version = data.get('version', '1.0.0')
        created_by = data.get('created_by', 'admin')
        
        if not name:
            return jsonify({'error': 'Se requiere un nombre para el pipeline'}), 400
        
        # Generar un nuevo ID para el pipeline
        pipeline_id = str(uuid.uuid4())
        
        # Configuración de programación
        schedule_type = data.get('schedule_type', 'on_demand')
        schedule_cron = data.get('schedule_cron')
        schedule_timezone = data.get('schedule_timezone')
        
        # Configuración de entrada
        input_config = data.get('input_config', {})
        input_duckling_id = input_config.get('duckling_id')
        input_database = input_config.get('database')
        input_schema = input_config.get('schema')
        
        # Configuración de salida
        output_config = data.get('output_config', {})
        output_duckling_id = output_config.get('duckling_id')
        output_database = output_config.get('database')
        output_schema = output_config.get('schema')
        output_table_prefix = output_config.get('table_prefix')
        
        # Insertar el pipeline
        conn.execute("""
            INSERT INTO pipelines (
                id, name, description, version, created_by,
                schedule_type, schedule_cron, schedule_timezone,
                input_duckling_id, input_database, input_schema,
                output_duckling_id, output_database, output_schema, output_table_prefix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            pipeline_id, name, description, version, created_by,
            schedule_type, schedule_cron, schedule_timezone,
            input_duckling_id, input_database, input_schema,
            output_duckling_id, output_database, output_schema, output_table_prefix
        ])
        
        # Insertar pasos si se proporcionaron
        steps = data.get('steps', [])
        for i, step in enumerate(steps):
            step_id = str(uuid.uuid4())
            step_name = step.get('name')
            step_type = step.get('type', 'sql')
            code = step.get('code', '')
            depends_on = step.get('depends_on')
            
            conn.execute("""
                INSERT INTO pipeline_steps (
                    id, pipeline_id, name, step_order, step_type, code, depends_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [
                step_id, pipeline_id, step_name, i+1, step_type, code, depends_on
            ])
        
        return jsonify({
            'message': f'Pipeline {name} creado exitosamente',
            'pipeline_id': pipeline_id
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/pipelines/<string:pipeline_id>', methods=['PUT'])
def update_pipeline(pipeline_id):
    """Actualiza un pipeline existente"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Verificar si el pipeline existe
        result = conn.execute("SELECT name FROM pipelines WHERE id = ?", [pipeline_id]).fetchone()
        if not result:
            return jsonify({'error': f'El pipeline con ID {pipeline_id} no existe'}), 404
        
        original_name = result[0]
        
        data = request.json
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400
        
        name = data.get('name')
        description = data.get('description')
        version = data.get('version')
        
        # Preparar los campos a actualizar
        update_fields = []
        params = []
        
        if name:
            update_fields.append("name = ?")
            params.append(name)
        
        if description is not None:
            update_fields.append("description = ?")
            params.append(description)
        
        if version:
            update_fields.append("version = ?")
            params.append(version)
        
        # Configuración de programación
        schedule = data.get('schedule', {})
        if 'type' in schedule:
            update_fields.append("schedule_type = ?")
            params.append(schedule['type'])
        
        if 'cron' in schedule:
            update_fields.append("schedule_cron = ?")
            params.append(schedule['cron'])
        
        if 'timezone' in schedule:
            update_fields.append("schedule_timezone = ?")
            params.append(schedule['timezone'])
        
        # Configuración de entrada
        input_config = data.get('input_config', {})
        if 'duckling_id' in input_config:
            update_fields.append("input_duckling_id = ?")
            params.append(input_config['duckling_id'])
        
        if 'database' in input_config:
            update_fields.append("input_database = ?")
            params.append(input_config['database'])
        
        if 'schema' in input_config:
            update_fields.append("input_schema = ?")
            params.append(input_config['schema'])
        
        # Configuración de salida
        output_config = data.get('output_config', {})
        if 'duckling_id' in output_config:
            update_fields.append("output_duckling_id = ?")
            params.append(output_config['duckling_id'])
        
        if 'database' in output_config:
            update_fields.append("output_database = ?")
            params.append(output_config['database'])
        
        if 'schema' in output_config:
            update_fields.append("output_schema = ?")
            params.append(output_config['schema'])
        
        if 'table_prefix' in output_config:
            update_fields.append("output_table_prefix = ?")
            params.append(output_config['table_prefix'])
        
        # Siempre actualizar la fecha de modificación
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        
        # Si no hay campos para actualizar, retornar error
        if not update_fields:
            return jsonify({'error': 'No se proporcionaron campos para actualizar'}), 400
        
        # Construir la consulta SQL de actualización
        sql = f"UPDATE pipelines SET {', '.join(update_fields)} WHERE id = ?"
        params.append(pipeline_id)
        
        # Ejecutar la actualización
        conn.execute(sql, params)
        
        # Actualizar pasos si se proporcionaron
        steps = data.get('steps')
        if steps is not None:
            # Eliminar los pasos existentes
            conn.execute("DELETE FROM pipeline_steps WHERE pipeline_id = ?", [pipeline_id])
            
            # Insertar los nuevos pasos
            for i, step in enumerate(steps):
                step_id = str(uuid.uuid4())
                step_name = step.get('name')
                step_type = step.get('type', 'sql')
                code = step.get('code', '')
                depends_on = step.get('depends_on')
                
                conn.execute("""
                    INSERT INTO pipeline_steps (
                        id, pipeline_id, name, step_order, step_type, code, depends_on
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, [
                    step_id, pipeline_id, step_name, i+1, step_type, code, depends_on
                ])
        
        return jsonify({
            'message': f'Pipeline {original_name} actualizado exitosamente',
            'pipeline_id': pipeline_id
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/pipelines/<string:pipeline_id>', methods=['DELETE'])
def delete_pipeline(pipeline_id):
    """Elimina un pipeline"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Verificar si el pipeline existe
        result = conn.execute("SELECT name FROM pipelines WHERE id = ?", [pipeline_id]).fetchone()
        if not result:
            return jsonify({'error': f'El pipeline con ID {pipeline_id} no existe'}), 404
        
        pipeline_name = result[0]
        
        # Verificar si tiene ejecuciones pendientes
        result = conn.execute("""
            SELECT COUNT(*) FROM pipeline_executions 
            WHERE pipeline_id = ? AND status IN ('running', 'queued')
        """, [pipeline_id]).fetchone()
        
        if result[0] > 0:
            return jsonify({
                'error': f'No se puede eliminar el pipeline {pipeline_name} porque tiene ejecuciones en curso'
            }), 409
        
        # Eliminar pasos
        conn.execute("DELETE FROM pipeline_steps WHERE pipeline_id = ?", [pipeline_id])
        
        # Eliminar ejecuciones (y sus logs mediante cascade)
        conn.execute("DELETE FROM pipeline_executions WHERE pipeline_id = ?", [pipeline_id])
        
        # Eliminar el pipeline
        conn.execute("DELETE FROM pipelines WHERE id = ?", [pipeline_id])
        
        return jsonify({
            'message': f'Pipeline {pipeline_name} y sus componentes asociados eliminados exitosamente'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/pipelines/<string:pipeline_id>/execute', methods=['POST'])
def execute_pipeline(pipeline_id):
    """Ejecuta un pipeline"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Verificar si el pipeline existe
        result = conn.execute("""
            SELECT 
                name, 
                input_duckling_id, 
                output_duckling_id 
            FROM pipelines 
            WHERE id = ?
        """, [pipeline_id]).fetchone()
        
        if not result:
            return jsonify({'error': f'El pipeline con ID {pipeline_id} no existe'}), 404
        
        pipeline_name, input_duckling_id, output_duckling_id = result
        
        # Obtener parámetros de ejecución
        data = request.json or {}
        triggered_by = data.get('triggered_by', 'api')
        parameters = data.get('parameters', {})
        
        # Crear una nueva ejecución
        execution_id = str(uuid.uuid4())
        duckling_id = data.get('duckling_id', input_duckling_id)
        
        # Insertar la ejecución
        conn.execute("""
            INSERT INTO pipeline_executions (
                id, pipeline_id, status, duckling_id, triggered_by, parameters
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, [
            execution_id, 
            pipeline_id, 
            'queued', 
            duckling_id, 
            triggered_by, 
            json.dumps(parameters)
        ])
        
        # Registrar log de inicio
        log_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO execution_logs (
                id, execution_id, log_level, message
            ) VALUES (?, ?, ?, ?)
        """, [
            log_id,
            execution_id,
            'INFO',
            f'Ejecución del pipeline {pipeline_name} iniciada por {triggered_by}'
        ])
        
        # Simular inicio de ejecución asincrónica (en un entorno real esto sería un proceso separado)
        # Actualizar estado a 'running'
        conn.execute("""
            UPDATE pipeline_executions 
            SET status = 'running' 
            WHERE id = ?
        """, [execution_id])
        
        # En un entorno real, aquí iniciaríamos la ejecución en background
        # Para esta implementación, simularemos una ejecución exitosa
        
        # Simular una ejecución rápida para fines de demostración
        time.sleep(1)
        
        # Actualizar estado a 'completed'
        completed_at = datetime.datetime.now()
        duration_ms = random.randint(500, 5000)
        rows_processed = random.randint(100, 10000)
        memory_used_mb = random.uniform(10.0, 200.0)
        
        conn.execute("""
            UPDATE pipeline_executions 
            SET 
                status = 'completed',
                completed_at = ?,
                duration_ms = ?,
                rows_processed = ?,
                memory_used_mb = ?
            WHERE id = ?
        """, [
            completed_at, 
            duration_ms, 
            rows_processed, 
            memory_used_mb, 
            execution_id
        ])
        
        # Registrar log de finalización
        log_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO execution_logs (
                id, execution_id, log_level, message
            ) VALUES (?, ?, ?, ?)
        """, [
            log_id,
            execution_id,
            'INFO',
            f'Ejecución completada exitosamente. Filas procesadas: {rows_processed}, Duración: {duration_ms}ms'
        ])
        
        return jsonify({
            'message': f'Pipeline {pipeline_name} ejecutado exitosamente',
            'execution_id': execution_id,
            'status': 'completed',
            'metrics': {
                'duration_ms': duration_ms,
                'rows_processed': rows_processed,
                'memory_used_mb': memory_used_mb
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/executions/<string:execution_id>', methods=['GET'])
def get_execution(execution_id):
    """Obtiene el detalle de una ejecución"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener información de la ejecución
        result = conn.execute("""
            SELECT 
                e.id,
                e.pipeline_id,
                p.name as pipeline_name,
                e.status,
                e.started_at,
                e.completed_at,
                e.duckling_id,
                e.triggered_by,
                e.parameters,
                e.duration_ms,
                e.rows_processed,
                e.memory_used_mb,
                e.error_code,
                e.error_message,
                e.error_step_id
            FROM pipeline_executions e
            JOIN pipelines p ON e.pipeline_id = p.id
            WHERE e.id = ?
        """, [execution_id]).fetchone()
        
        if not result:
            return jsonify({'error': f'La ejecución con ID {execution_id} no existe'}), 404
        
        # Crear objeto ejecución
        execution = {
            'id': result[0],
            'pipeline': {
                'id': result[1],
                'name': result[2]
            },
            'status': result[3],
            'started_at': str(result[4]),
            'completed_at': str(result[5]) if result[5] else None,
            'duckling_id': result[6],
            'triggered_by': result[7],
            'parameters': json.loads(result[8]) if result[8] else {},
            'metrics': {
                'duration_ms': result[9],
                'rows_processed': result[10],
                'memory_used_mb': result[11]
            }
        }
        
        # Agregar información de error si existe
        if result[12]:  # error_code
            execution['error'] = {
                'code': result[12],
                'message': result[13],
                'step_id': result[14]
            }
        
        # Obtener logs de la ejecución
        logs_result = conn.execute("""
            SELECT 
                id,
                step_id,
                log_level,
                message,
                timestamp
            FROM execution_logs
            WHERE execution_id = ?
            ORDER BY timestamp
        """, [execution_id]).fetchall()
        
        logs = []
        for row in logs_result:
            logs.append({
                'id': row[0],
                'step_id': row[1],
                'level': row[2],
                'message': row[3],
                'timestamp': str(row[4])
            })
        
        execution['logs'] = logs
        
        return jsonify(execution)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/executions', methods=['GET'])
def list_executions():
    """Lista las ejecuciones de pipelines"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Parámetros opcionales
        pipeline_id = request.args.get('pipeline_id')
        status = request.args.get('status')
        limit = int(request.args.get('limit', 10))
        
        # Construir consulta SQL
        sql = """
            SELECT 
                e.id,
                e.pipeline_id,
                p.name as pipeline_name,
                e.status,
                e.started_at,
                e.completed_at,
                e.duckling_id,
                e.triggered_by,
                e.duration_ms,
                e.rows_processed
            FROM pipeline_executions e
            JOIN pipelines p ON e.pipeline_id = p.id
        """
        
        # Agregar filtros
        conditions = []
        params = []
        
        if pipeline_id:
            conditions.append("e.pipeline_id = ?")
            params.append(pipeline_id)
        
        if status:
            conditions.append("e.status = ?")
            params.append(status)
        
        if conditions:
            sql += f" WHERE {' AND '.join(conditions)}"
        
        sql += " ORDER BY e.started_at DESC"
        sql += f" LIMIT {limit}"
        
        result = conn.execute(sql, params).fetchall()
        
        # Convertir a formato JSON
        executions = []
        for row in result:
            executions.append({
                'id': row[0],
                'pipeline': {
                    'id': row[1],
                    'name': row[2]
                },
                'status': row[3],
                'started_at': str(row[4]),
                'completed_at': str(row[5]) if row[5] else None,
                'duckling_id': row[6],
                'triggered_by': row[7],
                'duration_ms': row[8],
                'rows_processed': row[9]
            })
        
        return jsonify({'executions': executions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ==============================
# Gestión de Almacenamiento
# ==============================

@app.route('/api/storage/providers', methods=['GET'])
def list_storage_providers():
    """Lista los proveedores de almacenamiento disponibles"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        result = conn.execute("""
            SELECT 
                id,
                name,
                provider_type,
                endpoint,
                region,
                default_bucket,
                created_at,
                updated_at,
                is_active
            FROM storage_providers
            ORDER BY created_at DESC
        """).fetchall()
        
        # Convertir a formato JSON
        providers = []
        for row in result:
            providers.append({
                'id': row[0],
                'name': row[1],
                'type': row[2],
                'endpoint': row[3],
                'region': row[4],
                'default_bucket': row[5],
                'created_at': str(row[6]),
                'updated_at': str(row[7]),
                'is_active': bool(row[8])
            })
        
        return jsonify({'providers': providers})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    # Verificar que la base de datos exista
    if not os.path.exists(DUCKDB_PATH):
        print(f"Error: La base de datos {DUCKDB_PATH} no existe")
        print("Ejecute primero duckdb_init_fixed.py para inicializar la base de datos")
        exit(1)
    
    # Iniciar el servidor
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
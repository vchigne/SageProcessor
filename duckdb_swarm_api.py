#!/usr/bin/env python3
"""
API REST para gestionar el enjambre (swarm) de servidores DuckDB

Este script proporciona una API REST para:
1. Listar servidores DuckDB
2. Agregar/eliminar servidores
3. Listar bases de datos
4. Agregar/eliminar bases de datos
5. Monitorear métricas de servidores
6. Verificar conexiones a bases de datos
7. Ejecutar consultas SQL en bases de datos

Se puede integrar con la plataforma SAGE existente
"""
import os
import duckdb
import json
import time
import uuid
import random
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

if __name__ == '__main__':
    # Verificar que la base de datos exista
    if not os.path.exists(DUCKDB_PATH):
        print(f"Error: La base de datos {DUCKDB_PATH} no existe")
        print("Ejecute primero duckdb_init_fixed.py para inicializar la base de datos")
        exit(1)
    
    # Iniciar el servidor
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
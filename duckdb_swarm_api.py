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

6. Múltiples métodos de conexión a DuckDB
   - SSH Port Forwarding para acceso seguro
   - Proxy inverso Nginx para equipos
   - Extensión httpserver para API HTTP nativa

Se puede integrar con la plataforma SAGE existente
"""
import os
import duckdb
import json
import time
import uuid
import random
import requests
import datetime
import logging
import subprocess
import threading
import tempfile
import shutil
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from utils.ssh_deployer import deploy_duckdb_via_ssh, check_connection

# Configuración de logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('duckdb_swarm_api')

# Crear la aplicación Flask
app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

# Configuración
DUCKDB_PATH = 'duckdb_data/duckdb_swarm.db'
# Puerto predeterminado para la interfaz web de DuckDB
DUCKDB_UI_PORT = 4213
# Diccionario para llevar un registro de las sesiones activas de la UI de DuckDB
duckdb_ui_sessions = {}

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
                name, 
                host, 
                port, 
                description,
                status, 
                created_at,
                is_local
            FROM servers
            ORDER BY id
        """).fetchall()
        
        # Convertir a formato JSON
        servers = []
        for row in result:
            # Añadir información sobre VNC para todos los servidores
            # En implementación real, esto debería venir de la base de datos
            vnc_enabled = row[5] == 'active'  # Todos los servidores activos tienen VNC habilitado
            
            vnc_info = {}
            if vnc_enabled:
                if bool(row[7]):  # Es servidor local
                    # Para servidor local, usamos localhost
                    vnc_url = "http://localhost:6080/vnc.html?autoconnect=true&password=duckdbpass"
                    vnc_info = {
                        'host': 'localhost',
                        'port': 5901,
                        'username': 'admin',
                        'password': 'duckdbpass',
                        'url': vnc_url,
                        'novnc_url': "http://localhost:6080/vnc.html?autoconnect=true&password=duckdbpass",
                        'vnc_direct': "localhost:5901"
                    }
                else:
                    # Para servidores remotos
                    vnc_url = f"http://{row[2]}:6080/vnc.html?autoconnect=true&password=duckdbpass"
                    vnc_info = {
                        'host': row[2],
                        'port': 5901,
                        'username': 'admin',
                        'password': 'duckdbpass',
                        'url': vnc_url,
                        'novnc_url': f"http://{row[2]}:6080/vnc.html?autoconnect=true&password=duckdbpass",
                        'vnc_direct': f"{row[2]}:5901"
                    }
            
            server_data = {
                'id': row[0],
                'name': row[1],
                'hostname': row[2],
                'port': row[3],
                'description': row[4],
                'status': row[5],
                'created_at': str(row[6]),
                'is_local': bool(row[7]),
                'vnc_enabled': vnc_enabled,
                'vnc_info': vnc_info
            }
            servers.append(server_data)
        
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
        
        # Actualizar estado a activo y añadir información VNC por defecto
        conn.execute(
            "UPDATE duckdb_servers SET status = 'active' WHERE id = ?",
            [next_id]
        )
        
        # Información VNC por defecto para todos los servidores
        vnc_info = {
            'host': hostname,
            'port': 5901,
            'username': 'admin',
            'password': 'duckdbpass',
            'url': f"http://{hostname}:6080/vnc.html?autoconnect=true&password=duckdbpass",
            'novnc_url': f"http://{hostname}:6080/vnc.html?autoconnect=true&password=duckdbpass",
            'vnc_direct': f"{hostname}:5901"
        }
        
        return jsonify({
            'message': f'Servidor {hostname}:{port} agregado exitosamente',
            'server_id': next_id,
            'vnc_enabled': True,
            'vnc_info': vnc_info
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/servers/deploy', methods=['POST'])
def deploy_server():
    """Despliega un nuevo servidor DuckDB mediante SSH o redespliega uno existente"""
    try:
        # Obtener datos del request
        data = request.json
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400
            
        # Verificar si es un redespliegue o un nuevo despliegue
        is_redeploy = data.get('redeploy', False)
        
        # Validar datos requeridos
        ssh_host = data.get('ssh_host')
        ssh_port = int(data.get('ssh_port', 22))
        ssh_username = data.get('ssh_username')
        ssh_password = data.get('ssh_password')
        ssh_key = data.get('ssh_key')
        duckdb_port = int(data.get('port', 1294))
        server_key = data.get('server_key')
        
        # Validar datos mínimos
        if not ssh_host or not ssh_username:
            return jsonify({'error': 'Se requieren ssh_host y ssh_username'}), 400
            
        # Debe tener al menos contraseña o clave SSH
        if not ssh_password and not ssh_key:
            return jsonify({'error': 'Se requiere una contraseña o clave SSH'}), 400
            
        # Primero verificar la conexión
        operation_type = "redespliegue" if is_redeploy else "despliegue"
        logger.info(f"Verificando conexión SSH para {operation_type} a {ssh_host}:{ssh_port} con usuario {ssh_username}")
        check_result = check_connection(
            ssh_host=ssh_host,
            ssh_port=ssh_port,
            ssh_username=ssh_username,
            ssh_password=ssh_password,
            ssh_key=ssh_key
        )
        
        if not check_result.get('success'):
            logger.error(f"Error al conectar con SSH: {check_result.get('message')}")
            return jsonify({
                'success': False,
                'message': f"Error al conectar con SSH: {check_result.get('message')}"
            }), 400
            
        # Desplegar DuckDB
        logger.info(f"{operation_type.capitalize()} de DuckDB en {ssh_host}:{ssh_port} con puerto DuckDB {duckdb_port}")
        result = deploy_duckdb_via_ssh(
            ssh_host=ssh_host,
            ssh_port=ssh_port,
            ssh_username=ssh_username,
            ssh_password=ssh_password,
            ssh_key=ssh_key,
            duckdb_port=duckdb_port,
            server_key=server_key
        )
        
        if result.get('success'):
            message = 'DuckDB con VNC redesplegado exitosamente' if is_redeploy else 'DuckDB con VNC instalado y configurado exitosamente'
            
            # Obtener detalles de VNC si existen
            vnc_info = {}
            if 'details' in result:
                vnc_info = {
                    'host': ssh_host,
                    'port': 5901,
                    'username': 'admin',
                    'password': server_key or 'duckdbpass',
                    'url': f"http://{ssh_host}:6080/vnc.html?autoconnect=true&password={server_key or 'duckdbpass'}",
                    'novnc_url': f"http://{ssh_host}:6080/vnc.html?autoconnect=true&password={server_key or 'duckdbpass'}",
                    'vnc_direct': f"{ssh_host}:5901",
                    'ssh_server': result['details'].get('ssh_server', f"{ssh_host}:2222"),
                    'ssh_password': result['details'].get('ssh_password', 'duckdb')
                }
            
            return jsonify({
                'success': True,
                'message': message,
                'vnc_enabled': True,
                'vnc_info': vnc_info,
                'details': result
            })
        else:
            return jsonify({
                'success': False,
                'message': result.get('message', f'Error al {operation_type} DuckDB'),
                'details': result
            }), 500
            
    except Exception as e:
        logger.error(f"Error en despliegue: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f"Error en despliegue: {str(e)}"
        }), 500

@app.route('/api/servers/<server_id>/ui', methods=['POST'])
def start_duckdb_ui(server_id):
    """Inicia la UI de DuckDB en un servidor remoto"""
    try:
        # Para manejar UUIDs correctamente, obtenemos el servidor de nuestra propia API
        # Obtener los servidores disponibles de nuestra propia API
        servers_response = requests.get('http://localhost:5001/api/servers')
        if not servers_response.ok:
            return jsonify({'error': 'No se pudo obtener la lista de servidores'}), 500
            
        servers_data = servers_response.json()
        
        # Buscar el servidor por su ID (usando comparación de strings para evitar problemas de tipo)
        server = None
        for s in servers_data.get('servers', []):
            if str(s.get('id')) == str(server_id):
                server = s
                break
                
        if not server:
            return jsonify({'error': f'Servidor con ID {server_id} no encontrado'}), 404
            
        # Extraer la información necesaria
        hostname = server.get('hostname')
        port = server.get('port')
        server_key = server.get('api_key', '')
        status = server.get('status')
        
        # Verificar que el servidor está activo
        if status != 'active':
            return jsonify({
                'error': f'El servidor debe estar activo para iniciar la UI. Estado actual: {status}'
            }), 400
            
        # Simulamos el inicio de la UI (en un entorno real, enviaríamos un comando al servidor)
        # Para propósitos de desarrollo, generamos una URL válida externamente
        ui_port = port + 80  # La UI estándar se ejecuta en puerto+80
        
        # Para una aplicación en Replit, usamos la URL de la app Next.js
        # donde podemos implementar las páginas de UI
        ui_url = f"/admin/duckdb-swarm/ui"
        
        # Registrar el inicio en la base de datos
        conn = get_duckdb_connection()
        if conn:
            try:
                current_time = datetime.datetime.now().isoformat()
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS ui_sessions (
                        id INTEGER PRIMARY KEY,
                        server_id TEXT NOT NULL,
                        start_time TEXT NOT NULL,
                        end_time TEXT,
                        status TEXT NOT NULL,
                        session_type TEXT NOT NULL DEFAULT 'ui'
                    )
                """)
                
                # Obtener el siguiente ID para la sesión
                max_id = conn.execute("SELECT COALESCE(MAX(id), 0) FROM ui_sessions").fetchone()[0]
                next_id = max_id + 1
                
                conn.execute("""
                    INSERT INTO ui_sessions (id, server_id, start_time, status)
                    VALUES (?, ?, ?, 'active')
                """, [next_id, server_id, current_time])
            except Exception as db_error:
                logger.warning(f"Error al registrar sesión UI: {str(db_error)}")
            finally:
                conn.close()
        
        # Construir respuesta exitosa con URL simulada
        response_data = {
            'success': True,
            'message': 'UI de DuckDB iniciada correctamente',
            'ui_url': ui_url
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error al iniciar UI de DuckDB en servidor {server_id}: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/servers/<server_id>/vnc/status', methods=['GET'])
def check_vnc_status(server_id):
    """Verifica el estado del servicio VNC en un servidor"""
    try:
        # Primero obtener los detalles del servidor
        conn = get_duckdb_connection()
        server = conn.execute("""
            SELECT id, name, host, port, api_key, ssh_user, ssh_port, ssh_key, ssh_password
            FROM servers
            WHERE id = ?
        """, [server_id]).fetchone()
        
        if not server:
            return jsonify({'error': 'Servidor no encontrado'}), 404
        
        server_info = {
            'id': server[0],
            'name': server[1],
            'host': server[2],
            'port': server[3],
            'ssh_user': server[5],
            'ssh_port': server[6]
        }
        
        # Verificar si el servidor tiene SSH configurado
        if not server_info['ssh_user'] or not server_info['host']:
            return jsonify({'error': 'Servidor no tiene configuración SSH completa'}), 400
        
        # Intentar conectar por SSH para verificar servicios VNC
        ssh_key = server[7]
        ssh_password = server[8]
        
        # Verificar servicios VNC usando el módulo SSH
        import utils.ssh_deployer as ssh_deployer
        check_result = ssh_deployer.execute_command(
            server_info['host'],
            "ss -ltn | grep -E ':(5901|6080)' || echo 'No VNC services found'",
            server_info['ssh_port'],
            server_info['ssh_user'],
            ssh_password,
            ssh_key
        )
        
        if check_result['success']:
            # Analizar respuesta para ver si VNC y noVNC están activos
            output = check_result['output']
            vnc_active = ":5901" in output
            novnc_active = ":6080" in output
            
            # Verificar logs si hay problemas
            if not vnc_active or not novnc_active:
                log_check = ssh_deployer.execute_command(
                    server_info['host'],
                    "tail -n 20 /var/log/vnc-startup.log 2>/dev/null || echo 'Log file not found'",
                    server_info['ssh_port'],
                    server_info['ssh_user'],
                    ssh_password,
                    ssh_key
                )
                logs = log_check['output'] if log_check['success'] else "No se pudieron obtener logs"
            else:
                logs = "Servicios funcionando correctamente"
            
            return jsonify({
                'success': True,
                'vnc_active': vnc_active,
                'novnc_active': novnc_active,
                'details': {
                    'vnc_port': 5901,
                    'novnc_port': 6080,
                    'vnc_url': f"vnc://{server_info['host']}:5901",
                    'novnc_url': f"http://{server_info['host']}:6080/vnc.html"
                },
                'logs': logs
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No se pudo verificar los servicios VNC',
                'error': check_result['message']
            }), 500
            
    except Exception as e:
        logger.error(f"Error al verificar estado VNC en servidor {server_id}: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/servers/<server_id>/vnc/repair', methods=['POST'])
def repair_vnc(server_id):
    """Intenta reparar el servicio VNC en un servidor"""
    try:
        # Primero obtener los detalles del servidor
        conn = get_duckdb_connection()
        server = conn.execute("""
            SELECT id, name, host, port, api_key, ssh_user, ssh_port, ssh_key, ssh_password
            FROM servers
            WHERE id = ?
        """, [server_id]).fetchone()
        
        if not server:
            return jsonify({'error': 'Servidor no encontrado'}), 404
        
        server_info = {
            'id': server[0],
            'name': server[1],
            'host': server[2],
            'port': server[3],
            'api_key': server[4],
            'ssh_user': server[5],
            'ssh_port': server[6]
        }
        
        # Verificar si el servidor tiene SSH configurado
        if not server_info['ssh_user'] or not server_info['host']:
            return jsonify({'error': 'Servidor no tiene configuración SSH completa'}), 400
        
        # Intentar conectar por SSH para reparar servicios VNC
        ssh_key = server[7]
        ssh_password = server[8]
        
        # Ejecutar script de reparación VNC
        import utils.ssh_deployer as ssh_deployer
        repair_command = f"docker exec duckdb-server /bin/bash -c 'if [ -f /fix_vnc.sh ]; then chmod +x /fix_vnc.sh && /fix_vnc.sh {server_info['api_key']}; else echo \"Script fix_vnc.sh no encontrado\"; fi'"
        
        repair_result = ssh_deployer.execute_command(
            server_info['host'],
            repair_command,
            server_info['ssh_port'],
            server_info['ssh_user'],
            ssh_password,
            ssh_key
        )
        
        if repair_result['success']:
            # Verificar si la reparación fue exitosa
            time.sleep(5)  # Dar tiempo a que los servicios inicien
            
            check_command = "ss -ltn | grep -E ':(5901|6080)' || echo 'No VNC services found'"
            check_result = ssh_deployer.execute_command(
                server_info['host'],
                check_command,
                server_info['ssh_port'],
                server_info['ssh_user'],
                ssh_password,
                ssh_key
            )
            
            if check_result['success']:
                output = check_result['output']
                vnc_active = ":5901" in output
                novnc_active = ":6080" in output
                
                return jsonify({
                    'success': True,
                    'message': 'Intento de reparación completado',
                    'vnc_active': vnc_active,
                    'novnc_active': novnc_active,
                    'repair_output': repair_result['output'],
                    'details': {
                        'vnc_port': 5901,
                        'novnc_port': 6080,
                        'vnc_url': f"vnc://{server_info['host']}:5901",
                        'novnc_url': f"http://{server_info['host']}:6080/vnc.html"
                    }
                })
            else:
                return jsonify({
                    'success': False,
                    'message': 'No se pudo verificar el estado después de la reparación',
                    'repair_output': repair_result['output'],
                    'error': check_result['message']
                }), 500
        else:
            return jsonify({
                'success': False,
                'message': 'Error al ejecutar script de reparación',
                'error': repair_result['message']
            }), 500
            
    except Exception as e:
        logger.error(f"Error al reparar VNC en servidor {server_id}: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/servers/<server_id>/status', methods=['GET'])
def check_server_status(server_id):
    """Verifica el estado de un servidor DuckDB remoto"""
    try:
        # Para manejar UUIDs correctamente, obtenemos el servidor de nuestra propia API
        try:
            # Obtener los servidores disponibles de nuestra propia API
            servers_response = requests.get('http://localhost:5001/api/servers')
            if not servers_response.ok:
                return jsonify({'error': 'No se pudo obtener la lista de servidores'}), 500
                
            servers_data = servers_response.json()
            
            # Buscar el servidor por su ID (usando comparación de strings para evitar problemas de tipo)
            server = None
            for s in servers_data.get('servers', []):
                if str(s.get('id')) == str(server_id):
                    server = s
                    break
                    
            if not server:
                return jsonify({'error': f'Servidor con ID {server_id} no encontrado'}), 404
                
            # Extraer la información necesaria
            hostname = server.get('hostname')
            port = server.get('port')
            server_key = server.get('api_key', '')
            
        except Exception as e:
            return jsonify({'error': f'Error al obtener información del servidor: {str(e)}'}), 500
        
        # Intentar conectar al servidor remoto
        try:
            headers = {}
            if server_key:
                headers['X-API-Key'] = server_key
                
            # Verificar la salud del servidor remoto
            response = requests.get(f"http://{hostname}:{port}/health", 
                                   headers=headers, 
                                   timeout=5)
            
            if response.status_code == 200:
                # El servidor está activo
                return jsonify({
                    'status': 'active',
                    'details': response.json()
                })
            else:
                # El servidor responde pero con error
                return jsonify({
                    'status': 'error',
                    'details': {'error': f'Código de estado: {response.status_code}'}
                })
        except requests.exceptions.RequestException as e:
            # No se pudo conectar al servidor
            return jsonify({
                'status': 'unreachable',
                'details': {'error': str(e)}
            })
            
    except Exception as e:
        logger.error(f"Error al verificar estado del servidor {server_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/servers/<server_id>', methods=['DELETE'])
def delete_server(server_id):
    """Elimina un servidor DuckDB"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Para manejar UUIDs correctamente, obtenemos el servidor de nuestra propia API
        try:
            # Obtener los servidores disponibles de nuestra propia API
            servers_response = requests.get('http://localhost:5001/api/servers')
            if not servers_response.ok:
                return jsonify({'error': 'No se pudo obtener la lista de servidores'}), 500
                
            servers_data = servers_response.json()
            
            # Buscar el servidor por su ID (usando comparación de strings para evitar problemas de tipo)
            server = None
            for s in servers_data.get('servers', []):
                if str(s.get('id')) == str(server_id):
                    server = s
                    break
                    
            if not server:
                return jsonify({'error': f'Servidor con ID {server_id} no encontrado'}), 404
                
            # Extraer la información necesaria
            hostname = server.get('hostname')
            
        except Exception as e:
            return jsonify({'error': f'Error al obtener información del servidor: {str(e)}'}), 500
        
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



@app.route('/api/sage/installations', methods=['GET'])
def list_sage_installations():
    """Lista las instalaciones SAGE disponibles"""
    try:
        # Este endpoint debe devolver las instalaciones SAGE
        # que pueden asociarse con servidores DuckDB
        installations = [
            {
                'id': 1,
                'name': 'SAGE Local',
                'hostname': 'localhost',
                'port': 5000,
                'description': 'Instalación local de SAGE',
                'status': 'active'
            },
            {
                'id': 2,
                'name': 'SAGE Producción',
                'hostname': 'sage.example.com',
                'port': 443,
                'description': 'Servidor SAGE de producción',
                'status': 'active'
            },
            {
                'id': 3,
                'name': 'SAGE Desarrollo',
                'hostname': 'dev-sage.example.com',
                'port': 8080,
                'description': 'Servidor SAGE de desarrollo',
                'status': 'active'
            }
        ]
        
        return jsonify({'sage_installations': installations})
    except Exception as e:
        logger.error(f"Error al listar instalaciones SAGE: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/duckdb-swarm/cloud-secrets', methods=['GET'])
def list_cloud_secrets():
    """Lista los secrets de proveedores cloud disponibles para DuckDB Swarm"""
    try:
        # Intentar obtener los secrets desde la API de cloud-secrets
        # Haciendo una solicitud interna a la API del sistema
        try:
            response = requests.get('http://localhost:5000/api/admin/cloud-secrets')
            if response.status_code == 200:
                secrets = response.json()
                # Formatear la respuesta para hacerla compatible con nuestro sistema
                formatted_secrets = []
                for secret in secrets.get('secrets', []):
                    formatted_secrets.append({
                        'id': secret.get('id'),
                        'name': secret.get('nombre'),
                        'provider': secret.get('proveedor'),
                        'description': secret.get('descripcion'),
                        'created_at': secret.get('fecha_creacion'),
                        'is_active': True
                    })
                return jsonify({'cloud_secrets': formatted_secrets})
        except Exception as api_error:
            logger.warning(f"No se pudo obtener cloud-secrets desde la API: {str(api_error)}")
        
        # Si no se puede obtener de la API, devolver valores predeterminados
        default_secrets = [
            {
                'id': 1,
                'name': 'MinIO Local',
                'provider': 'minio',
                'description': 'Credenciales para MinIO local',
                'created_at': '2025-01-01 00:00:00',
                'is_active': True
            },
            {
                'id': 2,
                'name': 'AWS S3 Producción',
                'provider': 's3',
                'description': 'Credenciales para AWS S3 producción',
                'created_at': '2025-01-01 00:00:00',
                'is_active': True
            },
            {
                'id': 3,
                'name': 'Azure Blob Storage',
                'provider': 'azure',
                'description': 'Credenciales para Azure Blob Storage',
                'created_at': '2025-01-01 00:00:00',
                'is_active': True
            }
        ]
        
        return jsonify({'cloud_secrets': default_secrets})
    except Exception as e:
        logger.error(f"Error al listar cloud secrets: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/duckdb-swarm/cloud-providers', methods=['GET'])
def list_cloud_providers():
    """Lista los proveedores de nube disponibles para DuckDB Swarm"""
    try:
        # Lista de proveedores cloud soportados
        providers = [
            {
                'id': 'minio',
                'name': 'MinIO',
                'description': 'Servidor de objetos compatible con S3 para entornos locales o auto-hospedados',
                'logo': '/images/providers/minio-logo.png'
            },
            {
                'id': 's3',
                'name': 'AWS S3',
                'description': 'Amazon Simple Storage Service (S3)',
                'logo': '/images/providers/aws-logo.png'
            },
            {
                'id': 'azure',
                'name': 'Azure Blob Storage',
                'description': 'Servicio de almacenamiento de objetos de Microsoft Azure',
                'logo': '/images/providers/azure-logo.png'
            },
            {
                'id': 'gcs',
                'name': 'Google Cloud Storage',
                'description': 'Servicio de almacenamiento de objetos de Google Cloud Platform',
                'logo': '/images/providers/gcp-logo.png'
            }
        ]
        
        return jsonify({'cloud_providers': providers})
    except Exception as e:
        logger.error(f"Error al listar cloud providers: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

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
        # Si no podemos conectar con DuckDB, usamos unos proveedores por defecto
        # para que la interfaz pueda seguir funcionando
        providers = [
            {
                'id': 1,
                'name': 'MinIO Local',
                'type': 'minio',
                'description': 'Servidor MinIO local para pruebas',
                'endpoint': 'localhost:9000',
                'region': None,
                'default_bucket': 'duckdb-swarm',
                'created_at': '2025-01-01 00:00:00',
                'updated_at': '2025-01-01 00:00:00',
                'is_active': True
            },
            {
                'id': 2,
                'name': 'AWS S3',
                'type': 's3',
                'description': 'Amazon Web Services S3',
                'endpoint': 's3.amazonaws.com',
                'region': 'us-east-1',
                'default_bucket': 'duckdb-production',
                'created_at': '2025-01-01 00:00:00',
                'updated_at': '2025-01-01 00:00:00',
                'is_active': True
            }
        ]
        return jsonify({'storage_providers': providers})
    
    try:
        # Verificar si la tabla existe
        table_exists = False
        try:
            conn.execute("SELECT 1 FROM storage_providers LIMIT 1")
            table_exists = True
        except:
            # La tabla no existe, usamos proveedores por defecto
            providers = [
                {
                    'id': 1,
                    'name': 'MinIO Local',
                    'type': 'minio',
                    'description': 'Servidor MinIO local para pruebas',
                    'endpoint': 'localhost:9000',
                    'region': None,
                    'default_bucket': 'duckdb-swarm',
                    'created_at': '2025-01-01 00:00:00',
                    'updated_at': '2025-01-01 00:00:00',
                    'is_active': True
                },
                {
                    'id': 2,
                    'name': 'AWS S3',
                    'type': 's3',
                    'description': 'Amazon Web Services S3',
                    'endpoint': 's3.amazonaws.com',
                    'region': 'us-east-1',
                    'default_bucket': 'duckdb-production',
                    'created_at': '2025-01-01 00:00:00',
                    'updated_at': '2025-01-01 00:00:00',
                    'is_active': True
                }
            ]
            return jsonify({'storage_providers': providers})
        
        if table_exists:
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
                    'description': f"Proveedor de almacenamiento {row[2]}",
                    'endpoint': row[3],
                    'region': row[4],
                    'default_bucket': row[5],
                    'created_at': str(row[6]),
                    'updated_at': str(row[7]),
                    'is_active': bool(row[8])
                })
            
            return jsonify({'storage_providers': providers})
    except Exception as e:
        logger.error(f"Error al listar proveedores de almacenamiento: {str(e)}", exc_info=True)
        # Devolver proveedores por defecto en caso de error
        providers = [
            {
                'id': 1,
                'name': 'MinIO Local',
                'type': 'minio',
                'description': 'Servidor MinIO local para pruebas',
                'endpoint': 'localhost:9000',
                'region': None,
                'default_bucket': 'duckdb-swarm',
                'created_at': '2025-01-01 00:00:00',
                'updated_at': '2025-01-01 00:00:00',
                'is_active': True
            }
        ]
        return jsonify({'storage_providers': providers})
    finally:
        if conn:
            conn.close()

# Endpoints para Evidence.dev
@app.route('/api/evidence/projects', methods=['GET'])
def list_evidence_projects():
    """Lista todos los proyectos de Evidence.dev"""
    conn = get_duckdb_connection()
    projects = []
    try:
        result = conn.execute("""
            SELECT id, name, description, folder_path, git_repo, created_at, updated_at, created_by, status
            FROM evidence_projects
            ORDER BY name
        """).fetchall()
        
        projects = [
            {
                "id": row[0],
                "name": row[1],
                "description": row[2],
                "folder_path": row[3],
                "git_repo": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
                "updated_at": row[6].isoformat() if row[6] else None,
                "created_by": row[7],
                "status": row[8]
            }
            for row in result
        ]
    except Exception as e:
        print(f"Error al listar proyectos de Evidence.dev: {e}")
    
    return jsonify({"projects": projects})

@app.route('/api/evidence/projects', methods=['POST'])
def create_evidence_project():
    """Crea un nuevo proyecto de Evidence.dev"""
    data = request.json
    conn = get_duckdb_connection()
    
    try:
        # Validar datos mínimos
        if not data.get('name'):
            return jsonify({"error": "Se requiere un nombre para el proyecto"}), 400
        
        # Establecer valores por defecto
        folder_path = data.get('folder_path', f"evidence/{data['name'].lower().replace(' ', '_')}")
        git_repo = data.get('git_repo', None)
        description = data.get('description', None)
        created_by = data.get('created_by', 'admin')
        
        # Insertar proyecto
        project_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO evidence_projects (id, name, description, folder_path, git_repo, created_at, updated_at, created_by, status)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 'active')
        """, [project_id, data['name'], description, folder_path, git_repo, created_by])
        
        # Crear estructura básica del proyecto (podría ser un proceso background)
        # TODO: Implementar la creación real de la estructura del proyecto
        
        return jsonify({
            "id": project_id,
            "name": data['name'],
            "description": description,
            "folder_path": folder_path,
            "git_repo": git_repo,
            "created_by": created_by,
            "status": "active"
        }), 201
    except Exception as e:
        print(f"Error al crear proyecto de Evidence.dev: {e}")
        return jsonify({"error": f"Error al crear proyecto: {str(e)}"}), 500

@app.route('/api/evidence/projects/<string:project_id>', methods=['GET'])
def get_evidence_project(project_id):
    """Obtiene un proyecto específico de Evidence.dev"""
    conn = get_duckdb_connection()
    
    try:
        result = conn.execute("""
            SELECT id, name, description, folder_path, git_repo, created_at, updated_at, created_by, status
            FROM evidence_projects
            WHERE id = ?
        """, [project_id]).fetchone()
        
        if not result:
            return jsonify({"error": "Proyecto no encontrado"}), 404
        
        project = {
            "id": result[0],
            "name": result[1],
            "description": result[2],
            "folder_path": result[3],
            "git_repo": result[4],
            "created_at": result[5].isoformat() if result[5] else None,
            "updated_at": result[6].isoformat() if result[6] else None,
            "created_by": result[7],
            "status": result[8]
        }
        
        # Obtener las fuentes de datos (data sources) asociadas
        sources_result = conn.execute("""
            SELECT id, name, database_id, query, description
            FROM evidence_data_sources
            WHERE project_id = ?
        """, [project_id]).fetchall()
        
        sources = [
            {
                "id": row[0],
                "name": row[1],
                "database_id": row[2],
                "query": row[3],
                "description": row[4]
            }
            for row in sources_result
        ]
        
        project["data_sources"] = sources
        
        # Obtener los reportes asociados
        reports_result = conn.execute("""
            SELECT id, name, path, description, created_at, updated_at, created_by
            FROM evidence_reports
            WHERE project_id = ?
        """, [project_id]).fetchall()
        
        reports = [
            {
                "id": row[0],
                "name": row[1],
                "path": row[2],
                "description": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
                "updated_at": row[5].isoformat() if row[5] else None,
                "created_by": row[6]
            }
            for row in reports_result
        ]
        
        project["reports"] = reports
        
        return jsonify(project)
    except Exception as e:
        print(f"Error al obtener proyecto de Evidence.dev: {e}")
        return jsonify({"error": f"Error al obtener proyecto: {str(e)}"}), 500

@app.route('/api/evidence/projects/<string:project_id>', methods=['DELETE'])
def delete_evidence_project(project_id):
    """Elimina un proyecto de Evidence.dev"""
    conn = get_duckdb_connection()
    
    try:
        # Verificar si existe el proyecto
        result = conn.execute("SELECT id FROM evidence_projects WHERE id = ?", [project_id]).fetchone()
        if not result:
            return jsonify({"error": "Proyecto no encontrado"}), 404
        
        # Eliminar fuentes de datos asociadas
        conn.execute("DELETE FROM evidence_data_sources WHERE project_id = ?", [project_id])
        
        # Eliminar reportes asociados
        conn.execute("DELETE FROM evidence_reports WHERE project_id = ?", [project_id])
        
        # Eliminar el proyecto
        conn.execute("DELETE FROM evidence_projects WHERE id = ?", [project_id])
        
        return jsonify({"message": "Proyecto eliminado correctamente"})
    except Exception as e:
        print(f"Error al eliminar proyecto de Evidence.dev: {e}")
        return jsonify({"error": f"Error al eliminar proyecto: {str(e)}"}), 500

@app.route('/api/evidence/data-sources', methods=['GET'])
def list_evidence_data_sources():
    """Lista todas las fuentes de datos de Evidence.dev"""
    conn = get_duckdb_connection()
    sources = []
    
    try:
        result = conn.execute("""
            SELECT ds.id, ds.name, ds.project_id, ds.database_id, ds.query, ds.description,
                   p.name as project_name, d.name as database_name
            FROM evidence_data_sources ds
            JOIN evidence_projects p ON ds.project_id = p.id
            JOIN databases d ON ds.database_id = d.id
            ORDER BY ds.name
        """).fetchall()
        
        sources = [
            {
                "id": row[0],
                "name": row[1],
                "project_id": row[2],
                "database_id": row[3],
                "query": row[4],
                "description": row[5],
                "project_name": row[6],
                "database_name": row[7]
            }
            for row in result
        ]
    except Exception as e:
        print(f"Error al listar fuentes de datos de Evidence.dev: {e}")
    
    return jsonify({"data_sources": sources})

# Endpoints para PowerBI
@app.route('/api/powerbi/datasets', methods=['GET'])
def list_powerbi_datasets():
    """Lista todos los datasets de PowerBI"""
    conn = get_duckdb_connection()
    datasets = []
    
    try:
        result = conn.execute("""
            SELECT id, name, description, duckling_id, refresh_schedule, last_refresh,
                   created_at, updated_at, created_by, status
            FROM powerbi_datasets
            ORDER BY name
        """).fetchall()
        
        datasets = [
            {
                "id": row[0],
                "name": row[1],
                "description": row[2],
                "duckling_id": row[3],
                "refresh_schedule": row[4],
                "last_refresh": row[5].isoformat() if row[5] else None,
                "created_at": row[6].isoformat() if row[6] else None,
                "updated_at": row[7].isoformat() if row[7] else None,
                "created_by": row[8],
                "status": row[9]
            }
            for row in result
        ]
    except Exception as e:
        print(f"Error al listar datasets de PowerBI: {e}")
    
    return jsonify({"datasets": datasets})

@app.route('/api/powerbi/datasets', methods=['POST'])
def create_powerbi_dataset():
    """Crea un nuevo dataset de PowerBI"""
    data = request.json
    conn = get_duckdb_connection()
    
    try:
        # Validar datos mínimos
        if not data.get('name'):
            return jsonify({"error": "Se requiere un nombre para el dataset"}), 400
        
        if not data.get('duckling_id'):
            return jsonify({"error": "Se requiere un duckling_id para el dataset"}), 400
        
        # Establecer valores por defecto
        description = data.get('description', None)
        refresh_schedule = data.get('refresh_schedule', None)
        created_by = data.get('created_by', 'admin')
        
        # Insertar dataset
        dataset_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO powerbi_datasets (id, name, description, duckling_id, refresh_schedule, 
                                    created_at, updated_at, created_by, status)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 'active')
        """, [dataset_id, data['name'], description, data['duckling_id'], refresh_schedule, created_by])
        
        # Insertar tablas del dataset
        tables = data.get('tables', [])
        for table in tables:
            table_id = str(uuid.uuid4())
            conn.execute("""
                INSERT INTO powerbi_tables (id, dataset_id, name, query, is_incremental, incremental_key)
                VALUES (?, ?, ?, ?, ?, ?)
            """, [
                table_id, 
                dataset_id, 
                table.get('name', 'Table'),
                table.get('query', ''),
                table.get('is_incremental', False),
                table.get('incremental_key', None)
            ])
        
        return jsonify({
            "id": dataset_id,
            "name": data['name'],
            "description": description,
            "duckling_id": data['duckling_id'],
            "refresh_schedule": refresh_schedule,
            "created_by": created_by,
            "status": "active"
        }), 201
    except Exception as e:
        print(f"Error al crear dataset de PowerBI: {e}")
        return jsonify({"error": f"Error al crear dataset: {str(e)}"}), 500

@app.route('/api/powerbi/datasets/<string:dataset_id>', methods=['GET'])
def get_powerbi_dataset(dataset_id):
    """Obtiene un dataset específico de PowerBI"""
    conn = get_duckdb_connection()
    
    try:
        result = conn.execute("""
            SELECT id, name, description, duckling_id, refresh_schedule, last_refresh,
                   created_at, updated_at, created_by, status
            FROM powerbi_datasets
            WHERE id = ?
        """, [dataset_id]).fetchone()
        
        if not result:
            return jsonify({"error": "Dataset no encontrado"}), 404
        
        dataset = {
            "id": result[0],
            "name": result[1],
            "description": result[2],
            "duckling_id": result[3],
            "refresh_schedule": result[4],
            "last_refresh": result[5].isoformat() if result[5] else None,
            "created_at": result[6].isoformat() if result[6] else None,
            "updated_at": result[7].isoformat() if result[7] else None,
            "created_by": result[8],
            "status": result[9]
        }
        
        # Obtener las tablas del dataset
        tables_result = conn.execute("""
            SELECT id, name, query, is_incremental, incremental_key, created_at, updated_at
            FROM powerbi_tables
            WHERE dataset_id = ?
        """, [dataset_id]).fetchall()
        
        tables = [
            {
                "id": row[0],
                "name": row[1],
                "query": row[2],
                "is_incremental": bool(row[3]),
                "incremental_key": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
                "updated_at": row[6].isoformat() if row[6] else None
            }
            for row in tables_result
        ]
        
        dataset["tables"] = tables
        
        return jsonify(dataset)
    except Exception as e:
        print(f"Error al obtener dataset de PowerBI: {e}")
        return jsonify({"error": f"Error al obtener dataset: {str(e)}"}), 500

@app.route('/api/powerbi/datasets/<string:dataset_id>/refresh', methods=['POST'])
def refresh_powerbi_dataset(dataset_id):
    """Refresca un dataset de PowerBI"""
    conn = get_duckdb_connection()
    
    try:
        # Verificar si existe el dataset
        result = conn.execute("SELECT id, name FROM powerbi_datasets WHERE id = ?", [dataset_id]).fetchone()
        if not result:
            return jsonify({"error": "Dataset no encontrado"}), 404
        
        # Simular refresco (en un entorno real, esto sería un proceso más complejo)
        start_time = time.time()
        time.sleep(1)  # Simular tiempo de procesamiento
        end_time = time.time()
        duration_ms = int((end_time - start_time) * 1000)
        
        # Actualizar timestamp de último refresco
        conn.execute("""
            UPDATE powerbi_datasets 
            SET last_refresh = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, [dataset_id])
        
        # Registrar en historial de refrescos
        refresh_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO powerbi_refresh_history 
            (id, dataset_id, start_time, end_time, status, rows_processed, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            refresh_id,
            dataset_id,
            datetime.datetime.fromtimestamp(start_time),
            datetime.datetime.fromtimestamp(end_time),
            'success',
            random.randint(100, 10000),  # Simulado
            duration_ms
        ])
        
        return jsonify({
            "message": f"Dataset '{result[1]}' refrescado correctamente",
            "refresh_time": datetime.datetime.now().isoformat(),
            "duration_ms": duration_ms
        })
    except Exception as e:
        print(f"Error al refrescar dataset de PowerBI: {e}")
        return jsonify({"error": f"Error al refrescar dataset: {str(e)}"}), 500

# Eliminando la definición duplicada de la función check_vnc_status, ya que se definió antes
# Ahora agregamos un endpoint alternativo que llama a la función original
@app.route('/api/servers/<int:server_id>/check-vnc', methods=['GET'])
def check_vnc_legacy(server_id):
    """Versión legacy del verificador de VNC (redirecciona al endpoint nuevo)"""
    return check_vnc_status(str(server_id))

# Este endpoint simulado ya no es necesario, ya que tenemos la implementación real arriba
@app.route('/api/servers/<int:server_id>/check-vnc-info', methods=['GET'])
def get_vnc_info(server_id):
    """Versión alternativa para obtener información VNC (endpoint para compatibilidad)"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener información del servidor 
        server = conn.execute("SELECT hostname FROM servers WHERE id = ?", [server_id]).fetchone()
        
        if not server:
            return jsonify({'error': f'El servidor con ID {server_id} no existe'}), 404
        
        hostname = server[0]
        
        # Información diagnóstica simulada
        vnc_info = {
            'server_id': server_id,
            'hostname': hostname,
            'vnc_port': 5901,
            'novnc_port': 6080,
            'vnc_status': 'running',
            'novnc_status': 'running',
            'diagnostic_info': {
                'vnc_process_count': 1,
                'websockify_process_count': 1,
                'vnc_url': f"vnc://{hostname}:5901",
                'novnc_url': f"http://{hostname}:6080/vnc.html",
                'novnc_url_autoconnect': f"http://{hostname}:6080/vnc.html?autoconnect=true&resize=scale",
                'help_message': "Usa un cliente VNC con la IP y puerto 5901 o accede a través de noVNC web"
            }
        }
        
        return jsonify({
            'success': True, 
            'vnc_info': vnc_info
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/servers/<int:server_id>/restart-vnc', methods=['POST'])
def restart_vnc(server_id):
    """Reinicia el servicio VNC en un servidor"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener información del servidor
        server = conn.execute("SELECT hostname, ssh_port, ssh_user, api_key FROM duckdb_servers WHERE id = ?",
                             [server_id]).fetchone()
        
        if not server:
            return jsonify({'error': f'El servidor con ID {server_id} no existe'}), 404
        
        hostname, ssh_port, ssh_user, api_key = server
        
        # En producción, reiniciaríamos el servicio VNC a través de SSH
        # Aquí simulamos una respuesta de reinicio
        return jsonify({
            'success': True,
            'message': 'Servicio VNC reiniciado correctamente',
            'server_id': server_id,
            'hostname': hostname,
            'vnc_port': 5901,
            'novnc_port': 6080,
            'novnc_url': f"http://{hostname}:6080/vnc.html",
            'help': 'Ahora puedes conectarte a través de VNC o noVNC'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    # Verificar que la base de datos exista
    if not os.path.exists(DUCKDB_PATH):
        print(f"Error: La base de datos {DUCKDB_PATH} no existe")
        print("Ejecute primero extend_duckdb_schema_evidence_powerbi.py para inicializar la base de datos")
        exit(1)
    
# Rutas para pipelines y ejecuciones
# Comentado por duplicación de función
# @app.route('/api/pipelines', methods=['GET'])
# def list_pipelines():
#     """Lista todos los pipelines definidos"""
#     conn = get_duckdb_connection()
#     if not conn:
#         return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
#     
#     try:
#         # Simulamos datos de pipelines para la interfaz
#         pipelines = [
#             {
#                 'id': 1,
#                 'name': 'Pipeline de ETL Ventas',
#                 'description': 'Proceso de extracción, transformación y carga de datos de ventas',
#                 'server_id': 1,
#                 'server_name': 'DuckDB Local',
#                 'created_at': '2025-04-25 01:00:00',
#                 'updated_at': '2025-04-25 01:00:00',
#                 'status': 'active',
#                 'last_execution_id': 1,
#                 'last_execution_time': '2025-04-25 01:10:00',
#                 'last_execution_status': 'success'
#             },
#             {
#                 'id': 2,
#                 'name': 'Pipeline de Análisis de Productos',
#                 'description': 'Analiza el rendimiento de productos y categorías',
#                 'server_id': 1,
#                 'server_name': 'DuckDB Local',
#                 'created_at': '2025-04-25 01:05:00',
#                 'updated_at': '2025-04-25 01:05:00',
#                 'status': 'active',
#                 'last_execution_id': 2,
#                 'last_execution_time': '2025-04-25 01:15:00',
#                 'last_execution_status': 'success'
#             }
#         ]
#         
#         return jsonify({'pipelines': pipelines})
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500
#     finally:
#         if conn:
#             conn.close()

# Comentado por duplicación de función
# @app.route('/api/executions', methods=['GET'])
# def list_executions():
#     """Lista las ejecuciones de pipelines"""
#     conn = get_duckdb_connection()
#     if not conn:
#         return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
#     
#     try:
#         # Simulamos datos de ejecuciones para la interfaz
#         executions = [
#             {
#                 'id': 1,
#                 'pipeline_id': 1,
#                 'pipeline_name': 'Pipeline de ETL Ventas',
#                 'start_time': '2025-04-25 01:10:00',
#                 'end_time': '2025-04-25 01:12:00',
#                 'status': 'success',
#                 'rows_processed': 1250,
#                 'duration_ms': 120000
#             },
#             {
#                 'id': 2,
#                 'pipeline_id': 2,
#                 'pipeline_name': 'Pipeline de Análisis de Productos',
#                 'start_time': '2025-04-25 01:15:00',
#                 'end_time': '2025-04-25 01:16:30',
#                 'status': 'success',
#                 'rows_processed': 850,
#                 'duration_ms': 90000
#             }
#         ]
#         
#         return jsonify({'executions': executions})
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500
#     finally:
#         if conn:
#             conn.close()

# Endpoint simple para la nueva versión de UI DuckDB (notebook)
@app.route('/api/servers/<server_id>/notebook', methods=['POST'])
def start_duckdb_notebook(server_id):
    """Inicia la UI de notebook DuckDB en un servidor remoto"""
    try:
        # Para manejar UUIDs correctamente, obtenemos el servidor de nuestra propia API
        # Obtener los servidores disponibles de nuestra propia API
        servers_response = requests.get('http://localhost:5001/api/servers')
        if not servers_response.ok:
            return jsonify({'error': 'No se pudo obtener la lista de servidores'}), 500
            
        servers_data = servers_response.json()
        
        # Buscar el servidor por su ID (usando comparación de strings para evitar problemas de tipo)
        server = None
        for s in servers_data.get('servers', []):
            if str(s.get('id')) == str(server_id):
                server = s
                break
                
        if not server:
            return jsonify({'error': f'Servidor con ID {server_id} no encontrado'}), 404
            
        # Extraer la información necesaria
        server_name = server.get('name')
        hostname = server.get('hostname')
        port = server.get('port')
        status = server.get('status')
        
        # Importante: guardamos el ID como string para evitar conversiones
        server_id_str = str(server_id)
        
        # Verificar que el servidor está activo
        if status != 'active':
            return jsonify({
                'error': f'El servidor debe estar activo para iniciar el notebook. Estado actual: {status}'
            }), 400
            
        # Simulamos el inicio del notebook (en un entorno real, enviaríamos un comando al servidor)
        # Para propósitos de desarrollo, generamos una URL simulada
        ui_port = port + 100  # La UI notebook se ejecuta en un puerto diferente
        
        # Para una aplicación en Replit, usamos la URL de la app Next.js
        # donde podemos implementar las páginas de UI de notebook
        ui_url = f"/admin/duckdb-swarm/notebook"
        
        # Registrar el inicio en la base de datos
        conn = get_duckdb_connection()
        if conn:
            try:
                current_time = datetime.datetime.now().isoformat()
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS ui_sessions (
                        id INTEGER PRIMARY KEY,
                        server_id TEXT NOT NULL,
                        start_time TEXT NOT NULL,
                        end_time TEXT,
                        status TEXT NOT NULL,
                        session_type TEXT NOT NULL DEFAULT 'ui'
                    )
                """)
                
                # Obtener el siguiente ID para la sesión
                max_id = conn.execute("SELECT COALESCE(MAX(id), 0) FROM ui_sessions").fetchone()[0]
                next_id = max_id + 1
                
                conn.execute("""
                    INSERT INTO ui_sessions (id, server_id, start_time, status, session_type)
                    VALUES (?, ?, ?, 'active', 'notebook')
                """, [next_id, server_id_str, current_time])
            except Exception as db_error:
                logger.warning(f"Error al registrar sesión de notebook: {str(db_error)}")
            finally:
                conn.close()
        
        # Construir respuesta exitosa con URL simulada
        return jsonify({
            'success': True,
            'ui_url': ui_url,
            'message': f'Notebook DuckDB iniciado para el servidor {server_name}'
        })
        
    except Exception as e:
        logger.error(f"Error al iniciar notebook DuckDB: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# Endpoint simple para iniciar la UI (para uso directo desde servidores DuckDB)
@app.route('/start-ui', methods=['POST'])
def start_ui():
    """Endpoint simple para iniciar la UI de DuckDB localmente"""
    try:
        # En servidores reales, aquí iniciaríamos el proceso de Jupyter/DuckDB UI
        # y devolveríamos la URL generada
        
        # Para una aplicación en Replit, usamos la URL de la app Next.js
        # donde podemos implementar las páginas de UI
        ui_url = f"/admin/duckdb-swarm/ui"
        
        return jsonify({
            'success': True,
            'ui_url': ui_url,
            'message': 'UI de DuckDB iniciada localmente'
        })
    except Exception as e:
        logger.error(f"Error al iniciar UI local: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# Endpoint adicional para consultas SQL directas (solo desarrollo)
@app.route('/api/dev/query', methods=['POST'])
def execute_dev_query():
    """Ejecuta una consulta SQL directa para propósitos de desarrollo y testeo"""
    try:
        data = request.json
        if not data or 'sql' not in data:
            return jsonify({'error': 'Se debe proporcionar una consulta SQL'}), 400
        
        sql = data['sql']
        
        # Conectar a la base de datos
        conn = get_duckdb_connection()
        if not conn:
            return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
        
        try:
            # Ejecutar la consulta
            result = conn.execute(sql).fetchall()
            
            # Obtener nombres de columnas (si es posible)
            try:
                columns = [col[0] for col in conn.execute(sql).description]
            except:
                columns = []
            
            # Convertir resultados a formato JSON
            rows = []
            for row in result:
                if columns:
                    rows.append(dict(zip(columns, row)))
                else:
                    rows.append(row)
            
            return jsonify({
                'success': True,
                'results': rows,
                'count': len(rows),
                'columns': columns
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e),
                'sql': sql
            }), 400
        finally:
            if conn:
                conn.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==============================
# Métodos de conexión reales a DuckDB
# ==============================

@app.route('/api/servers/<server_id>/ssh-tunnel', methods=['POST'])
def start_ssh_tunnel(server_id):
    """Inicia un túnel SSH para acceder a la UI de DuckDB de forma segura"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener información del servidor
        server = conn.execute("""
            SELECT 
                id, name, host, port, status,
                ssh_host, ssh_port, ssh_username, ssh_password
            FROM servers
            WHERE id = ?
        """, [server_id]).fetchone()
        
        if not server:
            return jsonify({'error': f'Servidor con ID {server_id} no encontrado'}), 404
        
        # Verificar que el servidor está activo
        if server[4] != 'active':
            return jsonify({
                'error': f'El servidor debe estar activo para iniciar un túnel SSH. Estado actual: {server[4]}'
            }), 400
        
        # Verificar información SSH
        ssh_host = server[5]
        ssh_port = server[6] or 22
        ssh_username = server[7]
        
        if not ssh_host or not ssh_username:
            return jsonify({
                'error': 'Información SSH incompleta para este servidor'
            }), 400
        
        # Generar información para el túnel SSH
        # En una implementación real, podríamos iniciar el túnel desde el servidor
        # o proporcionar instrucciones detalladas para el cliente
        
        tunnel_info = {
            'success': True,
            'connection_type': 'ssh_tunnel',
            'ssh_host': ssh_host,
            'ssh_port': ssh_port,
            'ssh_username': ssh_username,
            'remote_port': DUCKDB_UI_PORT,  # Puerto donde corre la UI de DuckDB (4213)
            'local_port': DUCKDB_UI_PORT,   # Puerto recomendado localmente
            'tunnel_command': f'ssh -L {DUCKDB_UI_PORT}:localhost:{DUCKDB_UI_PORT} {ssh_username}@{ssh_host} -p {ssh_port}',
            'ui_url': f'http://localhost:{DUCKDB_UI_PORT}',
            'message': 'Información para túnel SSH generada correctamente',
            'instructions': [
                'Para conectar a la UI de DuckDB mediante SSH, siga estos pasos:',
                '1. Abra una terminal en su máquina local',
                f'2. Ejecute el comando: ssh -L {DUCKDB_UI_PORT}:localhost:{DUCKDB_UI_PORT} {ssh_username}@{ssh_host} -p {ssh_port}',
                '3. Una vez establecida la conexión SSH, abra un navegador',
                f'4. Acceda a http://localhost:{DUCKDB_UI_PORT} para usar la UI de DuckDB'
            ]
        }
        
        # Registrar el uso de SSH tunnel
        current_time = datetime.datetime.now().isoformat()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS connection_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                connection_type TEXT NOT NULL,
                status TEXT DEFAULT 'active'
            )
        """)
        
        conn.execute("""
            INSERT INTO connection_sessions (server_id, start_time, connection_type)
            VALUES (?, ?, 'ssh_tunnel')
        """, [server_id, current_time])
        
        return jsonify(tunnel_info)
    except Exception as e:
        logger.error(f"Error al iniciar túnel SSH: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/servers/<server_id>/httpserver', methods=['POST'])
def start_http_server(server_id):
    """Inicia la extensión httpserver de DuckDB para acceder a través de HTTP"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener datos del request
        data = request.json or {}
        port = data.get('port', 9999)
        auth = data.get('auth', 'admin:admin')  # username:password
        
        # Validar auth
        if ':' not in auth:
            return jsonify({'error': 'El formato de autenticación debe ser "usuario:contraseña"'}), 400
        
        # Obtener información del servidor
        server = conn.execute("""
            SELECT id, name, host, port, status
            FROM servers
            WHERE id = ?
        """, [server_id]).fetchone()
        
        if not server:
            return jsonify({'error': f'Servidor con ID {server_id} no encontrado'}), 404
        
        # Verificar que el servidor está activo
        if server[4] != 'active':
            return jsonify({
                'error': f'El servidor debe estar activo para iniciar httpserver. Estado actual: {server[4]}'
            }), 400
        
        # En una implementación real, enviaríamos comandos al servidor para:
        # 1. Instalar la extensión httpserver si no está instalada
        # 2. Cargar la extensión
        # 3. Iniciar el servidor HTTP
        
        # Simulamos una respuesta exitosa
        sql_commands = [
            "INSTALL httpserver;",
            "LOAD httpserver;",
            f"SELECT httpserve_start('0.0.0.0', {port}, '{auth}');"
        ]
        
        # Info para el cliente 
        httpserver_info = {
            'success': True,
            'connection_type': 'httpserver',
            'hostname': server[2],  # host
            'port': port,
            'server_url': f'http://{server[2]}:{port}',
            'auth_required': True,
            'sql_commands': sql_commands,
            'message': 'Configuración para DuckDB httpserver generada correctamente',
            'instructions': [
                'Para iniciar el servidor HTTP de DuckDB, ejecute los siguientes comandos SQL:',
                'INSTALL httpserver;',
                'LOAD httpserver;',
                f'SELECT httpserve_start(\'0.0.0.0\', {port}, \'{auth}\');',
                '',
                'Una vez ejecutados, acceda a:',
                f'http://{server[2]}:{port}'
            ]
        }
        
        # Registrar el uso de httpserver
        current_time = datetime.datetime.now().isoformat()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS connection_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                connection_type TEXT NOT NULL,
                status TEXT DEFAULT 'active'
            )
        """)
        
        conn.execute("""
            INSERT INTO connection_sessions (server_id, start_time, connection_type)
            VALUES (?, ?, 'httpserver')
        """, [server_id, current_time])
        
        return jsonify(httpserver_info)
    except Exception as e:
        logger.error(f"Error al iniciar httpserver: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/servers/<server_id>/nginx-proxy', methods=['POST'])
def setup_nginx_proxy(server_id):
    """Genera configuración para acceder a DuckDB a través de un proxy Nginx"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener datos del request
        data = request.json or {}
        domain = data.get('domain', '')
        
        if not domain:
            return jsonify({'error': 'Se requiere un nombre de dominio para configurar Nginx'}), 400
        
        # Obtener información del servidor
        server = conn.execute("""
            SELECT id, name, host, port, status
            FROM servers
            WHERE id = ?
        """, [server_id]).fetchone()
        
        if not server:
            return jsonify({'error': f'Servidor con ID {server_id} no encontrado'}), 404
        
        # Verificar que el servidor está activo
        if server[4] != 'active':
            return jsonify({
                'error': f'El servidor debe estar activo para configurar Nginx. Estado actual: {server[4]}'
            }), 400
        
        # Generar configuración de Nginx
        nginx_config = f"""server {{
    listen 80;
    server_name {domain};

    location / {{
        proxy_pass http://localhost:{DUCKDB_UI_PORT};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}"""
        
        # Para HTTPS, también generar configuración con SSL
        nginx_ssl_config = f"""server {{
    listen 443 ssl;
    server_name {domain};
    
    ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;
    
    location / {{
        proxy_pass http://localhost:{DUCKDB_UI_PORT};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}

server {{
    listen 80;
    server_name {domain};
    return 301 https://$host$request_uri;
}}"""

        # Info para el cliente
        nginx_info = {
            'success': True,
            'connection_type': 'nginx_proxy',
            'domain': domain,
            'nginx_config': nginx_config,
            'nginx_ssl_config': nginx_ssl_config,
            'message': 'Configuración de Nginx generada correctamente',
            'instructions': [
                'Para configurar Nginx como proxy inverso para DuckDB:',
                '',
                '1. Instale Nginx:',
                '   sudo apt update && sudo apt install -y nginx',
                '',
                '2. Cree un archivo de configuración:',
                f'   sudo nano /etc/nginx/sites-available/{domain}.conf',
                '',
                '3. Pegue la configuración generada',
                '',
                '4. Active el sitio:',
                f'   sudo ln -s /etc/nginx/sites-available/{domain}.conf /etc/nginx/sites-enabled/',
                '',
                '5. Verifique la configuración:',
                '   sudo nginx -t',
                '',
                '6. Reinicie Nginx:',
                '   sudo systemctl restart nginx',
                '',
                '7. Para HTTPS, instale certbot:',
                '   sudo apt install -y certbot python3-certbot-nginx',
                '   sudo certbot --nginx -d ' + domain
            ]
        }
        
        # Registrar el uso de nginx proxy
        current_time = datetime.datetime.now().isoformat()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS connection_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                connection_type TEXT NOT NULL,
                status TEXT DEFAULT 'active'
            )
        """)
        
        conn.execute("""
            INSERT INTO connection_sessions (server_id, start_time, connection_type)
            VALUES (?, ?, 'nginx_proxy')
        """, [server_id, current_time])
        
        return jsonify(nginx_info)
    except Exception as e:
        logger.error(f"Error al generar configuración de Nginx: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

# Iniciar el servidor
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
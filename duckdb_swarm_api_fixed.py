#!/usr/bin/env python3
"""
API REST para gestionar el enjambre (swarm) de servidores DuckDB
Versión actualizada con soporte mejorado para VNC
"""

import os
import sys
import glob
import time
import json
import random
import logging
import datetime
import uuid
import subprocess
import signal
import threading
import traceback
from pathlib import Path
import requests

try:
    import duckdb
except ImportError:
    print("DuckDB no está instalado. Instalando...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "duckdb"])
    import duckdb

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError:
    print("Flask o Flask-CORS no están instalados. Instalando...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "flask", "flask-cors"])
    from flask import Flask, request, jsonify
    from flask_cors import CORS

# Configuración de logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constantes
DUCKDB_PATH = "duckdb_swarm.db"
DEPLOYER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'utils', 'ssh_deployer.py')

# Crear aplicación Flask
app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

def get_duckdb_connection():
    """Obtiene una conexión a la base de datos DuckDB"""
    try:
        conn = duckdb.connect(DUCKDB_PATH)
        # Inicializar tablas si no existen
        conn.execute("""
            CREATE TABLE IF NOT EXISTS servers (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                api_key TEXT,
                ssh_user TEXT,
                ssh_port INTEGER DEFAULT 22,
                ssh_key TEXT,
                ssh_password TEXT,
                status TEXT DEFAULT 'pending',
                last_seen TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT
            )
        """)
        return conn
    except Exception as e:
        logger.error(f"Error al conectar a DuckDB: {e}")
        return None

# Rutas de la API

@app.route('/health', methods=['GET'])
def health_check():
    """Ruta para verificar el estado de la API"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "version": "1.2.2"
    })

@app.route('/api/servers', methods=['GET'])
def list_servers():
    """Lista todos los servidores DuckDB registrados"""
    conn = get_duckdb_connection()
    if not conn:
        return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
    
    try:
        # Obtener servidores
        results = conn.execute("""
            SELECT id, name, host, port, api_key, ssh_user, ssh_port, 
                   ssh_key IS NOT NULL as has_ssh_key, 
                   ssh_password IS NOT NULL as has_ssh_password,
                   status, last_seen, created_at, updated_at
            FROM servers
            ORDER BY id DESC
        """).fetchall()
        
        servers = []
        for row in results:
            servers.append({
                'id': row[0],
                'name': row[1],
                'hostname': row[2],
                'port': row[3],
                'api_key': row[4],
                'ssh_user': row[5],
                'ssh_port': row[6],
                'has_ssh_key': bool(row[7]),
                'has_ssh_password': bool(row[8]),
                'status': row[9],
                'last_seen': row[10],
                'created_at': row[11],
                'updated_at': row[12]
            })
        
        return jsonify({'servers': servers})
    except Exception as e:
        logger.error(f"Error al listar servidores: {str(e)}")
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
        data = request.json
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400
        
        name = data.get('name')
        host = data.get('hostname')
        port = data.get('port', 8000)
        api_key = data.get('api_key')
        ssh_user = data.get('ssh_user')
        ssh_port = data.get('ssh_port', 22)
        ssh_key = data.get('ssh_key')
        ssh_password = data.get('ssh_password')
        
        if not name or not host:
            return jsonify({'error': 'Se requieren nombre y hostname'}), 400
        
        # Verificar si ya existe un servidor con el mismo host y puerto
        existing = conn.execute("""
            SELECT id FROM servers WHERE host = ? AND port = ?
        """, [host, port]).fetchone()
        
        if existing:
            return jsonify({'error': f'Ya existe un servidor con hostname {host} y puerto {port}'}), 409
        
        # Insertar nuevo servidor
        current_time = datetime.datetime.now().isoformat()
        result = conn.execute("""
            INSERT INTO servers (name, host, port, api_key, ssh_user, ssh_port, ssh_key, ssh_password, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            RETURNING id
        """, [name, host, port, api_key, ssh_user, ssh_port, ssh_key, ssh_password, current_time])
        
        server_id = result.fetchone()[0]
        
        return jsonify({
            'success': True,
            'server_id': server_id,
            'message': f'Servidor {name} agregado correctamente'
        })
    except Exception as e:
        logger.error(f"Error al agregar servidor: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/servers/deploy', methods=['POST'])
def deploy_server():
    """Despliega un nuevo servidor DuckDB mediante SSH o redespliega uno existente"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400
        
        # Variable para almacenar si se debe cerrar una conexión a BD
        conn = None
        
        # Compatibilidad con ambas versiones de la API
        # 1. Verificar si se envían datos directos (como lo hace la UI en redeploy.js)
        if 'ssh_host' in data and 'ssh_username' in data:
            # Modo redeploy directo desde la UI
            server_info = {
                'id': data.get('server_id', 0),  # Puede ser 0 para nuevo despliegue
                'name': data.get('name', 'Servidor DuckDB'),
                'host': data.get('ssh_host'),
                'port': data.get('port', 8000),
                'api_key': data.get('server_key', ''),
                'ssh_user': data.get('ssh_username'),
                'ssh_port': data.get('ssh_port', 22),
                'ssh_key': data.get('ssh_key', ''),
                'ssh_password': data.get('ssh_password', '')
            }
            
            # Registrar actividad en logs para diagnóstico
            logger.info(f"Solicitud directa de despliegue para {server_info['host']} con usuario {server_info['ssh_user']}")
            
            # Verificar datos mínimos necesarios
            if not server_info['host'] or not server_info['ssh_user']:
                return jsonify({'error': 'Se requiere host y usuario SSH para el despliegue'}), 400
            
            # Debe tener al menos contraseña o clave SSH
            if not server_info['ssh_password'] and not server_info['ssh_key']:
                return jsonify({'error': 'Se requiere una contraseña o clave SSH para el despliegue'}), 400
                
        # 2. O si se envía un server_id para obtener la info de la base de datos
        elif 'server_id' in data:
            server_id = data.get('server_id')
            logger.info(f"Solicitud de despliegue para servidor con ID {server_id}")
            
            # Obtener información del servidor
            conn = get_duckdb_connection()
            if not conn:
                return jsonify({'error': 'No se pudo conectar a DuckDB'}), 500
            
            server = conn.execute("""
                SELECT id, name, host, port, api_key, ssh_user, ssh_port, ssh_key, ssh_password
                FROM servers
                WHERE id = ?
            """, [server_id]).fetchone()
            
            if not server:
                return jsonify({'error': f'No se encontró el servidor con ID {server_id}'}), 404
            
            server_info = {
                'id': server[0],
                'name': server[1],
                'host': server[2],
                'port': server[3],
                'api_key': server[4],
                'ssh_user': server[5],
                'ssh_port': server[6],
                'ssh_key': server[7],
                'ssh_password': server[8]
            }
            
            # Verificar si tiene información SSH
            if not server_info['ssh_user'] or not server_info['host']:
                return jsonify({'error': 'El servidor no tiene configuración SSH completa'}), 400
        else:
            # Log para diagnóstico
            logger.warning(f"Solicitud de despliegue sin datos suficientes: {data}")
            return jsonify({'error': 'Se requiere ID del servidor o datos de conexión SSH'}), 400
        
        # Importar el módulo deployer (primero intentar systemd, luego fallback a método antiguo)
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Intentar usar el deployer systemd primero
        try:
            import utils.ssh_deployer_systemd as ssh_deployer_systemd
            
            # Intentar el despliegue con systemd
            result = ssh_deployer_systemd.deploy_duckdb_via_ssh(
                ssh_host=server_info['host'],
                ssh_port=server_info['ssh_port'],
                ssh_username=server_info['ssh_user'],
                ssh_password=server_info['ssh_password'],
                ssh_key=server_info['ssh_key'],
                duckdb_port=server_info['port'],
                server_key=server_info['api_key']
            )
            
            # Si fue exitoso o al menos llegó a iniciar el despliegue, utilizar ese resultado
            if result and 'success' in result:
                logger.info(f"Despliegue systemd exitoso para {server_info['host']}")
                # Continuar con el resultado
            else:
                # Si no hay resultado o falló, intentar con método antiguo
                raise Exception("Método systemd no devolvió resultado válido")
                
        except Exception as e:
            # Fallback a método antiguo basado en Docker
            logger.warning(f"Error en despliegue systemd, usando método Docker antiguo: {str(e)}")
            import utils.ssh_deployer as ssh_deployer
            
            # Desplegar el servidor con método antiguo
            result = ssh_deployer.deploy_duckdb_via_ssh(
                ssh_host=server_info['host'],
                ssh_port=server_info['ssh_port'],
                ssh_username=server_info['ssh_user'],
                ssh_password=server_info['ssh_password'],
                ssh_key=server_info['ssh_key'],
                duckdb_port=server_info['port'],
                server_key=server_info['api_key']
            )
        
        if result['success']:
            # Actualizar estado del servidor en la base de datos si tiene id válido
            if server_info['id'] > 0:
                try:
                    conn = get_duckdb_connection()
                    if conn:
                        conn.execute("""
                            UPDATE servers
                            SET status = 'active', updated_at = ?
                            WHERE id = ?
                        """, [datetime.datetime.now().isoformat(), server_info['id']])
                except Exception as e:
                    logger.warning(f"Error al actualizar estado del servidor: {e}")
            
            return jsonify({
                'success': True,
                'message': f'Servidor {server_info["name"]} desplegado correctamente',
                'details': result['details'] if 'details' in result else {},
                'server_id': server_info['id']
            })
        else:
            return jsonify({
                'success': False,
                'message': result['message'],
                'server_id': server_info['id']
            })
    
    except Exception as e:
        logger.error(f"Error al desplegar servidor: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
    finally:
        if 'conn' in locals() and conn:
            conn.close()

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
            'api_key': server[4],
            'ssh_user': server[5],
            'ssh_port': server[6]
        }
        
        # Verificar si el servidor tiene SSH configurado
        if not server_info['ssh_user'] or not server_info['host']:
            return jsonify({'error': 'Servidor no tiene configuración SSH completa'}), 400
        
        # Intentar conectar por SSH para verificar servicios VNC
        ssh_key = server[7]
        ssh_password = server[8]
        
        # Verificar servicios VNC usando el módulo SSH (intentar primero systemd)
        try:
            import utils.ssh_deployer_systemd as ssh_deployer_systemd
            
            # Comando para verificar puertos en ambos tipos de instalación (Docker o systemd)
            check_command = "ss -ltn | grep -E ':(5901|6080|6082)' || echo 'No VNC services found'"
            
            check_result = ssh_deployer_systemd.execute_command(
                server_info['host'],
                check_command,
                server_info['ssh_port'],
                server_info['ssh_user'],
                ssh_password,
                ssh_key
            )
        except Exception as e:
            # Fallback a método antiguo
            logger.warning(f"Error usando método systemd para verificar VNC, usando método antiguo: {str(e)}")
            import utils.ssh_deployer as ssh_deployer
            
            check_result = ssh_deployer.execute_command(
                server_info['host'],
                "ss -ltn | grep -E ':(5901|6080|6082)' || echo 'No VNC services found'",
                server_info['ssh_port'],
                server_info['ssh_user'],
                ssh_password,
                ssh_key
            )
        
        if check_result['success']:
            # Analizar respuesta para ver si VNC y noVNC están activos
            output = check_result['output']
            vnc_active = ":5901" in output
            # Verificar ambos puertos posibles para noVNC (6080 para Docker, 6082 para systemd)
            novnc_active = ":6080" in output or ":6082" in output
            # Determinar qué puerto se está usando para noVNC
            novnc_port = 6082 if ":6082" in output else 6080
            
            # Verificar logs si hay problemas
            if not vnc_active or not novnc_active:
                # Importar ssh_deployer si no se ha importado antes
                if 'ssh_deployer' not in locals() and 'ssh_deployer' not in globals():
                    import utils.ssh_deployer as ssh_deployer
                    
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
                    'novnc_port': novnc_port,
                    'vnc_url': f"vnc://{server_info['host']}:5901",
                    'novnc_url': f"http://{server_info['host']}:{novnc_port}" + ("/vnc.html" if novnc_port == 6082 else "")
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
    finally:
        if 'conn' in locals() and conn:
            conn.close()

@app.route('/api/servers/<server_id>/vnc/repair', methods=['POST'])
def repair_vnc(server_id):
    """Intenta reparar el servicio VNC en un servidor"""
    if request.method != 'POST':
        return jsonify({"error": "Method not allowed, use POST"}), 405

    try:
        # Obtener conexión a la base de datos
        conn = get_duckdb_connection()
        
        # Obtener información del servidor
        server = conn.execute(
            "SELECT id, name, host, port, api_key, ssh_user, ssh_port, ssh_key, ssh_password " +
            "FROM servers WHERE id = ?",
            [server_id]
        ).fetchone()
        
        if not server:
            return jsonify({"error": f"Servidor con ID {server_id} no encontrado"}), 404
            
        # Extraer información del servidor
        server_id, server_name, hostname, api_port, api_key, ssh_user, ssh_port, ssh_key, ssh_password = server
        
        # Verificar si el servidor tiene SSH configurado
        if not ssh_user or not hostname:
            return jsonify({'error': 'Servidor no tiene configuración SSH completa'}), 400
        
        # Importar el módulo SSH para realizar operaciones remotas
        import sys
        import os
        utils_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'utils')
        sys.path.append(utils_path)
        
        # Intentar primero usar el deployer systemd, si falla usar el antiguo
        try:
            from utils.ssh_deployer_systemd import repair_vnc_systemd
            
            # Llamar a la función de reparación systemd
            result = repair_vnc_systemd(
                ssh_host=hostname,
                ssh_port=ssh_port,
                ssh_username=ssh_user,
                ssh_password=ssh_password,
                ssh_key=ssh_key
            )
            
            # Si fue exitoso o al menos logró conectarse, usar el resultado
            if result and ('success' in result or 'message' in result):
                return jsonify({
                    "success": result.get('success', False),
                    "message": result.get('message', 'Reparación VNC ejecutada'),
                    "vnc_active": result.get('vnc_active', False),
                    "novnc_active": result.get('novnc_active', False),
                    "repair_output": result.get('status_output', ''),
                    "details": result.get('details', {
                        "vnc_port": 5901,
                        "novnc_port": 6082,
                        "vnc_url": f"vnc://{hostname}:5901",
                        "novnc_url": f"http://{hostname}:6082/vnc.html"
                    })
                })
        except Exception as e:
            # Si hay un error importando o ejecutando la función systemd, usar el método antiguo
            logger.warning(f"Error usando método systemd para reparar VNC, probando método antiguo: {str(e)}")
            
        # Método antiguo basado en scripts específicos para cada tipo de instalación
        from utils.ssh_deployer import execute_command, transfer_file
        
        # Primero transferir el script actualizado si es necesario
        script_path = "/home/runner/workspace/deploy_scripts/fix_vnc.sh"
        transfer_result = transfer_file(
            hostname,
            script_path,
            "/tmp/fix_vnc.sh",
            ssh_port,
            ssh_user,
            ssh_password,
            ssh_key
        )
        
        # Preparar el comando para ejecutar el script (con la API key como contraseña)
        if transfer_result['success']:
            repair_command = f"chmod +x /tmp/fix_vnc.sh && sudo /tmp/fix_vnc.sh {api_key}"
        else:
            # Intentar usar el script existente si la transferencia falla
            repair_command = f"if [ -f /deploy_scripts/fix_vnc.sh ]; then chmod +x /deploy_scripts/fix_vnc.sh && sudo /deploy_scripts/fix_vnc.sh {api_key}; elif [ -f /fix_vnc.sh ]; then chmod +x /fix_vnc.sh && sudo /fix_vnc.sh {api_key}; else echo \"Script fix_vnc.sh no encontrado\"; fi"
            
            # Si la transferencia falló por autenticación, intentar otro método
            if "Authentication failed" in transfer_result.get('message', ''):
                # Retornar mensaje más informativo cuando falla autenticación
                return jsonify({
                    'success': False,
                    'message': f"Error de autenticación SSH para el servidor {server_name} ({hostname})",
                    'error': "No se pudo conectar al servidor mediante SSH. Verifique las credenciales.",
                    'details': {
                        'host': hostname,
                        'ssh_port': ssh_port,
                        'ssh_user': ssh_user,
                        'auth_error': transfer_result.get('message', 'Error de autenticación')
                    }
                }), 401
        
        repair_result = execute_command(
            hostname,
            repair_command,
            ssh_port,
            ssh_user,
            ssh_password,
            ssh_key
        )
        
        # Verificar si falló la autenticación
        if not repair_result['success'] and "Authentication failed" in repair_result.get('message', ''):
            return jsonify({
                'success': False,
                'message': f"Error de autenticación SSH para el servidor {server_name} ({hostname})",
                'error': "No se pudo conectar al servidor mediante SSH. Verifique las credenciales.",
                'details': {
                    'host': hostname,
                    'ssh_port': ssh_port,
                    'ssh_user': ssh_user,
                    'auth_error': repair_result.get('message', 'Error de autenticación')
                }
            }), 401
        
        if repair_result['success']:
            # Verificar si la reparación fue exitosa
            time.sleep(5)  # Dar tiempo a que los servicios inicien
            
            check_command = "ss -ltn | grep -E ':(5901|6080|6082)' || echo 'No VNC services found'"
            check_result = execute_command(
                hostname,
                check_command,
                ssh_port,
                ssh_user,
                ssh_password,
                ssh_key
            )
            
            if check_result['success']:
                output = check_result['output']
                vnc_active = ":5901" in output
                # Verificar ambos puertos posibles para noVNC
                novnc_active = ":6080" in output or ":6082" in output
                
                return jsonify({
                    'success': True,
                    'message': 'Intento de reparación completado',
                    'vnc_active': vnc_active,
                    'novnc_active': novnc_active,
                    'repair_output': repair_result['output'],
                    'details': {
                        'vnc_port': 5901,
                        'novnc_port': 6082 if ":6082" in output else 6080,
                        'vnc_url': f"vnc://{hostname}:5901",
                        'novnc_url': f"http://{hostname}:" + ("6082/vnc.html" if ":6082" in output else "6080")
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
    finally:
        if 'conn' in locals() and conn:
            conn.close()

@app.route('/api/servers/<int:server_id>/check-vnc', methods=['GET'])
def check_vnc_legacy(server_id):
    """Versión legacy del verificador de VNC (redirecciona al endpoint nuevo)"""
    return check_vnc_status(str(server_id))

# Endpoint para obtener los proveedores de almacenamiento
@app.route('/api/storage/providers', methods=['GET'])
def list_storage_providers():
    """Lista los proveedores de almacenamiento disponibles"""
    providers = [
        {
            'id': 'aws',
            'name': 'Amazon S3',
            'icon': 'aws.svg',
            'description': 'Amazon Simple Storage Service (S3)',
            'credential_fields': [
                {'name': 'access_key', 'label': 'Access Key', 'type': 'text', 'required': True},
                {'name': 'secret_key', 'label': 'Secret Key', 'type': 'password', 'required': True},
                {'name': 'region', 'label': 'Region', 'type': 'text', 'required': True}
            ]
        },
        {
            'id': 'azure',
            'name': 'Azure Blob Storage',
            'icon': 'azure.svg',
            'description': 'Microsoft Azure Blob Storage',
            'credential_fields': [
                {'name': 'storage_account', 'label': 'Storage Account', 'type': 'text', 'required': True},
                {'name': 'storage_key', 'label': 'Storage Key', 'type': 'password', 'required': True}
            ]
        },
        {
            'id': 'gcp',
            'name': 'Google Cloud Storage',
            'icon': 'gcp.svg',
            'description': 'Google Cloud Storage',
            'credential_fields': [
                {'name': 'project_id', 'label': 'Project ID', 'type': 'text', 'required': True},
                {'name': 'client_email', 'label': 'Client Email', 'type': 'text', 'required': True},
                {'name': 'private_key', 'label': 'Private Key', 'type': 'textarea', 'required': True}
            ]
        },
        {
            'id': 'minio',
            'name': 'MinIO',
            'icon': 'minio.svg',
            'description': 'Self-hosted object storage compatible with S3 API',
            'credential_fields': [
                {'name': 'endpoint', 'label': 'Endpoint URL', 'type': 'text', 'required': True},
                {'name': 'access_key', 'label': 'Access Key', 'type': 'text', 'required': True},
                {'name': 'secret_key', 'label': 'Secret Key', 'type': 'password', 'required': True}
            ]
        }
    ]
    return jsonify(providers)

# Endpoint para obtener instalaciones SAGE
@app.route('/api/sage/installations', methods=['GET'])
def list_sage_installations():
    """Lista las instalaciones SAGE disponibles para DuckDB Swarm"""
    installations = [
        {
            'id': 1,
            'name': 'SAGE Local',
            'host': 'localhost',
            'port': 5000,
            'description': 'Instalación local de SAGE',
            'status': 'active',
            'version': '2.5.0',
            'databases': 12,
            'templates': 25,
            'last_seen': '2025-04-25T18:30:00Z'
        }
    ]
    return jsonify(installations)

# Endpoint para obtener secrets de cloud
@app.route('/api/cloud/secrets', methods=['GET'])
def list_cloud_secrets():
    """Lista los secrets de proveedores cloud disponibles para DuckDB Swarm"""
    secrets = [
        {
            'id': 1,
            'name': 'AWS Production',
            'provider_id': 'aws',
            'provider_name': 'Amazon S3',
            'description': 'Credenciales de producción para AWS S3',
            'has_credentials': True,
            'created_at': '2025-04-20T10:00:00Z',
            'updated_at': '2025-04-22T15:30:00Z'
        },
        {
            'id': 2,
            'name': 'Azure Storage',
            'provider_id': 'azure',
            'provider_name': 'Azure Blob Storage',
            'description': 'Credenciales para Azure Blob Storage',
            'has_credentials': True,
            'created_at': '2025-04-21T09:45:00Z',
            'updated_at': '2025-04-21T09:45:00Z'
        },
        {
            'id': 3,
            'name': 'GCP Analytics',
            'provider_id': 'gcp',
            'provider_name': 'Google Cloud Storage',
            'description': 'Acceso a bucket de analítica en GCP',
            'has_credentials': True,
            'created_at': '2025-04-23T14:20:00Z',
            'updated_at': '2025-04-24T10:15:00Z'
        },
        {
            'id': 4,
            'name': 'MinIO Local',
            'provider_id': 'minio',
            'provider_name': 'MinIO',
            'description': 'Servidor MinIO local para desarrollo',
            'has_credentials': True,
            'created_at': '2025-04-20T11:30:00Z',
            'updated_at': '2025-04-20T11:30:00Z'
        }
    ]
    return jsonify(secrets)

if __name__ == '__main__':
    # Verificar que la base de datos exista o crearla
    if not os.path.exists(DUCKDB_PATH):
        logger.info(f"Creando base de datos {DUCKDB_PATH}")
        conn = duckdb.connect(DUCKDB_PATH)
        conn.close()
    
    # Iniciar servidor
    app.run(host='0.0.0.0', port=5001)
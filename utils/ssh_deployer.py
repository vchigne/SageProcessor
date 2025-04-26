#!/usr/bin/env python3
"""
Utilidad para desplegar DuckDB en servidores remotos usando SSH
"""
import os
import paramiko
import tempfile
import logging
import io
import time
from pathlib import Path

# Configuración de logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('ssh_deployer')

# Ruta a los scripts de despliegue
DEPLOY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'deploy_scripts')

class KnownHostsPolicy(paramiko.MissingHostKeyPolicy):
    """
    Política personalizada para manejar claves de host desconocidas
    Muestra un mensaje y añade automáticamente la clave
    """
    def missing_host_key(self, client, hostname, key):
        logger.warning(f"Host desconocido: {hostname}. Añadiendo automáticamente la clave.")
        client._host_keys.add(hostname, key.get_name(), key)
        # Si tuviéramos un archivo de known_hosts, podríamos guardarlo:
        # if client._host_keys_filename is not None:
        #    client.save_host_keys(client._host_keys_filename)

def deploy_duckdb_via_ssh(ssh_host, ssh_port=22, ssh_username=None, ssh_password=None, 
                          ssh_key=None, duckdb_port=1294, server_key=None):
    """
    Despliega DuckDB en un servidor remoto utilizando SSH
    
    Args:
        ssh_host (str): Hostname o IP del servidor
        ssh_port (int): Puerto SSH (por defecto 22)
        ssh_username (str): Usuario SSH
        ssh_password (str, optional): Contraseña SSH
        ssh_key (str, optional): Clave privada SSH en formato string
        duckdb_port (int): Puerto para el servidor DuckDB (por defecto 1294)
        server_key (str, optional): Clave de autenticación para el servidor DuckDB
        
    Returns:
        dict: Resultado del despliegue con estado y mensaje
    """
    try:
        # Inicializar cliente SSH
        client = paramiko.SSHClient()
        
        # Manejo especial para la política de verificación de claves
        # Primero intentamos cargar claves conocidas del sistema, si existen
        try:
            client.load_system_host_keys()
        except Exception as e:
            logger.warning(f"No se pudieron cargar las claves del sistema: {str(e)}")
        
        # Configuramos una política personalizada para hosts desconocidos
        client.set_missing_host_key_policy(KnownHostsPolicy())
        
        # Archivo temporal para clave privada si se proporciona
        key_file = None
        
        # Inicializar SFTP como None para poder verificar en finally
        sftp = None
        
        try:
            # Conectar al servidor
            logger.info(f"Conectando a {ssh_host}:{ssh_port} con usuario {ssh_username}")
            
            if ssh_key:
                # Crear archivo temporal para la clave
                key_file = tempfile.NamedTemporaryFile(delete=False)
                key_file.write(ssh_key.encode())
                key_file.close()
                
                # Establecer permisos correctos para la clave
                os.chmod(key_file.name, 0o600)
                
                # Conectar con clave privada
                pkey = paramiko.RSAKey.from_private_key_file(key_file.name)
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    pkey=pkey,
                    timeout=30,
                    look_for_keys=False,
                    allow_agent=False
                )
            else:
                # Conectar con contraseña
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    password=ssh_password,
                    timeout=30,
                    look_for_keys=False,
                    allow_agent=False
                )
            
            # Verificar que la conexión está activa
            transport = client.get_transport()
            if not transport or not transport.is_active():
                return {'success': False, 'message': 'No se pudo establecer la conexión SSH'}
                
            logger.info(f"Conexión SSH establecida con {ssh_host}")
            
            # Crear directorio remoto para DuckDB
            sftp = client.open_sftp()
            
            try:
                sftp.mkdir('duckdb_server')
            except IOError:
                logger.info("El directorio duckdb_server ya existe")
                
            try:
                sftp.mkdir('duckdb_data')
            except IOError:
                logger.info("El directorio duckdb_data ya existe")
            
            # Transferir el script de servidor DuckDB
            server_script_path = os.path.join(DEPLOY_DIR, 'duckdb_server.py')
            remote_server_path = 'duckdb_server/duckdb_server.py'
            
            logger.info(f"Transfiriendo servidor DuckDB a {ssh_host}:{remote_server_path}")
            sftp.put(server_script_path, remote_server_path)
            
            # Transferir e instalar el script de instalación
            install_script_path = os.path.join(DEPLOY_DIR, 'install_duckdb.sh')
            remote_install_path = 'duckdb_server/install_duckdb.sh'
            
            logger.info(f"Transfiriendo script de instalación a {ssh_host}:{remote_install_path}")
            sftp.put(install_script_path, remote_install_path)
            
            # Dar permisos de ejecución al script de instalación
            logger.info("Dando permisos de ejecución al script de instalación")
            stdin, stdout, stderr = client.exec_command(f"chmod +x {remote_install_path}")
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status != 0:
                err_msg = stderr.read().decode().strip()
                logger.error(f"Error al dar permisos de ejecución: {err_msg}")
                return {'success': False, 'message': f"Error al dar permisos de ejecución: {err_msg}"}
            
            # Ejecutar el script de instalación
            logger.info(f"Ejecutando script de instalación con puerto {duckdb_port} y clave {'configurada' if server_key else 'no configurada'}")
            
            cmd = f"cd ~/duckdb_server && ./install_duckdb.sh {duckdb_port} '{server_key if server_key else ''}'"
            stdin, stdout, stderr = client.exec_command(cmd)
            
            # Leer la salida en tiempo real
            output = ""
            error_output = ""
            
            while not stdout.channel.exit_status_ready():
                if stdout.channel.recv_ready():
                    chunk = stdout.channel.recv(1024).decode('utf-8', errors='replace')
                    output += chunk
                    logger.info(chunk.strip())
                
                if stderr.channel.recv_stderr_ready():
                    chunk = stderr.channel.recv_stderr(1024).decode('utf-8', errors='replace')
                    error_output += chunk
                    logger.error(chunk.strip())
                    
                time.sleep(0.1)
            
            # Leer cualquier dato restante
            while stdout.channel.recv_ready():
                chunk = stdout.channel.recv(1024).decode('utf-8', errors='replace')
                output += chunk
                logger.info(chunk.strip())
                
            while stderr.channel.recv_stderr_ready():
                chunk = stderr.channel.recv_stderr(1024).decode('utf-8', errors='replace')
                error_output += chunk
                logger.error(chunk.strip())
            
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status != 0:
                logger.error(f"Error al ejecutar el script de instalación (código {exit_status}): {error_output}")
                return {
                    'success': False, 
                    'message': f"Error al ejecutar el script de instalación (código {exit_status})", 
                    'output': output,
                    'error': error_output
                }
            
            # Verificar que el servidor está en ejecución
            time.sleep(5)  # Esperar a que el servidor inicie
            
            logger.info("Verificando que el servidor DuckDB está en ejecución")
            cmd = f"curl -s http://localhost:{duckdb_port}/health"
            stdin, stdout, stderr = client.exec_command(cmd)
            response = stdout.read().decode().strip()
            error = stderr.read().decode().strip()
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status != 0 or not response:
                logger.error(f"Error al verificar servidor DuckDB: {error if error else 'Sin respuesta'}")
                return {
                    'success': False, 
                    'message': f"El servidor DuckDB no responde: {error if error else 'Sin respuesta'}",
                    'output': output
                }
            
            logger.info(f"Servidor DuckDB desplegado exitosamente en {ssh_host}:{duckdb_port}")
            return {
                'success': True,
                'message': f"Servidor DuckDB desplegado exitosamente en {ssh_host}:{duckdb_port}",
                'output': output,
                'health_check': response
            }
            
        finally:
            # Limpiar archivo temporal
            if key_file and os.path.exists(key_file.name):
                os.unlink(key_file.name)
                
            # Cerrar la conexión SSH
            if sftp is not None:
                sftp.close()
            client.close()
            
    except Exception as e:
        logger.error(f"Error en el despliegue: {str(e)}", exc_info=True)
        return {'success': False, 'message': f"Error en el despliegue: {str(e)}"}

def check_connection(ssh_host, ssh_port=22, ssh_username=None, ssh_password=None, ssh_key=None):
    """
    Verifica la conexión SSH a un servidor
    
    Args:
        ssh_host (str): Hostname o IP del servidor
        ssh_port (int): Puerto SSH (por defecto 22)
        ssh_username (str): Usuario SSH
        ssh_password (str, optional): Contraseña SSH
        ssh_key (str, optional): Clave privada SSH en formato string
        
    Returns:
        dict: Resultado de la verificación con estado y mensaje
    """
    try:
        # Inicializar cliente SSH
        client = paramiko.SSHClient()
        
        # Manejo especial para la política de verificación de claves
        # Primero intentamos cargar claves conocidas del sistema, si existen
        try:
            client.load_system_host_keys()
        except Exception as e:
            logger.warning(f"No se pudieron cargar las claves del sistema: {str(e)}")
        
        # Configuramos una política personalizada para hosts desconocidos
        client.set_missing_host_key_policy(KnownHostsPolicy())
        
        # Archivo temporal para clave privada si se proporciona
        key_file = None
        
        try:
            if ssh_key:
                # Crear archivo temporal para la clave
                key_file = tempfile.NamedTemporaryFile(delete=False)
                key_file.write(ssh_key.encode())
                key_file.close()
                
                # Establecer permisos correctos para la clave
                os.chmod(key_file.name, 0o600)
                
                # Conectar con clave privada
                pkey = paramiko.RSAKey.from_private_key_file(key_file.name)
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    pkey=pkey,
                    timeout=10,
                    look_for_keys=False,
                    allow_agent=False
                )
            else:
                # Conectar con contraseña
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    password=ssh_password,
                    timeout=10,
                    look_for_keys=False,
                    allow_agent=False
                )
            
            # Verificar que la conexión está activa
            transport = client.get_transport()
            if not transport or not transport.is_active():
                return {'success': False, 'message': 'No se pudo establecer la conexión SSH'}
            
            # Ejecutar un comando simple para verificar
            stdin, stdout, stderr = client.exec_command("echo 'Test connection successful'")
            output = stdout.read().decode().strip()
            
            if output == 'Test connection successful':
                return {'success': True, 'message': 'Conexión exitosa'}
            else:
                return {'success': False, 'message': 'La conexión SSH no funciona correctamente'}
                
        finally:
            # Limpiar archivo temporal
            if key_file and os.path.exists(key_file.name):
                os.unlink(key_file.name)
                
            # Cerrar la conexión SSH
            client.close()
            
    except paramiko.SSHException as e:
        # Errores específicos de SSH
        return {'success': False, 'message': f"Error de conexión SSH: {str(e)}"}
    except Exception as e:
        # Otros errores
        return {'success': False, 'message': f"Error de conexión: {str(e)}"}
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
        # No intentamos modificar directamente los host_keys internos
        # Simplemente aceptamos la clave automáticamente
        # Si necesitaramos guardar las claves permanentemente, deberíamos implementar
        # un sistema de almacenamiento de claves externo

def transfer_file(ssh_host, local_path, remote_path, ssh_port=22, ssh_username=None, 
               ssh_password=None, ssh_key=None):
    """
    Transfiere un archivo al servidor remoto usando SFTP
    
    Args:
        ssh_host (str): Hostname o IP del servidor
        local_path (str): Ruta local del archivo a transferir
        remote_path (str): Ruta remota donde guardar el archivo
        ssh_port (int): Puerto SSH (por defecto 22)
        ssh_username (str): Usuario SSH
        ssh_password (str, optional): Contraseña SSH
        ssh_key (str, optional): Clave privada SSH en formato string
        
    Returns:
        dict: Resultado de la transferencia con estado y mensaje
    """
    try:
        # Verificar que el archivo local existe
        if not os.path.exists(local_path):
            logger.error(f"El archivo local {local_path} no existe")
            return {'success': False, 'message': f"El archivo local {local_path} no existe"}
        
        # Inicializar cliente SSH
        client = paramiko.SSHClient()
        
        # Manejo de claves conocidas
        try:
            client.load_system_host_keys()
        except Exception as e:
            logger.warning(f"No se pudieron cargar las claves del sistema: {str(e)}")
        
        # Configuramos una política para hosts desconocidos
        client.set_missing_host_key_policy(KnownHostsPolicy())
        
        # Archivo temporal para clave privada si se proporciona
        key_file = None
        sftp = None
        
        try:
            # Conectar al servidor
            logger.info(f"Conectando a {ssh_host}:{ssh_port} con usuario {ssh_username} para transferir archivo")
            
            if ssh_key:
                # Crear archivo temporal para la clave
                key_file = tempfile.NamedTemporaryFile(delete=False)
                key_file.write(ssh_key.encode())
                key_file.close()
                
                # Establecer permisos correctos para la clave
                os.chmod(key_file.name, 0o600)
                
                # Conectar con clave privada
                pkey = paramiko.RSAKey.from_private_key_file(key_file.name)
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    pkey=pkey,
                    timeout=30,
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=60,
                    auth_timeout=30,
                    disabled_algorithms=disabled_algorithms
                )
            else:
                # Conectar con contraseña
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    password=ssh_password,
                    timeout=30,
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=60,
                    auth_timeout=30,
                    disabled_algorithms=disabled_algorithms
                )
            
            # Verificar conexión
            transport = client.get_transport()
            if not transport or not transport.is_active():
                return {'success': False, 'message': 'No se pudo establecer la conexión SSH'}
            
            # Transferir el archivo
            sftp = client.open_sftp()
            
            # Crear directorio remoto si no existe
            remote_dir = os.path.dirname(remote_path)
            if remote_dir:
                try:
                    # Crear directorios recursivamente
                    current_dir = ""
                    for dir_part in remote_dir.split('/'):
                        if not dir_part:
                            continue
                        current_dir += f"/{dir_part}"
                        try:
                            sftp.stat(current_dir)
                        except FileNotFoundError:
                            logger.info(f"Creando directorio remoto {current_dir}")
                            sftp.mkdir(current_dir)
                except Exception as e:
                    logger.warning(f"Error al crear directorio remoto {remote_dir}: {str(e)}")
            
            # Transferir el archivo
            logger.info(f"Transfiriendo {local_path} a {ssh_host}:{remote_path}")
            sftp.put(local_path, remote_path)
            
            # Verificar que el archivo se transfirió correctamente
            try:
                sftp.stat(remote_path)
                logger.info(f"Archivo transferido exitosamente a {ssh_host}:{remote_path}")
                return {'success': True, 'message': f"Archivo transferido exitosamente a {remote_path}"}
            except FileNotFoundError:
                logger.error(f"No se pudo verificar el archivo transferido en {remote_path}")
                return {'success': False, 'message': f"No se pudo verificar el archivo transferido en {remote_path}"}
                
        finally:
            # Limpiar
            if sftp:
                sftp.close()
            if client:
                client.close()
            if key_file and os.path.exists(key_file.name):
                os.unlink(key_file.name)
                
    except Exception as e:
        logger.error(f"Error al transferir archivo a {ssh_host}: {str(e)}", exc_info=True)
        return {'success': False, 'message': f"Error al transferir archivo: {str(e)}"}

def execute_command(ssh_host, command, ssh_port=22, ssh_username=None, ssh_password=None, ssh_key=None, timeout=300, get_pty=True):
    """
    Ejecuta un comando en el servidor remoto vía SSH
    
    Args:
        ssh_host (str): Hostname o IP del servidor
        command (str): Comando a ejecutar
        ssh_port (int): Puerto SSH (por defecto 22)
        ssh_username (str): Usuario SSH
        ssh_password (str, optional): Contraseña SSH
        ssh_key (str, optional): Clave privada SSH en formato string
        timeout (int): Tiempo máximo de ejecución en segundos
        get_pty (bool): Si se debe asignar un pseudo-terminal
        
    Returns:
        dict: Resultado de la ejecución con estado y mensaje
    """
    try:
        # Inicializar cliente SSH
        client = paramiko.SSHClient()
        
        # Manejo de claves conocidas
        try:
            client.load_system_host_keys()
        except Exception as e:
            logger.warning(f"No se pudieron cargar las claves del sistema: {str(e)}")
        
        # Configuramos una política para hosts desconocidos
        client.set_missing_host_key_policy(KnownHostsPolicy())
        
        # Archivo temporal para clave privada si se proporciona
        key_file = None
        
        try:
            # Conectar al servidor
            logger.info(f"Conectando a {ssh_host}:{ssh_port} con usuario {ssh_username} para ejecutar comando")
            
            if ssh_key:
                # Crear archivo temporal para la clave
                key_file = tempfile.NamedTemporaryFile(delete=False)
                key_file.write(ssh_key.encode())
                key_file.close()
                
                # Establecer permisos correctos para la clave
                os.chmod(key_file.name, 0o600)
                
                # Conectar con clave privada
                pkey = paramiko.RSAKey.from_private_key_file(key_file.name)
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    pkey=pkey,
                    timeout=30,
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=60,
                    auth_timeout=30,
                    disabled_algorithms=disabled_algorithms
                )
            else:
                # Conectar con contraseña
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    password=ssh_password,
                    timeout=30,
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=60,
                    auth_timeout=30,
                    disabled_algorithms=disabled_algorithms
                )
            
            # Verificar conexión
            transport = client.get_transport()
            if not transport or not transport.is_active():
                return {'success': False, 'message': 'No se pudo establecer la conexión SSH'}
            
            # Ejecutar comando
            logger.info(f"Ejecutando comando en {ssh_host}: {command}")
            stdin, stdout, stderr = client.exec_command(
                command,
                get_pty=get_pty,
                timeout=timeout
            )
            
            # Configurar timeout del canal
            channel = stdout.channel
            channel.settimeout(timeout)
            
            # Leer salida estándar y error
            output = stdout.read().decode('utf-8', errors='replace')
            error = stderr.read().decode('utf-8', errors='replace')
            
            # Obtener código de salida
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status != 0:
                logger.warning(f"Comando terminó con código {exit_status}: {error}")
                return {
                    'success': False,
                    'exit_status': exit_status,
                    'output': output,
                    'error': error,
                    'message': f"Comando terminó con código {exit_status}"
                }
            
            logger.info(f"Comando ejecutado exitosamente en {ssh_host}")
            return {
                'success': True,
                'exit_status': exit_status,
                'output': output,
                'error': error,
                'message': "Comando ejecutado exitosamente"
            }
                
        finally:
            # Limpiar
            if client:
                client.close()
            if key_file and os.path.exists(key_file.name):
                os.unlink(key_file.name)
                
    except Exception as e:
        logger.error(f"Error al ejecutar comando en {ssh_host}: {str(e)}", exc_info=True)
        return {'success': False, 'message': f"Error al ejecutar comando: {str(e)}"}

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
                # Configurar opciones para conexiones más robustas
                # Algunas versiones de Paramiko no soportan transport_params directamente
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    pkey=pkey,
                    timeout=30,  # Tiempo de espera para conectar
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=60,  # Mayor tiempo de espera para el banner
                    auth_timeout=30,  # Tiempo de espera para la autenticación
                    disabled_algorithms=disabled_algorithms
                )
                
                # Configurar timeout del transporte
                transport = client.get_transport()
                if transport:
                    transport.set_keepalive(5)  # Enviar keepalive cada 5 segundos
            else:
                # Conectar con contraseña
                # Configurar opciones para conexiones más robustas
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    password=ssh_password,
                    timeout=30,  # Tiempo de espera para conectar
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=60,  # Mayor tiempo de espera para el banner
                    auth_timeout=30,  # Tiempo de espera para la autenticación
                    disabled_algorithms=disabled_algorithms
                )
                
                # Configurar keepalive en el transporte
                transport = client.get_transport()
                if transport:
                    transport.set_keepalive(5)  # Enviar keepalive cada 5 segundos
            
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
            
            # Transferir scripts de instalación (tanto el estándar como el de Docker)
            install_script_path = os.path.join(DEPLOY_DIR, 'install_duckdb.sh')
            docker_install_script_path = os.path.join(DEPLOY_DIR, 'install_docker_duckdb.sh')
            dockerfile_path = os.path.join(DEPLOY_DIR, 'Dockerfile')
            start_vnc_path = os.path.join(DEPLOY_DIR, 'start_vnc.sh')
            supervisord_path = os.path.join(DEPLOY_DIR, 'supervisord.conf')
            
            remote_install_path = 'duckdb_server/install_duckdb.sh'
            remote_docker_install_path = 'duckdb_server/install_docker_duckdb.sh'
            remote_dockerfile_path = 'duckdb_server/Dockerfile'
            remote_start_vnc_path = 'duckdb_server/start_vnc.sh'
            remote_supervisord_path = 'duckdb_server/supervisord.conf'
            
            logger.info(f"Transfiriendo scripts de instalación a {ssh_host}")
            sftp.put(install_script_path, remote_install_path)
            sftp.put(docker_install_script_path, remote_docker_install_path)
            sftp.put(dockerfile_path, remote_dockerfile_path)
            
            # Transferir archivos para VNC
            logger.info(f"Transfiriendo archivos para VNC a {ssh_host}")
            sftp.put(start_vnc_path, remote_start_vnc_path)
            sftp.put(supervisord_path, remote_supervisord_path)
            
            # Transferir script de arreglo VNC
            fix_vnc_path = os.path.join(DEPLOY_DIR, 'fix_vnc.sh')
            remote_fix_vnc_path = 'duckdb_server/fix_vnc.sh'
            if os.path.exists(fix_vnc_path):
                logger.info(f"Transfiriendo script de arreglo VNC a {ssh_host}")
                sftp.put(fix_vnc_path, remote_fix_vnc_path)
            else:
                logger.warning("No se encontró el script fix_vnc.sh, se omitirá la transferencia")
            
            # Dar permisos de ejecución a los scripts de instalación
            logger.info("Dando permisos de ejecución a los scripts de instalación")
            # Usar un canal separado con keepalive activado para mejor tolerancia
            chmod_cmd = f"chmod +x {remote_install_path} {remote_docker_install_path} {remote_start_vnc_path}"
            if os.path.exists(fix_vnc_path):
                chmod_cmd += f" {remote_fix_vnc_path}"
            stdin, stdout, stderr = client.exec_command(
                chmod_cmd,
                get_pty=True,
                timeout=30
            )
            # Configurar keepalive en el canal
            channel = stdout.channel
            channel.settimeout(30)  # 30 segundos de timeout para operaciones del canal
            exit_status = stdout.channel.recv_exit_status()
            
            if exit_status != 0:
                err_msg = stderr.read().decode().strip()
                logger.error(f"Error al dar permisos de ejecución: {err_msg}")
                return {'success': False, 'message': f"Error al dar permisos de ejecución: {err_msg}"}
            
            # Ejecutar el script de instalación Docker (por defecto)
            logger.info(f"Ejecutando script de instalación Docker con puerto {duckdb_port} y clave {'configurada' if server_key else 'no configurada'}")
            
            cmd = f"cd ~/duckdb_server && ./install_docker_duckdb.sh {duckdb_port} '{server_key if server_key else ''}'"
            stdin, stdout, stderr = client.exec_command(
                cmd,
                get_pty=True,
                timeout=300  # 5 minutos de timeout para instalación Docker
            )
            channel = stdout.channel
            channel.settimeout(300)  # 5 minutos de timeout para operaciones del canal
            
            # Leer la salida en tiempo real
            output = ""
            error_output = ""
            
            # Timeout para la instalación (15 minutos en total)
            start_time = time.time()
            timeout_seconds = 900  # 15 minutos para permitir instalaciones en máquinas más lentas
            
            while not stdout.channel.exit_status_ready():
                # Verificar si hemos superado el timeout
                if time.time() - start_time > timeout_seconds:
                    logger.warning(f"La instalación está tardando más de {timeout_seconds/60} minutos, forzando finalización")
                    stdout.channel.close()
                    break
                    
                if stdout.channel.recv_ready():
                    chunk = stdout.channel.recv(1024).decode('utf-8', errors='replace')
                    output += chunk
                    logger.info(chunk.strip())
                    
                    # Si el proceso está atascado en "Instalando dependencias... (90%)",
                    # agregar un mensaje para indicar que el proceso podría tardar más tiempo
                    if "Instalando dependencias... (90%)" in chunk:
                        logger.info("Instalación de dependencias al 90%, este paso puede tardar varios minutos...")
                
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
            
            # Ejecutar el script de arreglo VNC si existe
            if os.path.exists(fix_vnc_path):
                logger.info("Ejecutando script de arreglo VNC en el contenedor...")
                vnc_fix_cmd = f"docker exec duckdb-server /bin/bash -c 'if [ -f /fix_vnc.sh ]; then chmod +x /fix_vnc.sh && /fix_vnc.sh; else echo \"Script fix_vnc.sh no encontrado\"; fi'"
                stdin, stdout, stderr = client.exec_command(
                    vnc_fix_cmd,
                    get_pty=True,
                    timeout=120  # 2 minutos para el script de arreglo
                )
                channel = stdout.channel
                channel.settimeout(120)
                
                # Leer salida del script de arreglo VNC
                while stdout.channel.recv_ready():
                    chunk = stdout.channel.recv(1024).decode('utf-8', errors='replace')
                    logger.info(chunk.strip())
                
                exit_status = stdout.channel.recv_exit_status()
                if exit_status != 0:
                    logger.warning(f"Script de arreglo VNC terminó con código {exit_status}, pero continuamos con la verificación")
            
            # Verificar que el servidor está en ejecución
            time.sleep(5)  # Esperar a que el servidor inicie
            
            logger.info("Verificando que el servidor DuckDB está en ejecución")
            cmd = f"curl -s --connect-timeout 10 --max-time 15 http://localhost:{duckdb_port}/health"
            stdin, stdout, stderr = client.exec_command(
                cmd,
                get_pty=True,
                timeout=30
            )
            channel = stdout.channel
            channel.settimeout(30)
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
            
            logger.info(f"Servidor DuckDB desplegado exitosamente en {ssh_host}:{duckdb_port} con VNC y SSH")
            return {
                'success': True,
                'message': f"Servidor DuckDB con VNC desplegado exitosamente en {ssh_host}",
                'details': {
                    'duckdb_api': f"{ssh_host}:{duckdb_port}",
                    'vnc_server': f"{ssh_host}:5901",
                    'ssh_server': f"{ssh_host}:2222",
                    'vnc_password': 'duckdb',
                    'ssh_password': 'duckdb'
                },
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

def execute_command(ssh_host, command, ssh_port=22, ssh_username=None, ssh_password=None, ssh_key=None, timeout=120):
    """
    Ejecuta un comando SSH en un servidor remoto
    
    Args:
        ssh_host (str): Hostname o IP del servidor
        command (str): Comando a ejecutar
        ssh_port (int): Puerto SSH (por defecto 22)
        ssh_username (str): Usuario SSH
        ssh_password (str, optional): Contraseña SSH
        ssh_key (str, optional): Clave privada SSH en formato string
        timeout (int): Timeout para la ejecución del comando en segundos
        
    Returns:
        dict: Resultado de la ejecución con estado, mensaje y salida
    """
    try:
        # Inicializar cliente SSH
        client = paramiko.SSHClient()
        
        # Manejo especial para la política de verificación de claves
        try:
            client.load_system_host_keys()
        except Exception as e:
            logger.warning(f"No se pudieron cargar las claves del sistema: {str(e)}")
        
        # Configurar política para hosts desconocidos
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
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
                # Configurar opciones para conexiones más robustas
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    pkey=pkey,
                    timeout=20,
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=30,
                    auth_timeout=20,
                    disabled_algorithms=disabled_algorithms
                )
            else:
                # Conectar con contraseña
                # Configurar opciones para conexiones más robustas
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    password=ssh_password,
                    timeout=20,
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=30,
                    auth_timeout=20,
                    disabled_algorithms=disabled_algorithms
                )
            
            # Ejecutar el comando
            stdin, stdout, stderr = client.exec_command(
                command,
                get_pty=True,
                timeout=timeout
            )
            
            # Configurar keepalive y timeout para el canal
            channel = stdout.channel
            channel.settimeout(timeout)
            
            # Leer la salida en tiempo real
            output = ""
            error_output = ""
            
            while not stdout.channel.exit_status_ready():
                if stdout.channel.recv_ready():
                    chunk = stdout.channel.recv(1024).decode('utf-8', errors='replace')
                    output += chunk
                    
                if stderr.channel.recv_stderr_ready():
                    chunk = stderr.channel.recv_stderr(1024).decode('utf-8', errors='replace')
                    error_output += chunk
                    
                time.sleep(0.1)
            
            # Leer cualquier dato restante
            while stdout.channel.recv_ready():
                chunk = stdout.channel.recv(1024).decode('utf-8', errors='replace')
                output += chunk
                
            while stderr.channel.recv_stderr_ready():
                chunk = stderr.channel.recv_stderr(1024).decode('utf-8', errors='replace')
                error_output += chunk
            
            # Obtener código de salida
            exit_status = stdout.channel.recv_exit_status()
            
            # Construir resultado
            result = {
                'success': exit_status == 0,
                'exit_status': exit_status,
                'output': output.strip(),
                'error': error_output.strip(),
                'message': f"Comando ejecutado con código de salida {exit_status}"
            }
            
            return result
                
        finally:
            # Limpiar archivo temporal
            if key_file and os.path.exists(key_file.name):
                os.unlink(key_file.name)
                
            # Cerrar la conexión SSH
            client.close()
            
    except Exception as e:
        # Otros errores
        logger.error(f"Error al ejecutar comando: {str(e)}", exc_info=True)
        return {
            'success': False,
            'exit_status': -1,
            'output': "",
            'error': str(e),
            'message': f"Error al ejecutar comando: {str(e)}"
        }

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
                # Configurar opciones para conexiones más robustas
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    pkey=pkey,
                    timeout=20,  # Tiempo de espera para conectar
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=30,  # Mayor tiempo de espera para el banner
                    auth_timeout=20,  # Tiempo de espera para la autenticación
                    disabled_algorithms=disabled_algorithms
                )
                
                # Configurar keepalive en el transporte
                transport = client.get_transport()
                if transport:
                    transport.set_keepalive(5)  # Enviar keepalive cada 5 segundos
            else:
                # Conectar con contraseña
                # Configurar opciones para conexiones más robustas
                disabled_algorithms = {'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']}
                client.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username=ssh_username,
                    password=ssh_password,
                    timeout=20,  # Tiempo de espera para conectar
                    look_for_keys=False,
                    allow_agent=False,
                    banner_timeout=30,  # Mayor tiempo de espera para el banner
                    auth_timeout=20,  # Tiempo de espera para la autenticación
                    disabled_algorithms=disabled_algorithms
                )
                
                # Configurar keepalive en el transporte
                transport = client.get_transport()
                if transport:
                    transport.set_keepalive(5)  # Enviar keepalive cada 5 segundos
            
            # Verificar que la conexión está activa
            transport = client.get_transport()
            if not transport or not transport.is_active():
                return {'success': False, 'message': 'No se pudo establecer la conexión SSH'}
            
            # Ejecutar un comando simple para verificar
            stdin, stdout, stderr = client.exec_command(
                "echo 'Test connection successful'",
                get_pty=True,
                timeout=15
            )
            channel = stdout.channel
            channel.settimeout(15)
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
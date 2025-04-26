#!/usr/bin/env python3
"""
Utilidad para desplegar DuckDB en servidores remotos usando SSH
Versión mejorada con soporte para systemd
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
        # Inicializar cliente SSH
        client = paramiko.SSHClient()
        
        # Inicializar variables para manejo de archivo temporal
        key_file = None
        sftp = None
        
        try:
            # Configuración de claves seguras
            try:
                client.load_system_host_keys()
            except Exception as e:
                logger.warning(f"No se pudieron cargar las claves del sistema: {str(e)}")
            
            # Configuramos política para hosts desconocidos
            client.set_missing_host_key_policy(KnownHostsPolicy())
            
            # Log para diagnóstico
            logger.info(f"Conectando a {ssh_host}:{ssh_port} con usuario {ssh_username} para transferir archivo")
            
            # Desactivar algoritmos problemáticos
            disabled_algorithms = {
                'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']
            }
            
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
                    allow_agent=False,
                    disabled_algorithms=disabled_algorithms
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
                    allow_agent=False,
                    disabled_algorithms=disabled_algorithms
                )
            
            # Abrir conexión SFTP
            sftp = client.open_sftp()
            
            # Transferir el archivo
            logger.info(f"Transfiriendo {local_path} a {ssh_host}:{remote_path}")
            sftp.put(local_path, remote_path)
            
            # Verificar que el archivo se ha transferido correctamente
            try:
                stats = sftp.stat(remote_path)
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
            # Desactivar algoritmos problemáticos
            disabled_algorithms = {
                'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']
            }
            
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
                    allow_agent=False,
                    disabled_algorithms=disabled_algorithms
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
                    allow_agent=False,
                    disabled_algorithms=disabled_algorithms
                )
            
            # Ejecutar el comando
            logger.info(f"Ejecutando comando SSH en {ssh_host}: {command}")
            stdin, stdout, stderr = client.exec_command(command, get_pty=get_pty, timeout=timeout)
            
            # Esperamos a que el comando se complete
            exit_status = stdout.channel.recv_exit_status()
            output = stdout.read().decode()
            error = stderr.read().decode()
            
            # Retornar el resultado
            if exit_status == 0:
                return {'success': True, 'output': output, 'exit_status': exit_status}
            else:
                logger.warning(f"Comando SSH terminó con código {exit_status}: {error}")
                return {'success': False, 'message': error, 'output': output, 'exit_status': exit_status}
                
        finally:
            # Limpiar archivo temporal
            if key_file and os.path.exists(key_file.name):
                os.unlink(key_file.name)
                
            # Cerrar la conexión SSH
            client.close()
            
    except Exception as e:
        logger.error(f"Error al ejecutar comando SSH: {str(e)}", exc_info=True)
        return {'success': False, 'message': f"Error SSH: {str(e)}"}

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
        server_key (str, optional): Clave de autenticación para el servidor DuckDB (usado como contraseña VNC)
        
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
                
                # Desactivar algoritmos problemáticos
                disabled_algorithms = {
                    'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']
                }
                
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
                
                # Configurar keepalive en el transporte
                transport = client.get_transport()
                if transport:
                    transport.set_keepalive(5)  # Enviar keepalive cada 5 segundos
                
            else:
                # Desactivar algoritmos problemáticos
                disabled_algorithms = {
                    'pubkeys': ['rsa-sha2-256', 'rsa-sha2-512']
                }
                
                # Conectar con contraseña
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
            
            # Abrir conexión SFTP
            sftp = client.open_sftp()
            
            # Usar clave API como contraseña VNC o la predeterminada si no hay
            vnc_password = server_key if server_key else 'duckdb'
            
            # Transferir los scripts de instalación systemd
            systemd_install_path = os.path.join(DEPLOY_DIR, 'install_duckdb_systemd.sh')
            systemd_validate_path = os.path.join(DEPLOY_DIR, 'validate_duckdb_systemd.sh')
            
            if not os.path.exists(systemd_install_path):
                return {'success': False, 'message': 'No se encontró el script de instalación systemd'}
            
            # Transferir el script de instalación
            remote_install_path = '/tmp/install_duckdb_systemd.sh'
            logger.info(f"Transfiriendo script de instalación systemd a {ssh_host}:{remote_install_path}")
            sftp.put(systemd_install_path, remote_install_path)
            
            # Transferir el script de validación si existe
            if os.path.exists(systemd_validate_path):
                remote_validate_path = '/tmp/validate_duckdb_systemd.sh'
                logger.info(f"Transfiriendo script de validación systemd a {ssh_host}:{remote_validate_path}")
                sftp.put(systemd_validate_path, remote_validate_path)
            
            # Cerrar SFTP para usar el mismo canal para comandos
            sftp.close()
            sftp = None
            
            # Ejecutar el script de instalación systemd
            logger.info(f"Ejecutando script de instalación systemd en {ssh_host}")
            stdin, stdout, stderr = client.exec_command(
                f"chmod +x {remote_install_path} && sudo {remote_install_path} {vnc_password}",
                get_pty=True
            )
            
            # Esperamos a que el comando se complete
            exit_status = stdout.channel.recv_exit_status()
            output = stdout.read().decode()
            error = stderr.read().decode()
            
            if exit_status != 0:
                logger.error(f"Error en el script de instalación systemd: {error}")
                return {'success': False, 'message': f"Error en el script de instalación systemd: {error[:300]}", 'output': output}
            
            # Iniciar los servicios
            logger.info(f"Iniciando servicios systemd en {ssh_host}")
            stdin, stdout, stderr = client.exec_command(
                "sudo systemctl start duckdb-xvfb duckdb-vnc duckdb-websockify duckdb-api",
                get_pty=True
            )
            
            # Esperamos a que el comando se complete
            exit_status = stdout.channel.recv_exit_status()
            start_output = stdout.read().decode()
            start_error = stderr.read().decode()
            
            if exit_status != 0:
                logger.error(f"Error al iniciar servicios: {start_error}")
                return {'success': False, 'message': f"Error al iniciar servicios: {start_error[:300]}", 'output': start_output}
            
            # Esperar un poco para que los servicios estén disponibles
            logger.info("Esperando a que los servicios estén disponibles...")
            time.sleep(5)
            
            # Verificar que el servidor DuckDB está en ejecución
            logger.info(f"Verificando que el servidor DuckDB está en ejecución")
            stdin, stdout, stderr = client.exec_command(
                f"curl -s http://localhost:{duckdb_port}/health"
            )
            
            # Esperamos a que el comando se complete
            exit_status = stdout.channel.recv_exit_status()
            response = stdout.read().decode()
            error = stderr.read().decode()
            
            if exit_status != 0 or not response:
                logger.error(f"Error al verificar servidor DuckDB: {error if error else 'Sin respuesta'}")
                return {
                    'success': False, 
                    'message': f"El servidor DuckDB no responde: {error if error else 'Sin respuesta'}",
                    'output': output
                }
            
            # Ejecutar validación si está disponible
            validation_result = None
            if os.path.exists(systemd_validate_path):
                logger.info(f"Ejecutando script de validación en {ssh_host}")
                stdin, stdout, stderr = client.exec_command(
                    f"chmod +x {remote_validate_path} && {remote_validate_path}",
                    get_pty=True
                )
                
                # No fallamos por validación, pero registramos el resultado
                validation_result = {
                    'exit_status': stdout.channel.recv_exit_status(),
                    'output': stdout.read().decode(),
                    'error': stderr.read().decode()
                }
            
            logger.info(f"Servidor DuckDB desplegado exitosamente en {ssh_host}:{duckdb_port} con VNC")
            return {
                'success': True,
                'message': f"Servidor DuckDB con VNC desplegado exitosamente en {ssh_host}",
                'details': {
                    'duckdb_api': f"{ssh_host}:{duckdb_port}",
                    'vnc_server': f"{ssh_host}:5901",
                    'novnc_server': f"http://{ssh_host}:6082/vnc.html",
                    'vnc_password': vnc_password
                },
                'output': output,
                'health_check': response,
                'validation': validation_result
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

def repair_vnc_systemd(ssh_host, ssh_port=22, ssh_username=None, ssh_password=None, ssh_key=None):
    """
    Repara los servicios VNC en un servidor remoto utilizando systemd
    
    Args:
        ssh_host (str): Hostname o IP del servidor
        ssh_port (int): Puerto SSH (por defecto 22)
        ssh_username (str): Usuario SSH
        ssh_password (str, optional): Contraseña SSH
        ssh_key (str, optional): Clave privada SSH en formato string
        
    Returns:
        dict: Resultado de la reparación con estado y mensaje
    """
    try:
        # Ejecutar el comando para reiniciar los servicios
        restart_result = execute_command(
            ssh_host,
            "sudo systemctl restart duckdb-xvfb duckdb-vnc duckdb-websockify",
            ssh_port,
            ssh_username,
            ssh_password,
            ssh_key,
            timeout=120,
            get_pty=True
        )
        
        if not restart_result['success']:
            return {
                'success': False,
                'message': f"Error al reiniciar servicios VNC: {restart_result.get('message', 'Error desconocido')}",
                'details': restart_result
            }
        
        # Esperar a que los servicios estén disponibles
        logger.info("Esperando a que los servicios estén disponibles...")
        time.sleep(5)
        
        # Verificar el estado de los servicios
        status_result = execute_command(
            ssh_host,
            "sudo systemctl status duckdb-xvfb duckdb-vnc duckdb-websockify",
            ssh_port,
            ssh_username,
            ssh_password,
            ssh_key,
            timeout=30
        )
        
        # Verificar puertos
        ports_result = execute_command(
            ssh_host,
            "ss -ltnp | grep -E ':(5901|6082)'",
            ssh_port,
            ssh_username,
            ssh_password,
            ssh_key,
            timeout=10
        )
        
        # Determinar si la reparación fue exitosa
        vnc_active = "port=5901" in ports_result.get('output', '') or ":5901" in ports_result.get('output', '')
        novnc_active = "port=6082" in ports_result.get('output', '') or ":6082" in ports_result.get('output', '')
        
        if vnc_active and novnc_active:
            return {
                'success': True,
                'message': 'Servicios VNC reparados exitosamente',
                'vnc_active': True,
                'novnc_active': True,
                'details': {
                    'vnc_port': 5901,
                    'novnc_port': 6082,
                    'vnc_url': f"vnc://{ssh_host}:5901",
                    'novnc_url': f"http://{ssh_host}:6082/vnc.html"
                }
            }
        else:
            return {
                'success': False,
                'message': 'Servicios VNC parcialmente reparados o no activos',
                'vnc_active': vnc_active,
                'novnc_active': novnc_active,
                'status_output': status_result.get('output', ''),
                'ports_output': ports_result.get('output', '')
            }
            
    except Exception as e:
        logger.error(f"Error en la reparación VNC: {str(e)}", exc_info=True)
        return {'success': False, 'message': f"Error en la reparación VNC: {str(e)}"}
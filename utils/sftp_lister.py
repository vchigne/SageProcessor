#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utilidad de listado SFTP para la interfaz web

Este script permite listar archivos y directorios en un servidor SFTP
utilizando la biblioteca paramiko directamente, sin depender de SAGE Daemon 2.
"""

import os
import sys
import json
import logging
import paramiko
from datetime import datetime

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("SFTP_Lister")

def list_sftp_directory(host, port, username, password=None, key_path=None, directory="/"):
    """
    Lista archivos y directorios en un servidor SFTP
    
    Args:
        host (str): Servidor SFTP
        port (int): Puerto del servidor
        username (str): Usuario para la conexión
        password (str, optional): Contraseña para la conexión
        key_path (str, optional): Ruta a la clave privada SSH
        directory (str, optional): Directorio a listar
        
    Returns:
        dict: Estructura con archivos y carpetas
    """
    try:
        logger.info(f"Conectando a {host}:{port} como {username}")
        
        # Crear cliente SSH
        transport = paramiko.Transport((host, int(port)))
        
        # Autenticar
        if password:
            transport.connect(username=username, password=password)
        elif key_path:
            key = paramiko.RSAKey.from_private_key_file(key_path)
            transport.connect(username=username, pkey=key)
        else:
            raise ValueError("Se requiere contraseña o clave privada para la conexión SFTP")
        
        # Crear cliente SFTP
        sftp = paramiko.SFTPClient.from_transport(transport)
        
        # Listar archivos y directorios
        if not sftp:
            return {
                "error": True,
                "message": "Error: No se pudo establecer conexión SFTP"
            }
        
        # Asegurarse de que el directorio sea una cadena válida
        if directory is None or directory == '':
            directory = '~'  # Usar directorio home en lugar de raíz
            
        # Manejar el directorio home del usuario
        if directory == '~':
            # Para los hosts Dreamhost, ya sabemos que el directorio home está en este formato:
            if 'dreamhost.com' in host.lower():
                directory = f'/home/{username}'
                logger.info(f"Usando directorio home para Dreamhost: {directory}")
            else:
                try:
                    # Intentar obtener el directorio actual (esto suele ser el home en la mayoría de servidores SFTP)
                    try:
                        # Este método es más seguro y no se bloquea
                        directory = sftp.normalize('.')
                        logger.info(f"Directorio home resuelto como: {directory}")
                    except Exception as norm_err:
                        logger.warning(f"Error al normalizar ruta: {str(norm_err)}")
                        directory = '/'  # Si hay un error, volver a la raíz
                except Exception as e:
                    logger.warning(f"No se pudo resolver el directorio home: {str(e)}")
                    directory = '/'  # Si hay un error, volver a la raíz
        
        # Normalizar la ruta para que siempre comience con /
        if not directory.startswith('/'):
            directory = f'/{directory}'
            
        logger.info(f"Intentando listar directorio: '{directory}'")
            
        try:
            items = sftp.listdir_attr(directory)
        except Exception as e:
            error_str = str(e).lower()
            
            # Detectar diferentes tipos de errores relacionados con directorios inexistentes
            if "no such file" in error_str or "not found" in error_str or isinstance(e, FileNotFoundError):
                logger.warning(f"Directorio no encontrado {directory}: {str(e)}")
                # Si el directorio no existe, devolvemos una lista vacía en lugar de error
                # para que sea más fácil navegar por la interfaz
                return {
                    "error": False,
                    "path": directory,
                    "parentPath": '/' if directory == '/' else '/'.join(directory.rstrip('/').split('/')[:-1]) or '/',
                    "files": [],
                    "folders": [],
                    "message": f"La ubicación '{directory}' no existe o está vacía"
                }
            elif "permission denied" in error_str or "access denied" in error_str:
                logger.error(f"Permiso denegado al listar {directory}: {str(e)}")
                return {
                    "error": True,
                    "message": f"No tiene permisos para acceder a '{directory}'"
                }
            else:
                logger.error(f"Error al listar directorio {directory}: {str(e)}")
                return {
                    "error": True,
                    "message": f"Error al listar directorio: {str(e)}"
                }
        
        # Procesamos los resultados
        files = []
        folders = []
        
        for item in items:
            name = item.filename
            path = os.path.join(directory, name).replace("\\", "/")
            
            # Verificar si es directorio
            is_dir = False
            try:
                # Para paramiko moderna, st_mode es un entero que contiene los bits de modo
                if hasattr(item, 'st_mode') and item.st_mode is not None:
                    is_dir = bool(item.st_mode & 0o40000)  # Bit de directorio en Unix mode
                else:
                    # Método antiguo
                    is_dir = bool(getattr(item, 'longname', '').startswith('d'))
            except:
                # Algunos servidores SFTP no proporcionan atributos completos
                try:
                    # Alternativa: verificar con stat si sftp tiene ese método
                    if hasattr(sftp, 'stat'):
                        stat_result = sftp.stat(path)
                        st_mode = getattr(stat_result, 'st_mode', None)
                        if st_mode is not None:
                            is_dir = bool(st_mode & 0o40000)
                except:
                    # Si todo falla, intentamos adivinar por el nombre
                    is_dir = '.' not in name and not name.startswith('.')
            
            # Agregar a la lista correspondiente
            mtime = getattr(item, 'st_mtime', None)
            mtime_str = datetime.fromtimestamp(mtime if mtime is not None else 0).isoformat()
            item_data = {
                "name": name,
                "path": path,
                "size": getattr(item, 'st_size', 0),
                "lastModified": mtime_str,
            }
            
            if is_dir:
                folders.append(item_data)
            else:
                files.append(item_data)
        
        # Cerrar conexión
        if sftp:
            try:
                sftp.close()
            except:
                pass
                
        if transport:
            try:
                transport.close()
            except:
                pass
        
        # Calcular directorio padre
        parent_path = ""
        if directory != "/" and directory:
            parent_parts = directory.rstrip("/").split("/")
            if len(parent_parts) > 1:
                parent_path = "/".join(parent_parts[:-1])
                if not parent_path:
                    parent_path = "/"
            else:
                parent_path = "/"
        
        # Devolver resultados
        return {
            "error": False,
            "path": directory,
            "parentPath": parent_path,
            "files": files,
            "folders": folders
        }
        
    except Exception as e:
        logger.error(f"Error en la conexión SFTP: {str(e)}")
        return {
            "error": True,
            "message": f"Error en la conexión SFTP: {str(e)}"
        }

if __name__ == "__main__":
    # Si se ejecuta como script, leer parámetros de la línea de comandos
    if len(sys.argv) < 4:
        print("Uso: python3 sftp_lister.py host puerto usuario [contraseña] [ruta_clave] [directorio]")
        sys.exit(1)
    
    host = sys.argv[1]
    port = int(sys.argv[2])
    username = sys.argv[3]
    password = sys.argv[4] if len(sys.argv) > 4 else None
    key_path = sys.argv[5] if len(sys.argv) > 5 else None
    directory = sys.argv[6] if len(sys.argv) > 6 else "~"  # Usar home por defecto
    
    result = list_sftp_directory(host, port, username, password, key_path, directory)
    
    # Imprimir resultado como JSON para que pueda ser parseado fácilmente
    print(json.dumps(result, indent=2))
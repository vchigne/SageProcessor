#!/usr/bin/env python
"""
Script para ejecutar pruebas manuales del SAGE Daemon
Este script simula el comportamiento del daemon con configuraciones
específicas para pruebas.
"""
import os
import sys
import argparse
import logging
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

# Agregar directorio raíz al path para poder importar los módulos
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from sage_daemon.daemon import SageDaemon
from sage_daemon.monitors import EmailMonitor, SFTPMonitor, FilesystemMonitor

def setup_test_environment(monitor_type, config_path=None):
    """
    Configura el entorno de prueba para el daemon
    
    Args:
        monitor_type: Tipo de monitor a probar (email, sftp, filesystem)
        config_path: Ruta al archivo de configuración YAML
        
    Returns:
        dict: Configuración de prueba para el daemon
    """
    # Crear directorio temporal para la prueba
    temp_dir = os.path.join(tempfile.gettempdir(), f"sage_daemon_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    os.makedirs(temp_dir, exist_ok=True)
    
    # Configurar el tipo de monitor
    if monitor_type == 'email':
        # Configuración para el monitor de email
        test_config = {
            'id': 999,  # ID ficticio para pruebas
            'nombre': 'Casilla de prueba',
            'tipo_envio': 'email',
            'configuracion': {
                'host': os.environ.get('TEST_EMAIL_HOST', 'imap.example.com'),
                'port': int(os.environ.get('TEST_EMAIL_PORT', '993')),
                'protocolo': os.environ.get('TEST_EMAIL_PROTOCOL', 'imap'),
                'ssl': True,
                'usuario': os.environ.get('TEST_EMAIL_USER', 'test@example.com'),
                'password': os.environ.get('TEST_EMAIL_PASSWORD', 'password')
            }
        }
    elif monitor_type == 'sftp':
        # Configuración para el monitor SFTP
        test_config = {
            'id': 999,
            'nombre': 'Casilla de prueba',
            'tipo_envio': 'sftp',
            'configuracion': {
                'host': os.environ.get('TEST_SFTP_HOST', 'sftp.example.com'),
                'port': int(os.environ.get('TEST_SFTP_PORT', '22')),
                'usuario': os.environ.get('TEST_SFTP_USER', 'user'),
                'password': os.environ.get('TEST_SFTP_PASSWORD', 'password'),
                'path': os.environ.get('TEST_SFTP_PATH', '/test')
            }
        }
    elif monitor_type == 'filesystem':
        # Configuración para el monitor de sistema de archivos
        # Usar el directorio data/filesystem como origen
        source_dir = os.path.join(os.path.dirname(__file__), 'data', 'filesystem')
        test_config = {
            'id': 999,
            'nombre': 'Casilla de prueba',
            'tipo_envio': 'filesystem',
            'configuracion': {
                'path': source_dir,
                'pattern': '*.zip'  # O el patrón que sea necesario
            }
        }
    else:
        raise ValueError(f"Tipo de monitor no soportado: {monitor_type}")
    
    # Si se proporciona una configuración YAML, cargarla
    if config_path:
        yaml_path = os.path.abspath(config_path)
        if os.path.exists(yaml_path):
            with open(yaml_path, 'r', encoding='utf-8') as f:
                test_config['nombre_yaml'] = os.path.basename(yaml_path)
                # La validación y carga del YAML se hará en el daemon
        else:
            raise FileNotFoundError(f"No se encontró el archivo de configuración: {yaml_path}")
    
    # Devolver la configuración
    return test_config, temp_dir

def run_test(monitor_type, config_path=None, verbose=False):
    """
    Ejecuta una prueba del daemon con una configuración específica
    
    Args:
        monitor_type: Tipo de monitor a probar (email, sftp, filesystem)
        config_path: Ruta al archivo de configuración YAML
        verbose: Mostrar logs detallados
    """
    # Configurar logging
    log_level = logging.DEBUG if verbose else logging.INFO
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Configurar log para que vaya a stdout y a un archivo
    log_dir = os.path.join(os.path.dirname(__file__), 'output', 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"test_{monitor_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
    
    # Configurar handlers de logging
    handlers = [
        logging.StreamHandler(),
        logging.FileHandler(log_file)
    ]
    
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=handlers
    )
    
    logger = logging.getLogger('sage_daemon_test')
    logger.info(f"Iniciando prueba para monitor de tipo {monitor_type}")
    
    try:
        # Configurar entorno de prueba
        test_config, temp_dir = setup_test_environment(monitor_type, config_path)
        logger.info(f"Configuración de prueba creada en {temp_dir}")
        
        # Crear instancia del monitor directamente
        if monitor_type == 'email':
            monitor = EmailMonitor()
        elif monitor_type == 'sftp':
            monitor = SFTPMonitor()
        elif monitor_type == 'filesystem':
            monitor = FilesystemMonitor()
        else:
            raise ValueError(f"Tipo de monitor no soportado: {monitor_type}")
        
        # Verificar nuevos archivos
        logger.info("Verificando archivos nuevos...")
        new_files = monitor.check_new_files(test_config)
        
        if not new_files:
            logger.info("No se encontraron archivos nuevos")
        else:
            logger.info(f"Se encontraron {len(new_files)} archivos nuevos")
            for i, file_info in enumerate(new_files, 1):
                logger.info(f"Archivo {i}:")
                logger.info(f"  Ruta: {file_info['path']}")
                logger.info(f"  Nombre: {file_info['nombre']}")
                logger.info(f"  Emisor ID: {file_info['emisor_id']}")
                logger.info(f"  Metadata: {file_info.get('metadata', {})}")
        
        logger.info("Prueba completada con éxito")
        
    except Exception as e:
        logger.error(f"Error durante la prueba: {str(e)}", exc_info=True)
    finally:
        logger.info(f"Los logs de la prueba han sido guardados en {log_file}")

def main():
    """Función principal del script de prueba"""
    parser = argparse.ArgumentParser(description="SAGE Daemon - Script de prueba")
    parser.add_argument(
        "monitor_type",
        choices=['email', 'sftp', 'filesystem'],
        help="Tipo de monitor a probar"
    )
    parser.add_argument(
        "--config",
        help="Ruta al archivo de configuración YAML"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Mostrar logs detallados"
    )
    
    args = parser.parse_args()
    
    run_test(args.monitor_type, args.config, args.verbose)

if __name__ == "__main__":
    main()
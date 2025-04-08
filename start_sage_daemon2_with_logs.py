#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para ejecutar el SAGE Daemon 2 con un sistema de logs centralizado.

Este script configura un sistema de logs detallado para SAGE Daemon 2 que
registra separadamente las actividades de procesamiento SFTP y Email.
"""

import os
import sys
import logging
import time
from datetime import datetime
from sage_daemon2.daemon import SageDaemon2

def setup_logging():
    """
    Configura el sistema de logging para SAGE Daemon 2
    
    Returns:
        logging.Logger: Logger principal
    """
    # Crear directorio de logs si no existe
    logs_dir = "logs"
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir, exist_ok=True)
    
    # Crear subdirectorios para tipos específicos de logs
    email_logs_dir = os.path.join(logs_dir, "email")
    sftp_logs_dir = os.path.join(logs_dir, "sftp")
    error_logs_dir = os.path.join(logs_dir, "errors")
    
    for directory in [email_logs_dir, sftp_logs_dir, error_logs_dir]:
        if not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
    
    # Configurar logging global
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler("sage_daemon2_log.txt"),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Logger principal
    logger = logging.getLogger("SAGE_Daemon2.Main")
    
    # Logger específico para actividad Email
    email_logger = logging.getLogger("SAGE_Daemon2.EmailProcessor")
    email_logger.setLevel(logging.INFO)
    
    # Archivo de log rotativo para Email
    email_log_file = os.path.join(email_logs_dir, f"email_activity_{datetime.now().strftime('%Y%m%d')}.log")
    email_handler = logging.FileHandler(email_log_file)
    email_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    email_handler.setFormatter(email_formatter)
    email_logger.addHandler(email_handler)
    
    # Logger específico para actividad SFTP
    sftp_logger = logging.getLogger("SAGE_Daemon2.SFTPProcessor")
    sftp_logger.setLevel(logging.INFO)
    
    # Archivo de log rotativo para SFTP
    sftp_log_file = os.path.join(sftp_logs_dir, f"sftp_activity_{datetime.now().strftime('%Y%m%d')}.log")
    sftp_handler = logging.FileHandler(sftp_log_file)
    sftp_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    sftp_handler.setFormatter(sftp_formatter)
    sftp_logger.addHandler(sftp_handler)
    
    # Logger específico para errores
    error_logger = logging.getLogger("SAGE_Daemon2.Errors")
    error_logger.setLevel(logging.ERROR)
    
    # Archivo de log para errores
    error_log_file = os.path.join(error_logs_dir, f"errors_{datetime.now().strftime('%Y%m%d')}.log")
    error_handler = logging.FileHandler(error_log_file)
    error_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s\n%(pathname)s:%(lineno)d\n%(message)s\n')
    error_handler.setFormatter(error_formatter)
    error_logger.addHandler(error_handler)
    
    # Log importante: inicio del sistema
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    logger.info(f"================ INICIO SAGE DAEMON 2 - {timestamp} ================")
    
    return logger

def generate_daily_summary():
    """
    Genera un resumen diario de actividad
    
    Returns:
        dict: Estadísticas diarias
    """
    # Aquí se podría implementar la lógica para generar un resumen
    # de actividades basado en los logs generados
    
    stats = {
        "timestamp": datetime.now().isoformat(),
        "email": {
            "processed": 0,
            "successful": 0,
            "failed": 0
        },
        "sftp": {
            "processed": 0,
            "successful": 0,
            "failed": 0
        }
    }
    
    # TODO: Implementar conteo real basado en los logs
    
    return stats

def main():
    """Función principal"""
    # Configurar sistema de logs
    logger = setup_logging()
    logger.info("Sistema de logs configurado. Iniciando SAGE Daemon 2.")
    
    try:
        # Crear e iniciar daemon
        daemon = SageDaemon2()
        
        # Verificar si se solicita una sola ejecución
        single_execution = len(sys.argv) > 1 and sys.argv[1] == "--once"
        
        # Mostrar mensaje de modo
        mode_msg = "modo único" if single_execution else "modo continuo"
        logger.info(f"Iniciando SAGE Daemon 2 en {mode_msg}")
        
        # Iniciar daemon
        daemon.run(single_execution=single_execution)
    except KeyboardInterrupt:
        logger.info("Detenido manualmente mediante Ctrl+C")
    except Exception as e:
        logger.error(f"Error crítico en SAGE Daemon 2: {str(e)}", exc_info=True)
    finally:
        # Generar resumen diario al finalizar
        if not single_execution:  # Solo para ejecuciones programadas
            stats = generate_daily_summary()
            logger.info(f"Resumen diario generado: {stats}")
            
        logger.info("=============== FIN DE EJECUCIÓN SAGE DAEMON 2 ===============")

if __name__ == "__main__":
    main()
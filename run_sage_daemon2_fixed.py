#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para ejecutar el SAGE Daemon 2 en modo continuo

Este script inicia el SAGE Daemon 2, que monitorea cuentas de correo
configuradas en la base de datos, procesa los correos entrantes y
responde automáticamente según reglas definidas.
"""

import sys
import logging
import os
from sage_daemon2.daemon import SageDaemon2

if __name__ == "__main__":
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler("sage_daemon2_log.txt"),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    logger = logging.getLogger("SAGE_Daemon2.Runner")
    logger.info("Iniciando SAGE Daemon 2 Runner")
    
    # Verificar que existe la variable de entorno DATABASE_URL
    if not os.environ.get('DATABASE_URL'):
        logger.error("No se encontró la variable de entorno DATABASE_URL")
        logger.error("Por favor, configure la variable de entorno DATABASE_URL")
        sys.exit(1)
        
    # Ejecutar el daemon
    try:
        daemon = SageDaemon2()
        
        # Verificar si se solicita una sola ejecución
        single_execution = len(sys.argv) > 1 and sys.argv[1] == "--once"
        
        daemon.run(single_execution)
    except KeyboardInterrupt:
        logger.info("Detenido por interrupción de usuario")
    except Exception as e:
        logger.error(f"Error al ejecutar SAGE Daemon 2: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
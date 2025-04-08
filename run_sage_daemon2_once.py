#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para ejecutar el SAGE Daemon 2 una sola vez

Este script ejecuta una única verificación del SAGE Daemon 2 y luego termina.
Útil para pruebas o para ejecuciones programadas con cron.
"""

import sys
import logging
from sage_daemon2.daemon import SageDaemon2

def main():
    """Función principal"""
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler("sage_daemon2_log.txt"),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    logger = logging.getLogger("run_sage_daemon2_once")
    logger.info("Iniciando SAGE Daemon 2 para una sola ejecución")
    
    # Crear e iniciar daemon
    daemon = SageDaemon2()
    daemon.run(single_execution=True)
    
    logger.info("Ejecución única completada")

if __name__ == "__main__":
    main()
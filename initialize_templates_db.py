#!/usr/bin/env python3
"""
Script para inicializar la base de datos del sistema de plantillas de SAGE

Este script:
1. Crea las tablas necesarias para el sistema de plantillas
2. Carga las plantillas predeterminadas
"""

import os
import sys
import logging
from sage.templates.email.initialize_db import main

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    try:
        logger.info("Iniciando inicialización de base de datos de plantillas")
        main()
        logger.info("Inicialización completada exitosamente")
    except Exception as e:
        logger.error(f"Error durante la inicialización: {e}")
        sys.exit(1)
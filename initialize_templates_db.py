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
import argparse

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def configurar_parser():
    """Configura el parser de argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(
        description='Inicializa la base de datos del sistema de plantillas de SAGE'
    )
    parser.add_argument(
        '--force', 
        action='store_true',
        help='Forzar inicialización aunque ya existan plantillas'
    )
    return parser

def main():
    """Función principal"""
    parser = configurar_parser()
    args = parser.parse_args()
    
    try:
        # Importar módulos del sistema de plantillas
        from sage.templates.email.initialize_db import get_db_connection, create_tables, load_default_templates
        
        # Establecer conexión con la base de datos
        logger.info("Conectando a la base de datos...")
        conn = get_db_connection()
        
        # Crear tablas
        logger.info("Creando tablas...")
        create_tables(conn)
        
        # Cargar plantillas predeterminadas
        if args.force:
            # Si se fuerza, eliminar plantillas existentes
            logger.info("Forzando inicialización, eliminando plantillas existentes...")
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM plantillas_email")
                conn.commit()
        
        logger.info("Cargando plantillas predeterminadas...")
        load_default_templates(conn)
        
        # Cerrar conexión
        conn.close()
        
        logger.info("Inicialización completada correctamente")
        return 0
        
    except ImportError:
        logger.error("No se pudo importar los módulos del sistema de plantillas")
        logger.error("Asegúrese de que el sistema esté instalado correctamente")
        return 1
        
    except Exception as e:
        logger.error(f"Error durante la inicialización: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
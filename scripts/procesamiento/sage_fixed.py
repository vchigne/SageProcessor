#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para ejecutar SAGE con soporte para BOM en archivos CSV
Aplica un parche mínimo que detecta automáticamente BOM
"""
import os
import sys
import logging
from sage.bom_patch_improved import apply_bom_patch

def main():
    """
    Función principal que ejecuta SAGE con soporte para BOM
    """
    # Configuración de logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger("SAGE-BOM")
    logger.info("Iniciando SAGE con soporte para BOM y detección automática")
    
    # Aplicar el parche para detectar automáticamente BOM
    original_read_file = apply_bom_patch()
    logger.info("Parche aplicado exitosamente")
    
    try:
        # Importar SAGE después de aplicar el parche
        from sage.cli import main as sage_main
        
        # Mostrar mensaje informativo
        logger.info("=== SAGE con soporte para BOM y detección automática ===")
        logger.info("Esta versión detecta automáticamente si un archivo CSV tiene BOM")
        logger.info("No es necesario especificar 'encoding' en el YAML")
        logger.info("La detección es transparente y funciona con cualquier archivo")
        
        # Ejecutar SAGE con los argumentos de la línea de comandos
        sys.exit(sage_main())
        
    except Exception as e:
        logger.error(f"Error al ejecutar SAGE: {str(e)}")
        sys.exit(1)
    finally:
        # Restaurar el método original si es necesario
        logger.info("Finalizando ejecución")

if __name__ == "__main__":
    main()
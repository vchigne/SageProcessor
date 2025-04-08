#!/usr/bin/env python
"""
Script para ejecutar el sage daemon una sola vez
"""
import os
import sys
import subprocess
import logging
import argparse

def main():
    """Función principal"""
    # Configurar argumentos de línea de comandos
    parser = argparse.ArgumentParser(description="Ejecuta SAGE Daemon en modo único con opciones adicionales")
    parser.add_argument(
        "--casilla", "-c",
        help="Nombre o ID de casilla específica a procesar (opcional)"
    )
    parser.add_argument(
        "--timeout", "-t",
        type=int,
        default=60,
        help="Timeout en segundos (por defecto: 60)"
    )
    parser.add_argument(
        "--log-level",
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='DEBUG',
        help="Nivel de logging (por defecto: DEBUG)"
    )
    
    args = parser.parse_args()
    
    # Configurar logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )
    
    logger = logging.getLogger('sage_daemon_runner')
    
    # Verificar que existe la variable de entorno DATABASE_URL
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        logger.error("Error: La variable de entorno DATABASE_URL no está configurada")
        sys.exit(1)
    
    try:
        # Construir comando base con opciones
        cmd_base = f"{sys.executable} -m sage_daemon --once --log-level {args.log_level}"
        
        # Agregar opción de casilla si se especificó
        if args.casilla:
            # Si es un número, asumir que es un ID de casilla
            if args.casilla.isdigit():
                logger.info(f"Procesando casilla específica por ID: {args.casilla}")
                cmd_base += f" --casilla-id {args.casilla}"
            else:
                logger.info(f"Procesando casilla específica por nombre: {args.casilla}")
                cmd_base += f" --casilla-nombre \"{args.casilla}\""
        
        # Mensaje informativo
        logger.info(f"Ejecutando SAGE Daemon en modo de ejecución única (timeout: {args.timeout} segundos)")
        
        # Ejecutar con timeout especificado
        timeout_cmd = f"timeout {args.timeout}s {cmd_base}"
        
        logger.debug(f"Comando a ejecutar: {timeout_cmd}")
        exit_code = os.system(timeout_cmd)
        
        if exit_code == 0:
            logger.info("SAGE Daemon completó la ejecución exitosamente")
        else:
            logger.error(f"SAGE Daemon terminó con código de error: {exit_code}")
            if exit_code == 124:
                logger.error(f"El proceso excedió el tiempo límite de {args.timeout} segundos")
            sys.exit(1)
    except Exception as e:
        logger.error(f"Error fatal: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
#!/usr/bin/env python
"""
Script para ejecutar el sage daemon manualmente
"""
import os
import sys
import logging
from sage_daemon.daemon import SageDaemon

def main():
    """Función principal"""
    # Configurar logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )
    
    logger = logging.getLogger('sage_daemon_manual')
    
    # Verificar que existe la variable de entorno DATABASE_URL
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        logger.error("Error: La variable de entorno DATABASE_URL no está configurada")
        sys.exit(1)
    
    try:
        # Iniciar el daemon con intervalo de 5 minutos (300 segundos)
        logger.info("Iniciando SAGE Daemon manualmente")
        daemon = SageDaemon(db_url, check_interval=300)
        
        # Ejecutar el daemon en modo manual (una sola iteración)
        databoxes = daemon.get_active_databoxes()
        
        if not databoxes:
            logger.info("No se encontraron casillas activas configuradas")
        else:
            logger.info(f"Se encontraron {len(databoxes)} casillas activas")
            
            # Procesar cada casilla
            for databox in databoxes:
                try:
                    logger.info(f"Procesando casilla: {databox.get('nombre', 'Sin nombre')} (ID: {databox.get('id', 'desconocido')})")
                    daemon.process_databox(databox)
                except Exception as e:
                    logger.error(f"Error procesando casilla {databox.get('id', 'unknown')}: {str(e)}")
        
        logger.info("Proceso de verificación completado")
        
    except Exception as e:
        logger.error(f"Error fatal: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
"""Entry point for SAGE Daemon"""
import os
import sys
import argparse
import logging
from .daemon import SageDaemon

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="SAGE Daemon - Monitor de archivos")
    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Intervalo de chequeo en segundos (default: 300 - 5 minutos)"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Ejecutar una sola vez y salir"
    )
    parser.add_argument(
        "--log-level",
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help="Nivel de logging (default: INFO)"
    )
    parser.add_argument(
        "--log-file",
        help="Archivo de log (opcional, por defecto usa stdout)"
    )
    parser.add_argument(
        "--casilla-id",
        type=int,
        help="ID de casilla específica a procesar (opcional, solo para modo --once)"
    )
    parser.add_argument(
        "--casilla-nombre",
        help="Nombre de casilla específica a procesar (opcional, solo para modo --once)"
    )

    args = parser.parse_args()

    # Configurar logging
    log_handlers = []

    # Handler para stdout
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(
        logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    )
    log_handlers.append(console_handler)

    # Handler para archivo si se especificó
    if args.log_file:
        try:
            file_handler = logging.FileHandler(args.log_file)
            file_handler.setFormatter(
                logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            )
            log_handlers.append(file_handler)
        except Exception as e:
            print(f"Error configurando log file {args.log_file}: {str(e)}")
            sys.exit(1)

    # Configurar logger root
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        handlers=log_handlers,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Desactivar salida del módulo repr para evitar que se impriman objetos complejos
    logging.getLogger('builtins').setLevel(logging.ERROR)
    
    # Establecer niveles de log específicos para diferentes módulos
    # Para evitar mostrar toda la configuración YAML
    logging.getLogger('sage.models').setLevel(logging.ERROR)
    logging.getLogger('sage.yaml_validator').setLevel(logging.ERROR)
    logging.getLogger('sage.file_processor').setLevel(logging.WARNING)
    logging.getLogger('sage').setLevel(logging.WARNING)
    
    # Establecer el nivel de log para sage_daemon a DEBUG para ver todos los mensajes
    logging.getLogger('sage_daemon').setLevel(logging.DEBUG)
    
    # Desactivar logs de pyyaml que muestran la configuración YAML
    logging.getLogger('yaml').setLevel(logging.WARNING)

    logger = logging.getLogger('sage_daemon.main')

    # Obtener conexión de base de datos
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        logger.error("Error: DATABASE_URL environment variable is required")
        sys.exit(1)

    try:
        # Iniciar daemon
        if args.once:
            logger.info(f"Iniciando SAGE Daemon en modo ejecución única (log level: {args.log_level})")
            daemon = SageDaemon(db_url, args.interval)
            
            # Inicializar variable databoxes primero para evitar problemas de binding
            databoxes = []
            
            # Si se especificó una casilla específica, procesamos solo esa
            if args.casilla_id is not None or args.casilla_nombre is not None:
                # Obtener todas las casillas activas
                all_databoxes = daemon.get_active_databoxes()
                
                if args.casilla_id is not None:
                    # Filtrar por ID
                    databoxes = [db for db in all_databoxes if db.get('id') == args.casilla_id]
                    if not databoxes:
                        logger.error(f"No se encontró ninguna casilla activa con ID: {args.casilla_id}")
                        sys.exit(1)
                    logger.info(f"Filtrando por casilla ID: {args.casilla_id}")
                elif args.casilla_nombre is not None:
                    # Filtrar por nombre (ignorando mayúsculas/minúsculas)
                    nombre_lower = args.casilla_nombre.lower()
                    databoxes = [db for db in all_databoxes 
                                 if db.get('nombre', '').lower() == nombre_lower]
                    if not databoxes:
                        # Intento más flexible con contiene
                        databoxes = [db for db in all_databoxes 
                                    if nombre_lower in db.get('nombre', '').lower()]
                        
                    if not databoxes:
                        logger.error(f"No se encontró ninguna casilla activa con nombre: {args.casilla_nombre}")
                        sys.exit(1)
                    logger.info(f"Filtrando por casilla nombre: {args.casilla_nombre}")
            else:
                # Procesamiento normal de todas las casillas
                databoxes = daemon.get_active_databoxes()
            
            # Comprobamos si hay casillas que procesar
            if not databoxes:
                logger.info("No se encontraron casillas activas configuradas")
            else:
                logger.info(f"Se procesarán {len(databoxes)} casillas activas")
                # Procesar cada casilla
                for databox in databoxes:
                    try:
                        logger.info(f"Procesando casilla: {databox.get('nombre', 'Sin nombre')} (ID: {databox.get('id', 'desconocido')})")
                        daemon.process_databox(databox)
                    except Exception as e:
                        logger.error(f"Error procesando casilla {databox.get('id', 'unknown')}: {str(e)}")
            logger.info("Proceso de verificación completado")
        else:
            # Ejecución continua con intervalo
            logger.info(f"Iniciando SAGE Daemon en modo continuo (intervalo: {args.interval}s, log level: {args.log_level})")
            daemon = SageDaemon(db_url, args.interval)
            daemon.run()
    except KeyboardInterrupt:
        logger.info("\nDeteniendo daemon...")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Error fatal: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
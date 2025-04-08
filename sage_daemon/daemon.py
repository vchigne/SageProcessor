"""Main daemon class for SAGE monitoring system"""
import time
import logging
import os
import yaml
import psycopg2
from typing import List, Dict, Optional
from datetime import datetime
from sage.models import SageConfig
from sage.logger import SageLogger
from sage.file_processor import FileProcessor
from sage.yaml_validator import YAMLValidator
from .monitors import EmailMonitor, SFTPMonitor, FilesystemMonitor

class SageDaemon:
    """Daemon principal para el monitoreo de archivos"""

    def __init__(self, db_url: str, check_interval: int = 60):
        """
        Inicializa el daemon

        Args:
            db_url: URL de conexión a la base de datos
            check_interval: Intervalo de chequeo en segundos
        """
        self.db_url = db_url
        self.check_interval = check_interval
        self.logger = logging.getLogger('sage_daemon')

        # Configurar logging
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
        
        # Evitar la impresión de objetos SageConfig completos en los logs
        logging.getLogger('sage.models.SageConfig').setLevel(logging.ERROR)

        # Inicializar monitores
        self.monitors = {
            'email': EmailMonitor(),
            'sftp': SFTPMonitor(),
            'filesystem': FilesystemMonitor()
        }

    def process_file(self, file_info: Dict, databox: Dict) -> Optional[str]:
        """
        Procesa un archivo usando SAGE

        Returns:
            execution_uuid si el procesamiento fue exitoso, None en caso contrario
        """
        try:
            # Crear directorio temporal para el procesamiento
            execution_dir = f"executions/daemon_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            os.makedirs(execution_dir, exist_ok=True)

            # Imprimir información de depuración
            self.logger.debug(f"Procesando archivo {file_info['path']}")
            self.logger.debug(f"Usando directorio de ejecución: {execution_dir}")
            # Mostrar solo los campos clave del databox sin la configuración YAML completa
            databox_info = {k: v for k, v in databox.items() if k != 'sage_config' and k != 'yaml_contenido'}
            self.logger.debug(f"Configuración del databox: {databox_info}")

            try:
                # Inicializar logger de SAGE con información de casilla y emisor
                casilla_id = databox['id']
                emisor_id = file_info.get('emisor_id')
                metodo_envio = databox['tipo_envio']
                sage_logger = SageLogger(execution_dir, casilla_id, emisor_id, metodo_envio)
                self.logger.debug(f"Logger de SAGE inicializado correctamente con casilla_id={casilla_id}, emisor_id={emisor_id}, metodo_envio={metodo_envio}")

                # Procesar el archivo usando SAGE como librería
                processor = FileProcessor(databox['sage_config'], sage_logger)
                self.logger.debug("FileProcessor inicializado correctamente")

                errors, warnings = processor.process_file(
                    file_path=file_info['path'],
                    package_name=databox['package_name']
                )
                # En caso de que errors y warnings sean listas, mostramos su longitud
                # Si son enteros, mostramos el valor directamente
                num_errors = len(errors) if isinstance(errors, (list, tuple)) else errors
                num_warnings = len(warnings) if isinstance(warnings, (list, tuple)) else warnings
                self.logger.debug(f"Archivo procesado. Errores: {num_errors}, Warnings: {num_warnings}")

                # Registrar resultados
                return execution_dir.split('/')[-1]  # Usar como execution_uuid

            except Exception as e:
                self.logger.error(f"Error procesando archivo: {str(e)}")
                raise  # Re-lanzar la excepción para el manejo superior

        except Exception as e:
            self.logger.error(f"Error procesando archivo: {str(e)}")
            return None

    def get_active_databoxes(self) -> List[Dict]:
        """Obtiene las casillas activas de la base de datos"""
        try:
            with psycopg2.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT 
                            c.id,
                            c.nombre_yaml,
                            c.yaml_contenido,
                            c.instalacion_id,
                            c.email_casilla,
                            ec.servidor_entrada,
                            ec.puerto_entrada,
                            ec.protocolo_entrada,
                            ec.usar_ssl_entrada,
                            ec.servidor_salida,
                            ec.puerto_salida,
                            ec.usar_tls_salida,
                            ec.usuario,
                            ec.password,
                            'email' as tipo_envio
                        FROM casillas c
                        LEFT JOIN email_configuraciones ec ON c.id = ec.casilla_id
                        WHERE c.is_active = true 
                        AND ec.id IS NOT NULL
                        AND (
                            c.fecha_modificacion >= NOW() - INTERVAL '1 hour'
                            OR ec.fecha_modificacion >= NOW() - INTERVAL '1 hour'
                            OR NOT EXISTS (
                                SELECT 1 
                                FROM ejecuciones_yaml ey 
                                WHERE ey.casilla_id = c.id 
                                AND ey.fecha_ejecucion >= NOW() - INTERVAL '1 hour'
                            )
                        )
                    """)
                    # Si no hay descripción de columnas, retornamos lista vacía
                    # Esto no debería suceder con las sentencias SELECT pero es una protección
                    if not hasattr(cur, 'description') or cur.description is None:
                        return []
                        
                    columns = [desc[0] for desc in cur.description]
                    
                    # Obtenemos los resultados
                    rows = cur.fetchall()
                    
                    # Si no hay filas, devolvemos una lista vacía
                    if not rows:
                        return []
                    
                    databoxes = []
                    for row in rows:
                        databox = dict(zip(columns, row))
                        
                        # Creamos la configuración para el monitor de email
                        email_config = {
                            'servidor_entrada': databox.get('servidor_entrada'),
                            'puerto_entrada': databox.get('puerto_entrada'),
                            'protocolo_entrada': databox.get('protocolo_entrada', 'imap'),
                            'usar_ssl_entrada': databox.get('usar_ssl_entrada', True),
                            'servidor_salida': databox.get('servidor_salida'),
                            'puerto_salida': databox.get('puerto_salida'),
                            'usar_tls_salida': databox.get('usar_tls_salida', True),
                            'usuario': databox.get('usuario'),
                            'password': databox.get('password')
                        }
                        
                        # Log para depuración
                        self.logger.debug(f"Credenciales obtenidas de la base de datos para casilla {databox.get('id')}:")
                        self.logger.debug(f"Usuario: {databox.get('usuario')}")
                        self.logger.debug(f"Password: {databox.get('password')}")
                        
                        # Eliminamos las columnas que ya hemos integrado en la configuración
                        for key in ['servidor_entrada', 'puerto_entrada', 'protocolo_entrada', 
                                   'usar_ssl_entrada', 'servidor_salida', 'puerto_salida',
                                   'usar_tls_salida', 'usuario', 'password']:
                            if key in databox:
                                del databox[key]
                        
                        # Añadimos la configuración como campo separado
                        databox['configuracion'] = email_config
                        
                        # Cargamos la configuración YAML
                        yaml_contenido = databox.get('yaml_contenido')
                        if yaml_contenido:
                            try:
                                # Cargamos directamente el contenido desde la columna de la base de datos
                                # Desactivar temporalmente los logs para evitar que se imprima el YAML completo
                                logger_level = logging.getLogger().getEffectiveLevel()
                                logging.getLogger().setLevel(logging.ERROR)
                                
                                yaml_content = yaml.safe_load(yaml_contenido)
                                validator = YAMLValidator()
                                sage_config = validator.validate_yaml(yaml_content)
                                
                                # Restaurar nivel de logs original
                                logging.getLogger().setLevel(logger_level)
                                
                                # Añadir la configuración al databox
                                databox['sage_config'] = sage_config
                                
                                # Obtener el primer paquete como paquete predeterminado
                                if sage_config.packages and len(sage_config.packages) > 0:
                                    databox['package_name'] = list(sage_config.packages.keys())[0]
                                else:
                                    self.logger.warning(f"No se encontraron paquetes en la configuración YAML de casilla {databox['id']}")
                                    continue
                            except Exception as yaml_error:
                                self.logger.error(f"Error cargando YAML de casilla {databox['id']}: {str(yaml_error)}")
                                continue
                        # Si no hay contenido YAML pero sí nombre del archivo, intentamos cargarlo del archivo
                        elif databox.get('nombre_yaml'):
                            try:
                                # Intentamos cargar la configuración desde el archivo
                                yaml_path = f"yaml/{databox['nombre_yaml']}"
                                if os.path.exists(yaml_path):
                                    # Usar el validador YAML para cargar y validar el archivo
                                    with open(yaml_path, 'r', encoding='utf-8') as yaml_file:
                                        yaml_content = yaml.safe_load(yaml_file)
                                    
                                    validator = YAMLValidator()
                                    sage_config = validator.validate_yaml(yaml_content)
                                    
                                    # Añadir la configuración al databox
                                    databox['sage_config'] = sage_config
                                    
                                    # Obtener el primer paquete como paquete predeterminado
                                    if sage_config.packages and len(sage_config.packages) > 0:
                                        databox['package_name'] = list(sage_config.packages.keys())[0]
                                    else:
                                        self.logger.warning(f"No se encontraron paquetes en la configuración YAML: {yaml_path}")
                                        continue
                                else:
                                    self.logger.warning(f"Archivo YAML no encontrado: {yaml_path}")
                                    continue
                            except Exception as yaml_error:
                                self.logger.error(f"Error cargando YAML: {str(yaml_error)}")
                                continue
                        else:
                            self.logger.warning(f"Casilla {databox['id']} sin configuración YAML")
                            continue
                        
                        databoxes.append(databox)
                        
                    return databoxes
        except Exception as e:
            self.logger.error(f"Error obteniendo casillas activas: {str(e)}")
            return []

    def validate_sender(self, emisor_id: int, casilla_id: int) -> bool:
        """Valida si un emisor está autorizado para una casilla"""
        try:
            with psycopg2.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT COUNT(*) 
                        FROM emisores_por_casilla 
                        WHERE emisor_id = %s AND casilla_id = %s AND responsable_activo = true
                    """, (emisor_id, casilla_id))
                    count = cur.fetchone()
                    return count[0] > 0 if count else False
        except Exception as e:
            self.logger.error(f"Error validando emisor {emisor_id} para casilla {casilla_id}: {str(e)}")
            return False

    def process_databox(self, databox: Dict) -> None:
        """Procesa una casilla específica según su configuración"""
        try:
            # Obtener el monitor correspondiente
            monitor = self.monitors.get(databox['tipo_envio'])
            if not monitor:
                self.logger.error(f"Tipo de envío no soportado: {databox['tipo_envio']}")
                return

            # Verificar archivos nuevos
            new_files = monitor.check_new_files(databox)
            if not new_files:
                return

            # Procesar cada archivo
            for file_info in new_files:
                try:
                    # Validar emisor
                    if not self.validate_sender(file_info['emisor_id'], databox['id']):
                        self.logger.warning(f"Emisor no autorizado para la casilla: {file_info['emisor_id']}")
                        continue

                    # Procesar archivo
                    execution_uuid = self.process_file(file_info, databox)
                    if execution_uuid:
                        self.register_processing(execution_uuid, databox['id'], file_info)

                except Exception as e:
                    self.logger.error(f"Error procesando archivo {file_info['path']}: {str(e)}")
                    continue

        except Exception as e:
            self.logger.error(f"Error procesando casilla {databox['id']}: {str(e)}")

    def register_processing(self, execution_uuid: str, databox_id: int, file_info: Dict) -> None:
        """Registra el procesamiento de un archivo en la base de datos"""
        try:
            with psycopg2.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO ejecuciones_yaml (
                            uuid, 
                            casilla_id,
                            emisor_id,
                            metodo_envio,
                            nombre_yaml,
                            archivo_datos,
                            fecha_ejecucion,
                            estado,
                            errores_detectados,
                            warnings_detectados,
                            ruta_directorio
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        execution_uuid,
                        databox_id,
                        file_info['emisor_id'],
                        'email',  # O el valor apropiado para metodo_envio
                        file_info.get('yaml_name', 'unknown'),
                        file_info['nombre'],
                        datetime.now(),
                        'completado',  # Estado inicial
                        0,  # Errores detectados
                        0,  # Warnings detectados
                        f"executions/{execution_uuid}"
                    ))
                conn.commit()
        except Exception as e:
            self.logger.error(f"Error registrando procesamiento en BD: {str(e)}")

    def run(self) -> None:
        """Ejecuta el ciclo principal del daemon"""
        self.logger.info("Iniciando SAGE Daemon")

        while True:
            try:
                # Obtener casillas activas
                databoxes = self.get_active_databoxes()
                if not databoxes:
                    self.logger.info("No hay casillas activas configuradas")
                else:
                    # Obtener IDs para el log sin mostrar detalles sensibles
                    casilla_ids = [db.get('id', 'unknown') for db in databoxes]
                    self.logger.info(f"Procesando {len(databoxes)} casillas activas: {casilla_ids}")

                # Procesar cada casilla
                for databox in databoxes:
                    try:
                        self.process_databox(databox)
                    except Exception as e:
                        self.logger.error(f"Error procesando casilla {databox.get('id', 'unknown')}: {str(e)}")
                        continue

                # Esperar hasta el próximo ciclo
                time.sleep(self.check_interval)

            except Exception as e:
                self.logger.error(f"Error en ciclo principal: {str(e)}")
                time.sleep(self.check_interval)  # Esperar antes de reintentar
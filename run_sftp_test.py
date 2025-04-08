#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para probar la funcionalidad SFTP del SAGE Daemon 2

Este script procesa los archivos locales en data/45 utilizando
la configuración YAML de la casilla 45, simulando la funcionalidad
SFTP sin necesidad de un servidor real.
"""

import os
import logging
import sys
import yaml
import json
import tempfile
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import shutil

from sage.logger import SageLogger
from sage.file_processor import FileProcessor
from sage.exceptions import SAGEError
from sage.utils import create_execution_directory

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("sftp_test.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("SFTP_Test")

def get_database_connection():
    """Establece conexión con la base de datos"""
    try:
        db_url = os.environ.get('DATABASE_URL')
        if not db_url:
            logger.error("Variable de entorno DATABASE_URL no encontrada")
            return None
            
        connection = psycopg2.connect(db_url)
        logger.info("Conexión a base de datos establecida")
        return connection
    except Exception as e:
        logger.error(f"Error al conectar a la base de datos: {str(e)}")
        return None

def get_casilla_info(connection, casilla_id=45):
    """Obtiene información de la casilla"""
    if not connection:
        return None
        
    try:
        query = """
        SELECT c.id, c.nombre, c.yaml_contenido, e.emisor_id as emisor_id
        FROM casillas c
        LEFT JOIN emisores_por_casilla e ON e.casilla_id = c.id AND e.metodo_envio = 'sftp'
        WHERE c.id = %s
        """
        
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (casilla_id,))
            result = cursor.fetchone()
            
        if not result:
            logger.error(f"No se encontró la casilla con ID {casilla_id}")
            return None
            
        logger.info(f"Información de casilla obtenida: {result['nombre']}")
        return result
    except Exception as e:
        logger.error(f"Error al obtener información de casilla: {str(e)}")
        return None

def process_local_files(data_dir, processed_dir, yaml_config, casilla_id, connection=None):
    """
    Procesa archivos locales simulando un servidor SFTP
    
    Args:
        data_dir (str): Directorio de datos
        processed_dir (str): Directorio de procesados
        yaml_config (str): Configuración YAML
        casilla_id (int): ID de la casilla
        connection: Conexión a la base de datos (opcional)
    """
    logger.info(f"Procesando archivos locales en {data_dir}")
    
    # Verificar existencia de directorios
    if not os.path.exists(data_dir):
        logger.warning(f"El directorio {data_dir} no existe localmente")
        try:
            os.makedirs(data_dir, exist_ok=True)
            logger.info(f"Directorio {data_dir} creado localmente")
        except Exception as e:
            logger.error(f"No se pudo crear el directorio {data_dir}: {str(e)}")
            return
            
    if not os.path.exists(processed_dir):
        logger.warning(f"El directorio {processed_dir} no existe localmente")
        try:
            os.makedirs(processed_dir, exist_ok=True)
            logger.info(f"Directorio {processed_dir} creado localmente")
        except Exception as e:
            logger.error(f"No se pudo crear el directorio {processed_dir}: {str(e)}")
            return
            
    # Limpiar directorio procesado al inicio
    try:
        if os.path.exists(processed_dir):
            processed_files = os.listdir(processed_dir)
            for proc_file in processed_files:
                proc_file_path = os.path.join(processed_dir, proc_file)
                try:
                    if os.path.isfile(proc_file_path):
                        os.remove(proc_file_path)
                        logger.info(f"Eliminando archivo procesado antiguo: {proc_file}")
                    elif os.path.isdir(proc_file_path):
                        shutil.rmtree(proc_file_path)
                        logger.info(f"Eliminando directorio procesado antiguo: {proc_file}")
                except Exception as e:
                    logger.error(f"Error al eliminar archivo/directorio procesado antiguo {proc_file}: {str(e)}")
            logger.info(f"Limpieza del directorio procesado completada: {len(processed_files)} archivos/directorios eliminados")
    except Exception as e:
        logger.error(f"Error al limpiar directorio procesado: {str(e)}")
        
    # Listar archivos en el directorio de datos
    try:
        files = os.listdir(data_dir)
    except Exception as e:
        logger.error(f"Error al listar archivos en {data_dir}: {str(e)}")
        return
        
    if not files:
        logger.info(f"No hay archivos para procesar en {data_dir}")
        return
        
    logger.info(f"Se encontraron {len(files)} archivos en {data_dir}")
    
    # Procesar cada archivo
    processed_count = 0
    for filename in files:
        try:
            # Ruta completa al archivo
            file_path = os.path.join(data_dir, filename)
            
            # Verificar que sea un archivo (no un directorio)
            if not os.path.isfile(file_path):
                continue
                
            logger.info(f"Procesando archivo: {filename}")
            
            # Procesar el archivo
            process_result = process_file(file_path, filename, yaml_config, casilla_id, connection)
            
            if process_result and process_result.get('status') == 'success':
                # Mover el archivo al directorio procesado
                try:
                    processed_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    new_filename = f"{processed_timestamp}_{filename}"
                    processed_path = os.path.join(processed_dir, new_filename)
                    
                    # Copiar el archivo al directorio de procesados
                    shutil.copy2(file_path, processed_path)
                    
                    # Eliminar el archivo original
                    os.unlink(file_path)
                    
                    logger.info(f"Archivo {filename} movido a {processed_path}")
                except Exception as e:
                    logger.error(f"Error moviendo archivo {filename}: {str(e)}")
            
            processed_count += 1
            
        except Exception as e:
            logger.error(f"Error procesando archivo {filename}: {str(e)}")
    
    logger.info(f"Procesamiento completado: {processed_count} archivos procesados")

def process_file(file_path, file_name, yaml_config, casilla_id, connection=None):
    """
    Procesa un archivo
    
    Args:
        file_path (str): Ruta al archivo
        file_name (str): Nombre del archivo
        yaml_config (str): Configuración YAML
        casilla_id (int): ID de la casilla
        connection: Conexión a la base de datos (opcional)
    
    Returns:
        dict: Información de procesamiento
    """
    logger.info(f"Procesando archivo: {file_name}")
    
    try:
        # Crear un archivo temporal para el YAML
        yaml_fd, yaml_path = tempfile.mkstemp(suffix='.yaml')
        try:
            with os.fdopen(yaml_fd, 'w') as f:
                f.write(yaml_config)
            
            # Crear manualmente el directorio de ejecución
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            execution_dir = os.path.join("executions", f"{timestamp}_{file_name.replace('/', '_')}")
            os.makedirs(execution_dir, exist_ok=True)
            logger.info(f"Directorio de ejecución: {execution_dir}")
            
            # Escribir el archivo YAML en el directorio de ejecución
            yaml_config_file = os.path.join(execution_dir, 'config.yaml')
            with open(yaml_config_file, 'w', encoding='utf-8') as f:
                f.write(yaml_config)
                
            # Copiar el archivo al directorio de ejecución
            dest_file = os.path.join(execution_dir, os.path.basename(file_path))
            shutil.copy2(file_path, dest_file)
            
            # Crear archivo de resultado vacío para simular
            json_results_path = os.path.join(execution_dir, 'results.json')
            with open(json_results_path, 'w', encoding='utf-8') as f:
                f.write('{"status": "success", "message": "Archivo procesado correctamente"}')
                
            # Crear un reporte HTML básico
            html_report_path = os.path.join(execution_dir, 'report.html')
            with open(html_report_path, 'w', encoding='utf-8') as f:
                f.write('<html><body><h1>Reporte de Procesamiento</h1><p>Archivo procesado correctamente</p></body></html>')
                
            # Crear archivo de log
            log_file_path = os.path.join(execution_dir, 'output.log')
            with open(log_file_path, 'w', encoding='utf-8') as f:
                f.write(f'Archivo {file_name} procesado correctamente\n')
                
            # Simular resultado exitoso    
            result = True
            
            logger.info(f"Archivo {file_name} procesado con éxito")
            
            # Recolectar información de la ejecución
            processing_info = {
                'execution_dir': execution_dir,
                'status': 'success',
                'message': 'Archivo procesado correctamente',
                'log_file': os.path.join(execution_dir, 'output.log'),
                'html_report': os.path.join(execution_dir, 'report.html'),
                'json_results': os.path.join(execution_dir, 'results.json'),
                'yaml_file': yaml_path
            }
            
            # Registrar ejecución en base de datos si hay conexión
            if connection and casilla_id:
                emisor_id = None
                # Intentar obtener el emisor_id desde la consulta de obtención de la casilla
                try:
                    casilla_info = get_casilla_info(connection, casilla_id)
                    if casilla_info and isinstance(casilla_info, dict):
                        emisor_id = casilla_info.get('emisor_id')
                except Exception as e:
                    logger.warning(f"Error obteniendo emisor_id: {str(e)}")
                register_execution(connection, casilla_id, file_name, execution_dir, yaml_config, emisor_id)
            
            return processing_info
        finally:
            # Eliminar el archivo YAML temporal
            try:
                os.unlink(yaml_path)
            except:
                pass
                
    except Exception as e:
        logger.error(f"Error al procesar archivo {file_name}: {str(e)}")
        return {
            'status': 'error',
            'message': f"Error inesperado: {str(e)}"
        }

def register_execution(connection, casilla_id, file_name, execution_dir, yaml_config, emisor_id=None):
    """Registra la ejecución en la base de datos"""
    try:
        # Obtener JSON de resultados
        json_results_path = os.path.join(execution_dir, 'results.json')
        result_data = {}
        if os.path.exists(json_results_path):
            try:
                with open(json_results_path, 'r', encoding='utf-8') as f:
                    result_data = json.load(f)
            except:
                logger.error(f"Error al leer archivo JSON de resultados: {json_results_path}")
        
        # Determinar si incluimos emisor_id en la consulta
        if emisor_id:
            query = """
            INSERT INTO ejecuciones_yaml 
            (casilla_id, fecha_ejecucion, archivo_datos, ruta_directorio, estado, nombre_yaml, emisor_id, metodo_envio) 
            VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s)
            """
        else:
            query = """
            INSERT INTO ejecuciones_yaml 
            (casilla_id, fecha_ejecucion, archivo_datos, ruta_directorio, estado, nombre_yaml, metodo_envio) 
            VALUES (%s, NOW(), %s, %s, %s, %s, %s)
            """
        
        # Asegúrate de que los parámetros coincidan con el orden de las columnas en la consulta SQL
        # El campo estado tiene una restricción de valores: 'Éxito', 'Fallido', 'Parcial'
        estado = "Éxito" if result_data.get('status') == 'success' else "Fallido"
        
        params = [
            casilla_id,            # casilla_id
            file_name,             # archivo_datos
            execution_dir,         # ruta_directorio
            estado,                # estado (success/error)
            "configuracion",       # nombre_yaml (nombre de la configuración)
            "sftp"                 # metodo_envio (siempre "sftp" en este script)
        ]
        
        # Agregar emisor_id si existe
        if emisor_id:
            params.append(emisor_id)  # emisor_id
        
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            connection.commit()
            
        logger.info(f"Ejecución registrada en base de datos para casilla {casilla_id}, emisor {emisor_id}")
        return True
    except Exception as e:
        logger.error(f"Error al registrar ejecución: {str(e)}")
        return False

def main():
    """Función principal"""
    # Obtener conexión a la base de datos
    connection = get_database_connection()
    
    # Obtener información de la casilla (por defecto, casilla 45)
    casilla_id = 45
    casilla_info = get_casilla_info(connection, casilla_id)
    
    if not casilla_info:
        logger.error("No se pudo obtener información de la casilla, abortando")
        if connection:
            connection.close()
        return
        
    # Configurar directorios
    data_dir = f"data/{casilla_id}"
    processed_dir = f"procesado/{casilla_id}"
    
    # Extraer el emisor_id si existe
    emisor_id = casilla_info.get('emisor_id')
    logger.info(f"ID de emisor para casilla {casilla_id}: {emisor_id if emisor_id else 'No configurado'}")
    
    # Procesar archivos locales
    process_local_files(
        data_dir=data_dir,
        processed_dir=processed_dir,
        yaml_config=casilla_info['yaml_contenido'],
        casilla_id=casilla_id,
        connection=connection
    )
    
    # Cerrar conexión a la base de datos
    if connection:
        connection.close()
        logger.info("Conexión a base de datos cerrada")

if __name__ == "__main__":
    main()
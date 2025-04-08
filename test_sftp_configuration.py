#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para configurar un SFTP de prueba en SAGE

Este script inserta una configuración SFTP en la base de datos para
la casilla 45, permitiendo probar la funcionalidad de monitoreo SFTP.
"""

import os
import json
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
import argparse

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("Test_SFTP")

def configurar_parser():
    """Configura el parser de argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description='Configurar SFTP de prueba para SAGE')
    parser.add_argument('--servidor', default='sftp.example.com',
                        help='Servidor SFTP')
    parser.add_argument('--puerto', type=int, default=22,
                        help='Puerto SFTP')
    parser.add_argument('--usuario', default='testuser',
                        help='Usuario SFTP')
    parser.add_argument('--password', default='testpassword',
                        help='Contraseña SFTP')
    parser.add_argument('--casilla', type=int, default=45,
                        help='ID de la casilla (default: 45)')
    return parser

def conectar_bd():
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

def obtener_emisor_id(connection, casilla_id):
    """Obtiene un emisor_id existente para la casilla o crea uno nuevo"""
    try:
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            # Buscar un emisor existente para la casilla
            query = """
            SELECT id FROM emisores_por_casilla
            WHERE casilla_id = %s
            LIMIT 1
            """
            
            cursor.execute(query, (casilla_id,))
            result = cursor.fetchone()
            
            if result:
                emisor_id = result['id']
                logger.info(f"Emisor existente encontrado con ID: {emisor_id}")
                return emisor_id
            
            # No se encontró un emisor, crear uno nuevo
            # Primero verificar que la casilla existe
            query = """
            SELECT id FROM casillas WHERE id = %s
            """
            cursor.execute(query, (casilla_id,))
            if not cursor.fetchone():
                logger.error(f"La casilla con ID {casilla_id} no existe")
                return None
                
            # Crear un nuevo registro en emisores_por_casilla
            query = """
            INSERT INTO emisores_por_casilla (casilla_id, parametros)
            VALUES (%s, %s)
            RETURNING id
            """
            
            params = (casilla_id, json.dumps({}))
            cursor.execute(query, params)
            connection.commit()
            
            emisor_id = cursor.fetchone()['id']
            logger.info(f"Nuevo emisor creado con ID: {emisor_id}")
            return emisor_id
            
    except Exception as e:
        logger.error(f"Error al obtener/crear emisor: {str(e)}")
        return None

def configurar_sftp(connection, emisor_id, sftp_config):
    """Configura parámetros SFTP para un emisor"""
    try:
        with connection.cursor() as cursor:
            # Obtener parámetros actuales
            query = """
            SELECT parametros FROM emisores_por_casilla
            WHERE id = %s
            """
            
            cursor.execute(query, (emisor_id,))
            result = cursor.fetchone()
            
            if result and result[0]:
                # Hay parámetros existentes
                if isinstance(result[0], str):
                    params = json.loads(result[0])
                else:
                    params = result[0]
            else:
                params = {}
            
            # Actualizar con configuración SFTP
            params.update(sftp_config)
            
            # Guardar parámetros actualizados
            query = """
            UPDATE emisores_por_casilla
            SET parametros = %s
            WHERE id = %s
            """
            
            cursor.execute(query, (json.dumps(params), emisor_id))
            connection.commit()
            
            logger.info(f"Configuración SFTP actualizada para emisor {emisor_id}")
            return True
            
    except Exception as e:
        logger.error(f"Error al configurar SFTP: {str(e)}")
        return False

def mostrar_configuracion(connection, emisor_id):
    """Muestra la configuración actual"""
    try:
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            query = """
            SELECT epc.id, epc.casilla_id, c.nombre as casilla_nombre, epc.parametros
            FROM emisores_por_casilla epc
            JOIN casillas c ON epc.casilla_id = c.id
            WHERE epc.id = %s
            """
            
            cursor.execute(query, (emisor_id,))
            result = cursor.fetchone()
            
            if not result:
                logger.error(f"No se encontró el emisor con ID {emisor_id}")
                return
                
            logger.info("----- CONFIGURACIÓN SFTP -----")
            logger.info(f"Emisor ID: {result['id']}")
            logger.info(f"Casilla ID: {result['casilla_id']}")
            logger.info(f"Casilla Nombre: {result['casilla_nombre']}")
            
            if isinstance(result['parametros'], str):
                params = json.loads(result['parametros'])
            else:
                params = result['parametros']
                
            logger.info("Parámetros SFTP:")
            for key, value in params.items():
                # Ocultar contraseña por seguridad
                if key == 'sftp_password':
                    value = '*' * len(str(value))
                logger.info(f"  {key}: {value}")
                
    except Exception as e:
        logger.error(f"Error al mostrar configuración: {str(e)}")

def main():
    """Función principal"""
    parser = configurar_parser()
    args = parser.parse_args()
    
    # Conectar a la base de datos
    connection = conectar_bd()
    if not connection:
        sys.exit(1)
        
    try:
        # Obtener o crear emisor
        emisor_id = obtener_emisor_id(connection, args.casilla)
        if not emisor_id:
            logger.error("No se pudo obtener o crear un emisor")
            connection.close()
            sys.exit(1)
            
        # Configurar SFTP
        sftp_config = {
            'sftp_host': args.servidor,
            'sftp_port': args.puerto,
            'sftp_user': args.usuario,
            'sftp_password': args.password,
            # Agregar emails autorizados para mantener compatibilidad
            'emails_autorizados': ['test@sftp.com', 'info@sage.vidahub.ai']
        }
        
        if configurar_sftp(connection, emisor_id, sftp_config):
            logger.info("Configuración SFTP guardada correctamente")
            
        # Mostrar configuración actual
        mostrar_configuracion(connection, emisor_id)
        
    finally:
        if connection:
            connection.close()
            logger.info("Conexión a base de datos cerrada")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Test específico para Azure con secrets.
Este script prueba el flujo de transferencia de container_name desde configuración a credenciales.
"""

import os
import json
import logging
import psycopg2
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('test_azure_secrets')

def get_database_connection():
    """Obtener conexión a la base de datos"""
    logger.info("Conectando a la base de datos...")
    
    # Obtener parámetros de conexión desde variables de entorno
    db_params = {
        'host': os.environ.get('PGHOST'),
        'database': os.environ.get('PGDATABASE'),
        'user': os.environ.get('PGUSER'),
        'password': os.environ.get('PGPASSWORD'),
        'port': os.environ.get('PGPORT')
    }
    
    # Conectar a la base de datos
    conn = psycopg2.connect(**db_params)
    conn.autocommit = False
    
    return conn

def test_azure_secret():
    """Probar la transferencia de container_name para Azure con secrets"""
    try:
        conn = get_database_connection()
        
        with conn.cursor() as cursor:
            # Obtener proveedor Azure con secret
            cursor.execute("""
                SELECT id, nombre, tipo, credenciales, configuracion, secreto_id
                FROM cloud_providers
                WHERE tipo = 'azure' AND secreto_id IS NOT NULL
                LIMIT 1
            """)
            
            provider = cursor.fetchone()
            if not provider:
                logger.error("No se encontró ningún proveedor Azure con secreto configurado.")
                return
            
            provider_id, provider_name, provider_type, credenciales, configuracion, secreto_id = provider
            logger.info(f"Proveedor encontrado: {provider_name} (ID: {provider_id})")
            
            # Parsear credenciales y configuración
            credenciales = json.loads(credenciales) if isinstance(credenciales, str) else credenciales
            configuracion = json.loads(configuracion) if isinstance(configuracion, str) else configuracion
            
            logger.info(f"Credenciales originales: {list(credenciales.keys())}")
            logger.info(f"Configuración original: {list(configuracion.keys())}")
            
            # Obtener el secreto
            cursor.execute("SELECT * FROM cloud_secrets WHERE id = %s", (secreto_id,))
            secret = cursor.fetchone()
            
            if not secret:
                logger.error(f"No se encontró el secreto con ID {secreto_id}")
                return
            
            # Obtener los campos del secreto
            secret_columns = [desc[0] for desc in cursor.description]
            secret_dict = dict(zip(secret_columns, secret))
            
            logger.info(f"Secreto: {secret_dict['nombre']} (ID: {secret_dict['id']})")
            
            # Obtener las credenciales del secreto
            secret_credentials = json.loads(secret_dict['secretos']) if isinstance(secret_dict['secretos'], str) else secret_dict['secretos']
            logger.info(f"Credenciales del secreto: {list(secret_credentials.keys())}")
            
            # Verificar nombres de contenedor en configuración
            containers = []
            
            if configuracion.get('container_name'):
                containers.append(('container_name', configuracion['container_name']))
                
            if configuracion.get('container'):
                containers.append(('container', configuracion['container']))
                
            if configuracion.get('bucket'):
                containers.append(('bucket', configuracion['bucket']))
                
            if configuracion.get('blob_container'):
                containers.append(('blob_container', configuracion['blob_container']))
            
            if containers:
                logger.info(f"Contenedores encontrados en configuración: {containers}")
                
                # Simular la transferencia como lo hace el daemon
                for key, value in containers:
                    logger.info(f"Simulando transferencia de {key}='{value}' a credenciales del secreto")
                    
                # En un caso real, aquí se transferiría la información
                container_from_config = (
                    configuracion.get('container_name') or 
                    configuracion.get('bucket') or
                    configuracion.get('container') or
                    configuracion.get('blob_container')
                )
                if container_from_config:
                    logger.info(f"Contenedor que se transferiría: '{container_from_config}'")
                    
                    # Verificar si ya existe en credenciales
                    if 'container_name' in secret_credentials:
                        logger.info(f"El secreto ya tiene un container_name configurado: '{secret_credentials['container_name']}'")
                    
                    # En un caso real:
                    # secret_credentials['container_name'] = container_from_config
            else:
                logger.warning("No se encontraron nombres de contenedor en la configuración.")
    
    except Exception as e:
        logger.error(f"Error en la prueba: {e}")
        raise
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    logger.info("Iniciando prueba de Azure con secrets")
    test_azure_secret()
    logger.info("Prueba completada.")
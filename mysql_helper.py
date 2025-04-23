#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Helper de MySQL para conectar con servidores MySQL
desde el backend Node.js a través de Python

Este script:
1. Lee parámetros de la línea de comandos en formato JSON
2. Realiza operaciones en servidores MySQL usando pymysql
3. Devuelve los resultados en formato JSON
"""

import json
import sys
import pymysql
import pymysql.cursors

def connect_to_mysql(host, port, user, password, database=None):
    """Conectar a servidor MySQL"""
    try:
        connection = pymysql.connect(
            host=host,
            port=int(port),
            user=user,
            password=password,
            database=database,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=5
        )
        return connection, None
    except Exception as e:
        return None, str(e)

def list_databases(host, port, user, password):
    """Listar todas las bases de datos disponibles"""
    connection, error = connect_to_mysql(host, port, user, password)
    
    if error:
        return json.dumps({
            "success": False,
            "error": error,
            "message": "Error de conexión: {}".format(error)
        })
    
    try:
        with connection.cursor() as cursor:
            cursor.execute("SHOW DATABASES")
            all_dbs = cursor.fetchall()
            
            # Filtrar bases de datos del sistema
            system_dbs = ["information_schema", "performance_schema", "mysql", "sys"]
            user_dbs = []
            
            for db in all_dbs:
                db_name = db['Database']
                
                # Obtener detalles adicionales si no es una base de datos del sistema
                if db_name not in system_dbs:
                    cursor.execute("SELECT DEFAULT_CHARACTER_SET_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = %s", (db_name,))
                    charset = cursor.fetchone()
                    charset_name = charset['DEFAULT_CHARACTER_SET_NAME'] if charset else 'utf8'
                    
                    cursor.execute("SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s", (db_name,))
                    table_count = cursor.fetchone()
                    count = table_count['count'] if table_count else 0
                    
                    user_dbs.append({
                        "name": db_name,
                        "description": "{} (encoding: {})".format(db_name, charset_name),
                        "encoding": charset_name,
                        "tables": count,
                        "system": False
                    })
            
            # Agregar bases de datos del sistema con información mínima
            system_databases = []
            for db_name in system_dbs:
                cursor.execute("SELECT DEFAULT_CHARACTER_SET_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = %s", (db_name,))
                charset = cursor.fetchone()
                charset_name = charset['DEFAULT_CHARACTER_SET_NAME'] if charset else 'utf8'
                
                system_databases.append({
                    "name": db_name,
                    "description": "Base de datos {} (sistema)".format(db_name),
                    "encoding": charset_name,
                    "tables": 0,  # No contamos tablas para bases del sistema
                    "system": True
                })
            
            # Combinar y devolver resultado
            all_databases = system_databases + user_dbs
            return json.dumps({
                "success": True,
                "databases": all_databases,
                "total": len(all_databases),
                "message": "Se encontraron {} bases de datos de usuario y {} bases de datos del sistema".format(len(user_dbs), len(system_databases))
            })
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e),
            "message": "Error al listar bases de datos: {}".format(str(e))
        })
    finally:
        if connection:
            connection.close()

def create_database(host, port, user, password, db_name):
    """Crear una nueva base de datos"""
    connection, error = connect_to_mysql(host, port, user, password)
    
    if error:
        return json.dumps({
            "success": False,
            "error": error,
            "message": "Error de conexión: {}".format(error)
        })
    
    try:
        with connection.cursor() as cursor:
            # Verificar si la base de datos ya existe
            cursor.execute("SHOW DATABASES LIKE %s", (db_name,))
            exists = cursor.fetchone()
            
            if exists:
                return json.dumps({
                    "success": True,
                    "message": "La base de datos '{}' ya existe".format(db_name),
                    "details": {
                        "database": db_name,
                        "existingDatabase": True
                    }
                })
            
            # Crear la base de datos usando la sintaxis segura de MySQL
            cursor.execute("CREATE DATABASE `%s`" % db_name)
            
            # Verificar que se creó correctamente
            cursor.execute("SHOW DATABASES LIKE %s", (db_name,))
            created = cursor.fetchone()
            
            if not created:
                return json.dumps({
                    "success": False,
                    "message": "No se pudo verificar la creación de la base de datos '{}'".format(db_name),
                    "details": {
                        "database": db_name
                    }
                })
            
            return json.dumps({
                "success": True,
                "message": "Base de datos '{}' creada correctamente".format(db_name),
                "details": {
                    "database": db_name
                }
            })
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e),
            "message": "Error al crear base de datos: {}".format(str(e))
        })
    finally:
        if connection:
            connection.close()

# Punto de entrada principal que determina qué operación ejecutar
if __name__ == "__main__":
    # Leer parámetros de la línea de comandos
    params = json.loads(sys.argv[1])
    operation = params.get("operation")
    
    if operation == "list_databases":
        result = list_databases(
            params.get("host"), 
            params.get("port"), 
            params.get("user"), 
            params.get("password")
        )
        print(result)
    elif operation == "create_database":
        result = create_database(
            params.get("host"), 
            params.get("port"), 
            params.get("user"), 
            params.get("password"),
            params.get("database")
        )
        print(result)
    else:
        print(json.dumps({
            "success": False,
            "message": "Operación no soportada: {}".format(operation)
        }))
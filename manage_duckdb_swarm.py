#!/usr/bin/env python3
"""
Script para gestionar el enjambre (swarm) de servidores DuckDB
"""
import os
import duckdb
import argparse
from tabulate import tabulate
import socket
import time
import random

def configurar_parser():
    """Configura el parser de argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description='Gestionar el enjambre de servidores DuckDB')
    
    # Comandos principales
    subparsers = parser.add_subparsers(dest='comando', help='Comando a ejecutar')
    
    # Comando: agregar servidor
    parser_add = subparsers.add_parser('add-server', help='Agregar un nuevo servidor DuckDB')
    parser_add.add_argument('--hostname', required=True, help='Hostname del servidor')
    parser_add.add_argument('--port', type=int, default=1294, help='Puerto (default: 1294)')
    parser_add.add_argument('--type', default='general', help='Tipo de servidor (analytics, reporting, etc.)')
    
    # Comando: agregar base de datos
    parser_add_db = subparsers.add_parser('add-database', help='Agregar una nueva base de datos')
    parser_add_db.add_argument('--server', type=int, required=True, help='ID del servidor')
    parser_add_db.add_argument('--name', required=True, help='Nombre de la base de datos')
    parser_add_db.add_argument('--path', required=True, help='Ruta de la base de datos')
    parser_add_db.add_argument('--size', type=float, default=0, help='Tamaño en MB (default: 0)')
    
    # Comando: actualizar métricas
    parser_update = subparsers.add_parser('update-metrics', help='Actualizar métricas de servidores')
    parser_update.add_argument('--server', type=int, help='ID del servidor (opcional, actualiza todos si no se especifica)')
    
    # Comando: eliminar servidor
    parser_del = subparsers.add_parser('delete-server', help='Eliminar un servidor DuckDB')
    parser_del.add_argument('--id', type=int, required=True, help='ID del servidor a eliminar')
    
    # Comando: eliminar base de datos
    parser_del_db = subparsers.add_parser('delete-database', help='Eliminar una base de datos')
    parser_del_db.add_argument('--id', type=int, required=True, help='ID de la base de datos a eliminar')
    
    return parser

def agregar_servidor(conn, hostname, port, server_type):
    """
    Agrega un nuevo servidor DuckDB
    
    Args:
        conn: Conexión a DuckDB
        hostname: Hostname del servidor
        port: Puerto del servidor
        server_type: Tipo de servidor
        
    Returns:
        int: ID del servidor creado o None si falló
    """
    try:
        # Verificar si el servidor ya existe
        result = conn.execute(
            "SELECT id FROM duckdb_servers WHERE hostname = ? AND port = ?", 
            [hostname, port]
        ).fetchone()
        
        if result:
            print(f"El servidor {hostname}:{port} ya existe con ID: {result[0]}")
            return result[0]
        
        # Obtener el siguiente ID
        max_id = conn.execute("SELECT MAX(id) FROM duckdb_servers").fetchone()[0]
        next_id = 1 if max_id is None else max_id + 1
        
        # Insertar el nuevo servidor
        conn.execute("""
            INSERT INTO duckdb_servers (id, hostname, port, status, server_type)
            VALUES (?, ?, ?, 'starting', ?)
        """, [next_id, hostname, port, server_type])
        
        print(f"Servidor {hostname}:{port} agregado exitosamente con ID: {next_id}")
        
        # Simular inicialización del servidor
        print(f"Inicializando servidor {hostname}...")
        time.sleep(1)
        
        # Actualizar estado a activo
        conn.execute(
            "UPDATE duckdb_servers SET status = 'active' WHERE id = ?",
            [next_id]
        )
        
        print(f"Servidor {hostname} inicializado y activo")
        return next_id
    except Exception as e:
        print(f"Error al agregar servidor: {e}")
        return None

def agregar_base_datos(conn, server_id, name, path, size):
    """
    Agrega una nueva base de datos
    
    Args:
        conn: Conexión a DuckDB
        server_id: ID del servidor
        name: Nombre de la base de datos
        path: Ruta de la base de datos
        size: Tamaño en MB
        
    Returns:
        int: ID de la base de datos creada o None si falló
    """
    try:
        # Verificar si el servidor existe
        result = conn.execute(
            "SELECT hostname FROM duckdb_servers WHERE id = ?", 
            [server_id]
        ).fetchone()
        
        if not result:
            print(f"El servidor con ID {server_id} no existe")
            return None
        
        hostname = result[0]
        
        # Verificar si la base de datos ya existe
        result = conn.execute(
            "SELECT id FROM db_instances WHERE server_id = ? AND database_name = ?", 
            [server_id, name]
        ).fetchone()
        
        if result:
            print(f"La base de datos {name} ya existe en el servidor {hostname} con ID: {result[0]}")
            return result[0]
        
        # Obtener el siguiente ID
        max_id = conn.execute("SELECT MAX(id) FROM db_instances").fetchone()[0]
        next_id = 1 if max_id is None else max_id + 1
        
        # Insertar la nueva base de datos
        conn.execute("""
            INSERT INTO db_instances (id, server_id, database_name, database_path, size_mb)
            VALUES (?, ?, ?, ?, ?)
        """, [next_id, server_id, name, path, size])
        
        print(f"Base de datos {name} agregada exitosamente al servidor {hostname} con ID: {next_id}")
        return next_id
    except Exception as e:
        print(f"Error al agregar base de datos: {e}")
        return None

def actualizar_metricas(conn, server_id=None):
    """
    Actualiza las métricas de los servidores
    
    Args:
        conn: Conexión a DuckDB
        server_id: ID del servidor (opcional, actualiza todos si no se especifica)
        
    Returns:
        bool: True si se actualizaron las métricas, False si falló
    """
    try:
        # Lista de servidores a actualizar
        if server_id is not None:
            # Verificar si el servidor existe
            result = conn.execute(
                "SELECT id, hostname FROM duckdb_servers WHERE id = ?", 
                [server_id]
            ).fetchall()
            
            if not result:
                print(f"El servidor con ID {server_id} no existe")
                return False
        else:
            # Obtener todos los servidores activos
            result = conn.execute(
                "SELECT id, hostname FROM duckdb_servers WHERE status = 'active'"
            ).fetchall()
            
            if not result:
                print("No hay servidores activos para actualizar métricas")
                return False
        
        for server in result:
            server_id, hostname = server
            
            # Generar métricas aleatorias para simulación
            cpu = random.uniform(20, 95)
            memory = random.uniform(30, 90)
            disk = random.uniform(40, 85)
            queries = random.randint(500, 2000)
            connections = random.randint(1, 20)
            
            # Obtener el siguiente ID
            max_id = conn.execute("SELECT MAX(id) FROM server_metrics").fetchone()[0]
            next_id = 1 if max_id is None else max_id + 1
            
            # Insertar las nuevas métricas
            conn.execute("""
                INSERT INTO server_metrics 
                (id, server_id, cpu_usage, memory_usage, disk_usage, query_count, active_connections)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [next_id, server_id, cpu, memory, disk, queries, connections])
            
            print(f"Métricas actualizadas para servidor {hostname} (ID: {server_id})")
            
            # Si el servidor está muy cargado, mostrar alerta
            if cpu > 90 or memory > 90:
                print(f"⚠️ ALERTA: Servidor {hostname} con alta carga (CPU: {cpu:.1f}%, Memoria: {memory:.1f}%)")
        
        return True
    except Exception as e:
        print(f"Error al actualizar métricas: {e}")
        return False

def eliminar_servidor(conn, server_id):
    """
    Elimina un servidor DuckDB
    
    Args:
        conn: Conexión a DuckDB
        server_id: ID del servidor a eliminar
        
    Returns:
        bool: True si se eliminó el servidor, False si falló
    """
    try:
        # Verificar si el servidor existe
        result = conn.execute(
            "SELECT hostname FROM duckdb_servers WHERE id = ?", 
            [server_id]
        ).fetchone()
        
        if not result:
            print(f"El servidor con ID {server_id} no existe")
            return False
        
        hostname = result[0]
        
        # Verificar si tiene bases de datos
        count = conn.execute(
            "SELECT COUNT(*) FROM db_instances WHERE server_id = ?", 
            [server_id]
        ).fetchone()[0]
        
        if count > 0:
            print(f"No se puede eliminar el servidor {hostname} porque tiene {count} bases de datos asociadas")
            print("Elimine primero las bases de datos o migrelas a otro servidor")
            return False
        
        # Eliminar las métricas asociadas
        conn.execute("DELETE FROM server_metrics WHERE server_id = ?", [server_id])
        
        # Eliminar el servidor
        conn.execute("DELETE FROM duckdb_servers WHERE id = ?", [server_id])
        
        print(f"Servidor {hostname} (ID: {server_id}) eliminado exitosamente")
        return True
    except Exception as e:
        print(f"Error al eliminar servidor: {e}")
        return False

def eliminar_base_datos(conn, db_id):
    """
    Elimina una base de datos
    
    Args:
        conn: Conexión a DuckDB
        db_id: ID de la base de datos a eliminar
        
    Returns:
        bool: True si se eliminó la base de datos, False si falló
    """
    try:
        # Verificar si la base de datos existe
        result = conn.execute("""
            SELECT d.database_name, s.hostname 
            FROM db_instances d
            JOIN duckdb_servers s ON d.server_id = s.id
            WHERE d.id = ?
        """, [db_id]).fetchone()
        
        if not result:
            print(f"La base de datos con ID {db_id} no existe")
            return False
        
        db_name, hostname = result
        
        # Eliminar la base de datos
        conn.execute("DELETE FROM db_instances WHERE id = ?", [db_id])
        
        print(f"Base de datos {db_name} del servidor {hostname} (ID: {db_id}) eliminada exitosamente")
        return True
    except Exception as e:
        print(f"Error al eliminar base de datos: {e}")
        return False

def main():
    """Función principal"""
    # Configurar el parser de argumentos
    parser = configurar_parser()
    args = parser.parse_args()
    
    # Verificar que se proporcionó un comando
    if not args.comando:
        parser.print_help()
        return
    
    # Conexión a DuckDB
    db_path = 'duckdb_data/analytics.duckdb'
    print(f"Conectando a la base de datos DuckDB en: {db_path}")
    
    try:
        conn = duckdb.connect(db_path)
        print("Conexión establecida")
        
        # Ejecutar el comando correspondiente
        if args.comando == 'add-server':
            agregar_servidor(conn, args.hostname, args.port, args.type)
        elif args.comando == 'add-database':
            agregar_base_datos(conn, args.server, args.name, args.path, args.size)
        elif args.comando == 'update-metrics':
            actualizar_metricas(conn, args.server)
        elif args.comando == 'delete-server':
            eliminar_servidor(conn, args.id)
        elif args.comando == 'delete-database':
            eliminar_base_datos(conn, args.id)
        else:
            print(f"Comando no reconocido: {args.comando}")
            parser.print_help()
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()
            print("Conexión cerrada")

if __name__ == "__main__":
    main()
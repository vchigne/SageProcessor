#!/usr/bin/env python3
"""
Script para consultar información del enjambre de servidores DuckDB
"""
import duckdb
import argparse
from tabulate import tabulate

def configurar_parser():
    """Configura el parser de argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description='Consultar información del enjambre de servidores DuckDB')
    
    # Comandos principales
    subparsers = parser.add_subparsers(dest='comando', help='Comando a ejecutar')
    
    # Comando: listar servidores
    parser_servers = subparsers.add_parser('servers', help='Listar servidores DuckDB')
    
    # Comando: listar bases de datos
    parser_dbs = subparsers.add_parser('databases', help='Listar bases de datos')
    parser_dbs.add_argument('--server', type=int, help='ID del servidor (opcional)')
    
    # Comando: mostrar métricas
    parser_metrics = subparsers.add_parser('metrics', help='Mostrar métricas de servidores')
    parser_metrics.add_argument('--server', type=int, help='ID del servidor (opcional)')
    
    # Comando: ejecutar SQL personalizado
    parser_sql = subparsers.add_parser('sql', help='Ejecutar consulta SQL personalizada')
    parser_sql.add_argument('query', help='Consulta SQL a ejecutar')
    
    return parser

def listar_servidores(conn):
    """Lista todos los servidores DuckDB registrados"""
    try:
        result = conn.execute("""
            SELECT 
                id, 
                hostname, 
                port, 
                status, 
                server_type, 
                created_at 
            FROM duckdb_servers
            ORDER BY id
        """).fetchall()
        
        # Obtener nombres de columnas
        column_names = [desc[0] for desc in conn.description]
        
        # Imprimir tabla con tabulate
        print("\nServidores DuckDB registrados:")
        print(tabulate(result, headers=column_names, tablefmt='pretty'))
        
        return True
    except Exception as e:
        print(f"Error al listar servidores: {e}")
        return False

def listar_bases_datos(conn, server_id=None):
    """
    Lista las bases de datos registradas
    
    Args:
        conn: Conexión a DuckDB
        server_id: ID del servidor (opcional, para filtrar)
    """
    try:
        sql = """
            SELECT 
                d.id, 
                d.server_id, 
                s.hostname, 
                d.database_name, 
                d.database_path, 
                d.size_mb, 
                d.created_at 
            FROM db_instances d
            JOIN duckdb_servers s ON d.server_id = s.id
        """
        
        # Agregar filtro por servidor si se especificó
        if server_id is not None:
            sql += f" WHERE d.server_id = {server_id}"
            
        sql += " ORDER BY d.server_id, d.id"
        
        result = conn.execute(sql).fetchall()
        
        # Obtener nombres de columnas
        column_names = [desc[0] for desc in conn.description]
        
        # Imprimir tabla con tabulate
        print("\nBases de datos registradas:")
        if server_id is not None:
            print(f"(Filtrado por servidor ID: {server_id})")
        print(tabulate(result, headers=column_names, tablefmt='pretty'))
        
        return True
    except Exception as e:
        print(f"Error al listar bases de datos: {e}")
        return False

def mostrar_metricas(conn, server_id=None):
    """
    Muestra las métricas de los servidores
    
    Args:
        conn: Conexión a DuckDB
        server_id: ID del servidor (opcional, para filtrar)
    """
    try:
        sql = """
            SELECT 
                m.id,
                m.server_id,
                s.hostname,
                m.cpu_usage,
                m.memory_usage,
                m.disk_usage,
                m.query_count,
                m.active_connections,
                m.timestamp
            FROM server_metrics m
            JOIN duckdb_servers s ON m.server_id = s.id
        """
        
        # Agregar filtro por servidor si se especificó
        if server_id is not None:
            sql += f" WHERE m.server_id = {server_id}"
            
        sql += " ORDER BY m.timestamp DESC, m.server_id"
        
        result = conn.execute(sql).fetchall()
        
        # Obtener nombres de columnas
        column_names = [desc[0] for desc in conn.description]
        
        # Imprimir tabla con tabulate
        print("\nMétricas de servidores:")
        if server_id is not None:
            print(f"(Filtrado por servidor ID: {server_id})")
        print(tabulate(result, headers=column_names, tablefmt='pretty'))
        
        return True
    except Exception as e:
        print(f"Error al mostrar métricas: {e}")
        return False

def ejecutar_sql_personalizado(conn, query):
    """
    Ejecuta una consulta SQL personalizada
    
    Args:
        conn: Conexión a DuckDB
        query: Consulta SQL a ejecutar
    """
    try:
        result = conn.execute(query).fetchall()
        
        # Obtener nombres de columnas
        column_names = [desc[0] for desc in conn.description]
        
        # Imprimir tabla con tabulate
        print("\nResultado de la consulta SQL:")
        print(tabulate(result, headers=column_names, tablefmt='pretty'))
        
        return True
    except Exception as e:
        print(f"Error al ejecutar consulta SQL: {e}")
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
        if args.comando == 'servers':
            listar_servidores(conn)
        elif args.comando == 'databases':
            listar_bases_datos(conn, args.server)
        elif args.comando == 'metrics':
            mostrar_metricas(conn, args.server)
        elif args.comando == 'sql':
            ejecutar_sql_personalizado(conn, args.query)
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
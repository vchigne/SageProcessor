"""
Procesador de materializaciones para SAGE

Este módulo implementa la funcionalidad para procesar materializaciones
después de que un archivo ha sido validado y procesado por SAGE.
"""
import os
import json
import datetime
import pandas as pd
import psycopg2
import boto3
import io
import tempfile
import time
import uuid
import zipfile
import paramiko
from paramiko import SSHClient, SFTPClient
from typing import Optional, Dict, List, Any, Tuple, Union
from urllib.parse import urlparse
from azure.storage.blob import BlobServiceClient, ContentSettings, ContainerClient
import re
from google.cloud.storage import Client as GCPStorageClient
from google.oauth2 import service_account
from .logger import SageLogger

# Formatos de archivo soportados para la materialización
SUPPORTED_FORMATS = {
    'parquet': 'parquet',
    'csv': 'csv',
    'excel': 'xlsx',
    'json': 'json',
    'avro': 'avro',
    'orc': 'orc',
    'hudi': 'hudi',
    'iceberg': 'iceberg'
}

# Operaciones de materialización soportadas
SUPPORTED_OPERATIONS = {
    'append': 'Añadir los datos al final',
    'overwrite': 'Sobrescribir todos los datos',
    'upsert': 'Actualizar registros existentes e insertar nuevos',
    'delete': 'Eliminar registros según condición'
}

class MaterializationProcessor:
    """
    Procesa materializaciones configuradas para un dataframe ya procesado por SAGE.
    """
    
    def __init__(self, logger: SageLogger):
        """
        Inicializa el procesador de materializaciones.
        
        Args:
            logger: Logger de SAGE para registrar eventos
        """
        self.logger = logger
        self.db_connection = None
        self.cloud_clients = {}  # Caché de clientes para proveedores cloud
    
    def _get_database_connection(self):
        """
        Obtiene una conexión a la base de datos
        
        Returns:
            conexión activa a PostgreSQL
        """
        if self.db_connection is None:
            self.db_connection = psycopg2.connect(
                os.environ.get('DATABASE_URL')
            )
        return self.db_connection
        
    def process(self, casilla_id: int, execution_id: str, dataframe: pd.DataFrame) -> None:
        """
        Procesa las materializaciones configuradas para una casilla.
        
        Args:
            casilla_id: ID de la casilla
            execution_id: ID de la ejecución
            dataframe: DataFrame resultante del procesamiento
        """
        if dataframe is None or dataframe.empty:
            self.logger.message("No hay datos para materializar")
            return
            
        try:
            # Obtener las materializaciones configuradas para esta casilla
            materializations = self._get_materializations_for_casilla(casilla_id)
            
            if not materializations:
                self.logger.message(f"No hay materializaciones configuradas para la casilla {casilla_id}")
                return
                
            self.logger.message(f"Procesando {len(materializations)} materializaciones para la casilla {casilla_id}")
            
            # Procesar cada materialización
            for materialization in materializations:
                try:
                    self._process_materialization(materialization, dataframe, execution_id)
                except Exception as e:
                    self.logger.error(
                        f"Error al procesar materialización {materialization['id']}: {str(e)}",
                        execution=execution_id
                    )
                    # Registrar el error en la base de datos
                    self._register_materialization_execution(
                        materialization['id'], 
                        execution_id, 
                        'error', 
                        f"Error: {str(e)}"
                    )
                    
        except Exception as e:
            self.logger.error(
                f"Error al procesar materializaciones: {str(e)}",
                execution=execution_id
            )
        finally:
            # Cerrar conexión si existe
            if self.db_connection:
                self.db_connection.close()
                self.db_connection = None
                
            # Cerrar cualquier cliente cloud que se haya creado
            for client in self.cloud_clients.values():
                if hasattr(client, 'close'):
                    client.close()
    
    def _get_materializations_for_casilla(self, casilla_id: int) -> List[Dict[str, Any]]:
        """
        Obtiene las materializaciones configuradas para una casilla.
        
        Args:
            casilla_id: ID de la casilla
            
        Returns:
            Lista de materializaciones configuradas
        """
        conn = self._get_database_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT id, nombre, descripcion, configuracion, 
                       fecha_creacion, fecha_actualizacion, estado, casilla_id
                FROM materializaciones
                WHERE casilla_id = %s AND (estado = 'activo' OR estado = 'pendiente')
            """, (casilla_id,))
            
            columns = [desc[0] for desc in cursor.description]
            result = []
            
            for row in cursor.fetchall():
                row_dict = dict(zip(columns, row))
                
                # Deserializar los campos JSON
                if 'configuracion' in row_dict and row_dict['configuracion']:
                    try:
                        # Usar 'config' como alias de 'configuracion' para mantener compatibilidad
                        if isinstance(row_dict['configuracion'], str):
                            row_dict['config'] = json.loads(row_dict['configuracion'])
                        else:
                            row_dict['config'] = row_dict['configuracion']
                    except json.JSONDecodeError:
                        self.logger.warning(f"No se pudo deserializar el campo configuracion para la materialización {row_dict['id']}")
                
                result.append(row_dict)
                
            return result
        finally:
            cursor.close()
    
    def _process_materialization(self, materialization: Dict[str, Any], dataframe: pd.DataFrame, execution_id: str) -> None:
        """
        Procesa una materialización específica.
        
        Args:
            materialization: Configuración de la materialización
            dataframe: DataFrame con los datos a materializar
            execution_id: ID de la ejecución
        """
        self.logger.message(f"Procesando materialización: {materialization['nombre']}")
        
        try:
            # Obtener la configuración de la materialización
            config = materialization.get('config', {})
            if not config:
                raise ValueError("La materialización no tiene configuración")
            
            # Imprimir configuración para depuración
            self.logger.message(f"Configuración de materialización: {json.dumps(config, ensure_ascii=False, default=str)}")
            
            # Determinar el tipo de destino y el ID, compatibles con ambos formatos
            destination_type = None
            destination_id = None
            
            # Formato 1: destination_type y destination_id directamente
            if 'destination_type' in config:
                destination_type = config.get('destination_type')
                destination_id = config.get('destination_id')
            
            # Formato 2: tipoProveedor y proveedorId
            elif 'tipoProveedor' in config:
                # Mapear tipoProveedor a destination_type
                tipo_proveedor = config.get('tipoProveedor')
                if tipo_proveedor == 'cloud':
                    destination_type = 'cloud'
                elif tipo_proveedor == 'db':
                    destination_type = 'db'
                
                # Obtener el ID del proveedor
                destination_id = config.get('proveedorId')
                
            # Formato 3: destino "archivo" o "base_datos" 
            elif 'destino' in config:
                if config.get('destino') == 'archivo':
                    # Cuando el destino es "archivo", asumimos que es un destino de tipo cloud
                    destination_type = 'cloud'
                    
                    # Buscar el destino_id en los diferentes campos posibles
                    destination_id = config.get('destino_id') or config.get('destino_cloud_id') or config.get('cloud_provider_id')
                    
                    # Si no encontramos un ID explícito, verificamos si hay un error en los logs
                    if not destination_id:
                        self.logger.warning(f"Configuración con destino='archivo' pero sin especificar el ID del proveedor cloud. Recomendamos agregar 'destino_id' a la configuración.")
                
                elif config.get('destino') == 'base_datos':
                    # Cuando el destino es "base_datos", asumimos que es un destino de tipo db
                    destination_type = 'db'
                    
                    # Buscar el ID de la conexión de base de datos
                    destination_id = config.get('proveedorId')
                    
                    # Si no encontramos un ID explícito, verificamos si hay un error en los logs
                    if not destination_id:
                        self.logger.warning(f"Configuración con destino='base_datos' pero sin especificar el ID del proveedor. Recomendamos agregar 'proveedorId' a la configuración.")
            
            # Verificar que se haya podido determinar el destino
            if not destination_type:
                raise ValueError("No se ha podido determinar el tipo de destino. Configuración: " + json.dumps(config))
                
            if not destination_id:
                raise ValueError("No se ha podido determinar el ID del destino. Configuración: " + json.dumps(config))
            
            self.logger.message(f"Destino determinado: tipo={destination_type}, id={destination_id}")
            
            # Preparar el DataFrame según la configuración
            prepared_df = self._prepare_dataframe(dataframe, config)
            
            # Materializar según el tipo de destino
            if destination_type == 'db':
                self._materialize_to_database(prepared_df, destination_id, config, materialization['id'], execution_id)
            elif destination_type == 'cloud':
                self._materialize_to_cloud(prepared_df, destination_id, config, materialization['id'], execution_id)
            else:
                raise ValueError(f"Tipo de destino no soportado: {destination_type}")
                
        except Exception as e:
            self.logger.error(f"Error al procesar materialización {materialization['nombre']}: {str(e)}")
            # Registrar el error
            self._register_materialization_execution(
                materialization['id'],
                execution_id,
                'error',
                f"Error: {str(e)}"
            )
            raise
    
    def _prepare_dataframe(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """
        Prepara el DataFrame para la materialización según la configuración.
        
        Args:
            df: DataFrame original
            config: Configuración de la materialización
            
        Returns:
            DataFrame preparado
        """
        # Hacer una copia para no modificar el original
        result_df = df.copy()
        
        # Aplicar selección de columnas si está configurado
        # Verificar formato 1 (column_mapping como diccionario)
        column_mapping = config.get('column_mapping', {})
        column_mappings_list = config.get('columnMappings', [])
        
        if column_mapping:
            # Formato 1: diccionario con dest_col -> source_col
            # Crear un nuevo DataFrame con las columnas mapeadas
            new_df = pd.DataFrame()
            for dest_col, source_col in column_mapping.items():
                if source_col in result_df.columns:
                    new_df[dest_col] = result_df[source_col]
                else:
                    self.logger.warning(f"Columna {source_col} no existe en el DataFrame original")
            
            # Si no se pudo mapear ninguna columna, lanzar error
            if new_df.empty and not result_df.empty:
                raise ValueError("No se pudieron mapear columnas según la configuración")
                
            result_df = new_df
        
        elif column_mappings_list:
            # Formato 2: lista de diccionarios con originName y targetName
            self.logger.message(f"Usando mapeo de columnas en formato de lista: {column_mappings_list}")
            new_df = pd.DataFrame()
            
            for mapping in column_mappings_list:
                source_col = mapping.get('originName')
                dest_col = mapping.get('targetName')
                
                if source_col and dest_col and source_col in result_df.columns:
                    new_df[dest_col] = result_df[source_col]
                elif source_col:
                    self.logger.warning(f"Columna {source_col} no existe en el DataFrame original")
            
            # Si no se pudo mapear ninguna columna, lanzar error
            if new_df.empty and not result_df.empty:
                raise ValueError("No se pudieron mapear columnas según la configuración")
                
            result_df = new_df
        
        # Aplicar transformaciones de tipos de datos si está configurado
        column_types = config.get('column_types', {})
        if column_types:
            for col, col_type in column_types.items():
                if col in result_df.columns:
                    try:
                        if col_type == 'int' or col_type == 'integer':
                            result_df[col] = pd.to_numeric(result_df[col], errors='coerce').astype('Int64')
                        elif col_type == 'float' or col_type == 'decimal':
                            result_df[col] = pd.to_numeric(result_df[col], errors='coerce')
                        elif col_type == 'datetime' or col_type == 'date':
                            result_df[col] = pd.to_datetime(result_df[col], errors='coerce')
                        elif col_type == 'bool' or col_type == 'boolean':
                            result_df[col] = result_df[col].astype(bool)
                        else:
                            # Por defecto, convertir a string
                            result_df[col] = result_df[col].astype(str)
                    except Exception as e:
                        self.logger.warning(f"Error al convertir columna {col} a tipo {col_type}: {str(e)}")
        
        # Aplicar filtros si están configurados
        filters = config.get('filters', [])
        if filters:
            for filter_config in filters:
                col = filter_config.get('column')
                op = filter_config.get('operator')
                val = filter_config.get('value')
                
                if col and op and val is not None and col in result_df.columns:
                    try:
                        if op == 'eq':
                            result_df = result_df[result_df[col] == val]
                        elif op == 'neq':
                            result_df = result_df[result_df[col] != val]
                        elif op == 'gt':
                            result_df = result_df[result_df[col] > val]
                        elif op == 'gte':
                            result_df = result_df[result_df[col] >= val]
                        elif op == 'lt':
                            result_df = result_df[result_df[col] < val]
                        elif op == 'lte':
                            result_df = result_df[result_df[col] <= val]
                        elif op == 'in':
                            if isinstance(val, list):
                                result_df = result_df[result_df[col].isin(val)]
                        elif op == 'notin':
                            if isinstance(val, list):
                                result_df = result_df[~result_df[col].isin(val)]
                        elif op == 'isnull':
                            result_df = result_df[result_df[col].isnull()]
                        elif op == 'notnull':
                            result_df = result_df[result_df[col].notnull()]
                    except Exception as e:
                        self.logger.warning(f"Error al aplicar filtro {op} en columna {col}: {str(e)}")
        
        return result_df
    
    def _materialize_to_database(self, df: pd.DataFrame, db_conn_id: int, config: Dict[str, Any], 
                              materialization_id: int, execution_id: str) -> None:
        """
        Materializa el DataFrame a una base de datos.
        
        Args:
            df: DataFrame preparado
            db_conn_id: ID de la conexión a base de datos
            config: Configuración de la materialización
            materialization_id: ID de la materialización
            execution_id: ID de la ejecución
        """
        if df.empty:
            self.logger.warning("No hay datos para materializar a la base de datos")
            self._register_materialization_execution(
                materialization_id, 
                execution_id, 
                'completado', 
                "No hay datos para materializar"
            )
            return
        
        # Obtener información de la conexión a la base de datos
        db_connection_info = self._get_db_connection_info(db_conn_id)
        if not db_connection_info:
            raise ValueError(f"No se encontró la conexión a base de datos con ID {db_conn_id}")
        
        # Obtener parámetros de configuración
        table_name = config.get('table_name') or config.get('tablaDestino')
        if not table_name:
            raise ValueError("No se ha especificado el nombre de la tabla")
            
        schema_name = config.get('schema_name', 'public')
        
        # Determinar la operación (estrategia de actualización)
        operation = config.get('operation') or config.get('estrategiaActualizacion')
        if operation == 'reemplazar':
            operation = 'overwrite'
        elif operation == 'agregar':
            operation = 'append'
        elif operation == 'actualizar':
            operation = 'upsert'
        else:
            operation = 'append'  # valor por defecto
        
        # Conectar a la base de datos de destino
        target_conn = None
        try:
            # Construir el connection string según el tipo de base de datos
            conn_string = self._build_db_connection_string(db_connection_info)
            
            # Conectar usando el driver adecuado según el tipo de base de datos
            if db_connection_info['tipo'] == 'postgresql':
                target_conn = psycopg2.connect(conn_string)
            elif db_connection_info['tipo'] == 'duckdb':
                self.logger.message(f"Usando DuckDB como base de datos: {db_connection_info['servidor']}")
                # Para DuckDB no es necesario crear una conexión directa aquí, 
                # lo manejamos a través de SQLAlchemy
            
            # Usar SQLAlchemy para la materialización
            import sqlalchemy
            
            # Log para ayudar a diagnosticar problemas de conexión
            self.logger.message(f"Creando engine SQLAlchemy con connection string: {conn_string.replace(db_connection_info.get('contrasena', ''), '***')}")
            
            # Configuraciones específicas para diferentes tipos de base de datos
            if db_connection_info['tipo'] == 'duckdb':
                # Instalar el módulo duckdb-engine si es necesario (opcional)
                try:
                    import duckdb_engine
                    self.logger.message("Módulo duckdb_engine disponible para SQLAlchemy")
                except ImportError:
                    self.logger.warning("Módulo duckdb_engine no disponible, usando driver genérico")
            
            # Crear engine SQLAlchemy
            engine = sqlalchemy.create_engine(conn_string)
            
            # Materializar según la operación
            if operation == 'append':
                df.to_sql(
                    name=table_name,
                    schema=schema_name,
                    con=engine,
                    if_exists='append',
                    index=False
                )
                rows_affected = len(df)
                self.logger.message(f"Se agregaron {rows_affected} filas a la tabla {schema_name}.{table_name}")
                
            elif operation == 'overwrite':
                df.to_sql(
                    name=table_name,
                    schema=schema_name,
                    con=engine,
                    if_exists='replace',
                    index=False
                )
                rows_affected = len(df)
                self.logger.message(f"Se sobrescribió la tabla {schema_name}.{table_name} con {rows_affected} filas")
                
            elif operation == 'upsert':
                # Para upsert, necesitamos la clave primaria
                pk_columns = config.get('primary_key') or config.get('primaryKey', [])
                if not pk_columns:
                    raise ValueError("Para operación upsert se requiere especificar clave primaria (primaryKey)")
                
                # Implementación de upsert dependiente del tipo de base de datos
                if db_connection_info['tipo'] == 'postgresql':
                    self._postgres_upsert(engine, df, table_name, schema_name, pk_columns)
                elif db_connection_info['tipo'] == 'duckdb':
                    self._duckdb_upsert(engine, df, table_name, schema_name, pk_columns)
                else:
                    raise ValueError(f"Operación upsert no soportada para {db_connection_info['tipo']}")
                
                rows_affected = len(df)
                self.logger.message(f"Se actualizaron/insertaron {rows_affected} filas en la tabla {schema_name}.{table_name}")
                
            else:
                raise ValueError(f"Operación no soportada: {operation}")
                
            # Registrar éxito
            self._register_materialization_execution(
                materialization_id,
                execution_id,
                'completado',
                f"Materialización completada: {rows_affected} filas procesadas"
            )
            
        except Exception as e:
            self.logger.error(f"Error al materializar a base de datos: {str(e)}")
            self._register_materialization_execution(
                materialization_id,
                execution_id,
                'error',
                f"Error al materializar a base de datos: {str(e)}"
            )
            raise
        finally:
            # Cerrar conexión
            if target_conn:
                target_conn.close()
    
    def _postgres_upsert(self, engine, df: pd.DataFrame, table_name: str, 
                      schema_name: str, pk_columns: List[str]) -> None:
        """
        Implementa la operación UPSERT para PostgreSQL.
        
        Args:
            engine: Conexión SQLAlchemy
            df: DataFrame a materializar
            table_name: Nombre de la tabla
            schema_name: Nombre del esquema
            pk_columns: Lista de columnas que forman la clave primaria
        """
        import sqlalchemy
        import io
        from sqlalchemy import text
        
        # Crear tabla si no existe
        df.head(0).to_sql(
            name=table_name,
            schema=schema_name,
            con=engine,
            if_exists='append',
            index=False
        )
        
        # Generar SQL para UPSERT
        temp_table = f"temp_{table_name}_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Crear tabla temporal con los datos a insertar/actualizar
        df.to_sql(temp_table, engine, index=False, if_exists='replace')
        
        # Construir la cláusula ON CONFLICT
        pk_list = ", ".join(pk_columns)
        update_columns = [col for col in df.columns if col not in pk_columns]
        update_stmt = ", ".join([f"{col} = EXCLUDED.{col}" for col in update_columns])
        
        # SQL para UPSERT
        sql = f"""
        INSERT INTO {schema_name}.{table_name}
        SELECT * FROM {temp_table}
        ON CONFLICT ({pk_list})
        DO UPDATE SET {update_stmt}
        """
        
        # Ejecutar la sentencia
        with engine.begin() as conn:
            conn.execute(text(sql))
            conn.execute(text(f"DROP TABLE {temp_table}"))
            
    def _duckdb_upsert(self, engine, df: pd.DataFrame, table_name: str, 
                     schema_name: str, pk_columns: List[str]) -> None:
        """
        Implementa la operación UPSERT para DuckDB.
        
        Args:
            engine: Conexión SQLAlchemy
            df: DataFrame a materializar
            table_name: Nombre de la tabla
            schema_name: Nombre del esquema (puede ser ignorado en DuckDB)
            pk_columns: Lista de columnas que forman la clave primaria
        """
        import sqlalchemy
        from sqlalchemy import text
        
        self.logger.message(f"Ejecutando upsert en DuckDB para tabla {table_name}")
        
        # Manejo específico para DuckDB con SQLAlchemy
        try:
            # Crear tabla si no existe (DuckDB normalmente ignora el schema)
            qualified_table_name = f"{table_name}"
            if schema_name and schema_name != 'main':
                qualified_table_name = f"{schema_name}.{table_name}"
                
            # Log para depuración
            self.logger.message(f"Tabla destino para upsert: {qualified_table_name}")
            
            # Generar tabla temporal
            temp_table = f"temp_{table_name}_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            # Crear tabla temporal con los datos a insertar/actualizar
            self.logger.message(f"Creando tabla temporal {temp_table} con {len(df)} filas")
            df.to_sql(temp_table, engine, index=False, if_exists='replace')
            
            # Verificar si la tabla destino existe
            check_table_sql = f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'"
            
            with engine.connect() as conn:
                result = conn.execute(text(check_table_sql))
                table_exists = bool(result.fetchone())
                
                if not table_exists:
                    self.logger.message(f"La tabla {qualified_table_name} no existe, creándola...")
                    # Crear la tabla destino a partir del dataframe
                    df.head(0).to_sql(
                        name=table_name,
                        con=engine,
                        if_exists='append',
                        index=False
                    )
            
            # Construir la lista de columnas PK para la condición de join
            join_conditions = []
            for col in pk_columns:
                join_conditions.append(f"a.{col} = b.{col}")
            join_condition = " AND ".join(join_conditions)
            
            # Columnas a actualizar (todas menos las PK)
            update_columns = [col for col in df.columns if col not in pk_columns]
            
            # Sentencias SQL para realizar el upsert en DuckDB
            if update_columns:
                # 1. Actualizar registros existentes
                update_sets = ", ".join([f"a.{col} = b.{col}" for col in update_columns])
                update_sql = f"""
                UPDATE {qualified_table_name} AS a
                SET {update_sets}
                FROM {temp_table} AS b
                WHERE {join_condition}
                """
                
                # 2. Insertar registros nuevos
                not_exists_condition = " AND ".join([f"a.{col} IS NULL" for col in pk_columns])
                insert_sql = f"""
                INSERT INTO {qualified_table_name}
                SELECT b.*
                FROM {temp_table} AS b
                LEFT JOIN {qualified_table_name} AS a ON {join_condition}
                WHERE {not_exists_condition} OR a.{pk_columns[0]} IS NULL
                """
                
                # Ejecutar las sentencias
                with engine.begin() as conn:
                    # Primero actualizar registros existentes
                    self.logger.message(f"Actualizando registros existentes en {qualified_table_name}")
                    conn.execute(text(update_sql))
                    
                    # Luego insertar los nuevos
                    self.logger.message(f"Insertando nuevos registros en {qualified_table_name}")
                    conn.execute(text(insert_sql))
                    
                    # Eliminar tabla temporal
                    self.logger.message("Eliminando tabla temporal")
                    conn.execute(text(f"DROP TABLE {temp_table}"))
            else:
                # Si no hay columnas a actualizar, simplemente insertamos los registros que no existen
                not_exists_sql = f"""
                INSERT INTO {qualified_table_name}
                SELECT b.*
                FROM {temp_table} AS b
                LEFT JOIN {qualified_table_name} AS a ON {join_condition}
                WHERE a.{pk_columns[0]} IS NULL
                """
                
                with engine.begin() as conn:
                    self.logger.message(f"Insertando sólo nuevos registros en {qualified_table_name}")
                    conn.execute(text(not_exists_sql))
                    conn.execute(text(f"DROP TABLE {temp_table}"))
                    
            self.logger.message(f"Upsert en DuckDB completado exitosamente para tabla {qualified_table_name}")
                
        except Exception as e:
            self.logger.error(f"Error en upsert de DuckDB: {str(e)}")
            raise
    
    def _materialize_to_cloud(self, df: pd.DataFrame, cloud_provider_id: int, config: Dict[str, Any], 
                           materialization_id: int, execution_id: str) -> None:
        """
        Materializa el DataFrame a un almacenamiento en la nube.
        
        Args:
            df: DataFrame preparado
            cloud_provider_id: ID del proveedor cloud
            config: Configuración de la materialización
            materialization_id: ID de la materialización
            execution_id: ID de la ejecución
        """
        if df.empty:
            self.logger.warning("No hay datos para materializar al almacenamiento en la nube")
            self._register_materialization_execution(
                materialization_id, 
                execution_id, 
                'completado', 
                "No hay datos para materializar"
            )
            return
        
        # Obtener información del proveedor cloud
        provider_info = self._get_cloud_provider_info(cloud_provider_id)
        if not provider_info:
            raise ValueError(f"No se encontró el proveedor cloud con ID {cloud_provider_id}")
        
        # Obtener parámetros de configuración
        # Primero verificamos el formato - usamos el campo 'file_format' o 'formato'
        file_format = config.get('file_format') or config.get('formato', 'parquet')
        if file_format not in SUPPORTED_FORMATS:
            raise ValueError(f"Formato de archivo no soportado: {file_format}")
            
        # Luego buscamos la ruta de destino - preferimos 'destination_path', pero si no existe
        # podemos construirla a partir de 'tablaDestino' o 'destino'
        destination_path = config.get('destination_path')
        if not destination_path:
            # Si no hay ruta explícita, construirla a partir de otros campos
            tabla_destino = config.get('tablaDestino')
            if tabla_destino:
                # Construir un path amigable a partir del nombre de la tabla
                destination_path = f"/data/{file_format}/{tabla_destino}"
                self.logger.message(f"Usando ruta de destino derivada de tablaDestino: {destination_path}")
            else:
                raise ValueError("No se ha especificado la ruta de destino ni tablaDestino")
            
        # Asegurar que la ruta comienza con /
        if not destination_path.startswith('/'):
            destination_path = '/' + destination_path
            
        # Crear cliente según el tipo de proveedor
        provider_type = provider_info['tipo']
        
        # Verificar la partición si está configurada
        partition_columns = config.get('partition_columns', [])
        
        try:
            if provider_type == 's3' or provider_type == 'minio':
                self._materialize_to_s3_compatible(df, provider_info, destination_path, file_format, partition_columns, config)
            elif provider_type == 'azure':
                self._materialize_to_azure(df, provider_info, destination_path, file_format, partition_columns, config)
            elif provider_type == 'gcp':
                self._materialize_to_gcp(df, provider_info, destination_path, file_format, partition_columns, config)
            elif provider_type == 'sftp':
                self._materialize_to_sftp(df, provider_info, destination_path, file_format, partition_columns, config)
            else:
                raise ValueError(f"Tipo de proveedor cloud no soportado: {provider_type}")
                
            # Registrar éxito
            rows_affected = len(df)
            self._register_materialization_execution(
                materialization_id,
                execution_id,
                'completado',
                f"Materialización completada: {rows_affected} filas procesadas en formato {file_format}"
            )
            
        except Exception as e:
            self.logger.error(f"Error al materializar a almacenamiento cloud: {str(e)}")
            self._register_materialization_execution(
                materialization_id,
                execution_id,
                'error',
                f"Error al materializar a almacenamiento cloud: {str(e)}"
            )
            raise
    
    def _materialize_to_s3_compatible(self, df: pd.DataFrame, provider_info: Dict[str, Any], 
                                    destination_path: str, file_format: str, 
                                    partition_columns: List[str], config: Dict[str, Any] = None) -> None:
        """
        Materializa el DataFrame a un bucket S3 o compatible (ej: MinIO).
        
        Args:
            df: DataFrame preparado
            provider_info: Información del proveedor
            destination_path: Ruta de destino
            file_format: Formato del archivo
            partition_columns: Columnas para particionar los datos
        """
        # Parsear credenciales y configuración
        config = provider_info['configuracion'] if isinstance(provider_info['configuracion'], dict) else json.loads(provider_info['configuracion']) if 'configuracion' in provider_info else {}
        credentials = provider_info['credenciales'] if isinstance(provider_info['credenciales'], dict) else json.loads(provider_info['credenciales']) if 'credenciales' in provider_info else {}
        
        # Bucket puede estar en credenciales o en configuración
        bucket_name = credentials.get('bucket') or config.get('bucket')
        if not bucket_name:
            raise ValueError(f"No se ha configurado un bucket para el proveedor {provider_info['nombre']}")
        
        # Crear cliente S3
        s3_client = self._get_s3_client(provider_info)
        
        # Procesar según formato
        buffer = io.BytesIO()
        # Inicializar con un valor por defecto
        content_type = 'application/octet-stream'
        file_ext = '.bin'
        
        if file_format == 'parquet':
            df.to_parquet(buffer, engine='pyarrow', index=False)
            content_type = 'application/octet-stream'
            file_ext = '.parquet'
        elif file_format == 'csv':
            df.to_csv(buffer, index=False)
            content_type = 'text/csv'
            file_ext = '.csv'
        elif file_format == 'excel':
            df.to_excel(buffer, index=False, engine='openpyxl')
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            file_ext = '.xlsx'
        elif file_format == 'json':
            df.to_json(buffer, orient='records', lines=True)
            content_type = 'application/json'
            file_ext = '.json'
        elif file_format in ['avro', 'orc', 'hudi', 'iceberg']:
            # Para formatos avanzados, usar carpeta temporal
            with tempfile.TemporaryDirectory() as temp_dir:
                # Inicializar con extensión genérica (será reemplazada en los casos específicos)
                file_ext = '.bin'
                temp_file = os.path.join(temp_dir, f"data{file_ext}")
                
                if file_format == 'avro':
                    from fastavro import writer, parse_schema
                    # Definir esquema basado en DataFrame
                    fields = []
                    for col in df.columns:
                        fields.append({
                            "name": col,
                            "type": ["null", "string"]  # Por defecto todo como string o null
                        })
                    schema = {
                        "type": "record",
                        "name": "Data",
                        "fields": fields
                    }
                    parsed_schema = parse_schema(schema)
                    
                    # Convertir DataFrame a registros
                    records = df.to_dict('records')
                    
                    # Escribir archivo Avro
                    with open(temp_file, 'wb') as out:
                        writer(out, parsed_schema, records)
                
                elif file_format == 'orc':
                    # Usar pyarrow para ORC
                    import pyarrow as pa
                    from pyarrow import orc
                    table = pa.Table.from_pandas(df)
                    orc.write_table(table, temp_file)
                
                elif file_format == 'hudi':
                    # Implementación avanzada para Apache Hudi
                    self.logger.message(f"Implementando materialización en formato Apache Hudi")
                    
                    # Obtenemos las columnas de clave primaria si están configuradas
                    primary_key_cols = []
                    if config:
                        primary_key_cols = config.get('primaryKey', []) or config.get('primary_key', [])
                        if not primary_key_cols and isinstance(config.get('primaryKey'), str):
                            # Si es un string, convertir a lista
                            primary_key_cols = [config.get('primaryKey')]
                    
                    if not primary_key_cols:
                        self.logger.warning("No se han especificado columnas de clave primaria para Hudi, se usará la primera columna")
                        primary_key_cols = [df.columns[0]] if len(df.columns) > 0 else []
                    
                    # Validar que las columnas de primary key existan en el DataFrame
                    for pk_col in primary_key_cols:
                        if pk_col not in df.columns:
                            raise ValueError(f"La columna de clave primaria '{pk_col}' no existe en el DataFrame")
                    
                    # Estructura de directorios para Hudi
                    hudi_base_dir = os.path.join(temp_dir, "hudi_table")
                    os.makedirs(hudi_base_dir, exist_ok=True)
                    
                    # Crear un directorio para la partición global (.hoodie)
                    hoodie_dir = os.path.join(hudi_base_dir, ".hoodie")
                    os.makedirs(hoodie_dir, exist_ok=True)
                    
                    # Crear metadatos de tabla Hudi
                    hudi_metadata = {
                        "tableName": os.path.basename(destination_path.rstrip('/')),
                        "tableType": "COPY_ON_WRITE",  # Usar COPY_ON_WRITE como tipo predeterminado
                        "primaryKey": primary_key_cols,
                        "preCombineField": primary_key_cols[0] if primary_key_cols else None,
                        "partitionFields": partition_columns,
                        "created": datetime.datetime.now().isoformat()
                    }
                    
                    # Guardar metadatos
                    with open(os.path.join(hoodie_dir, "hudi_metadata.json"), 'w') as f:
                        json.dump(hudi_metadata, f, indent=2)
                    
                    # Guardar esquema de la tabla
                    schema = {
                        "type": "struct",
                        "fields": [
                            {"name": col, "type": self._map_pandas_type_to_hudi(df[col].dtype)} 
                            for col in df.columns
                        ]
                    }
                    
                    with open(os.path.join(hoodie_dir, "schema.json"), 'w') as f:
                        json.dump(schema, f, indent=2)
                    
                    # Guardar datos en formato parquet (formato base de Hudi)
                    data_dir = os.path.join(hudi_base_dir, "data")
                    os.makedirs(data_dir, exist_ok=True)
                    
                    # Generar un commit ID único
                    commit_time = str(int(time.time() * 1000))
                    
                    # Crear particiones si es necesario
                    if partition_columns:
                        # Guardar en particiones
                        for partition_values, partition_df in df.groupby(partition_columns):
                            if not isinstance(partition_values, tuple):
                                partition_values = (partition_values,)
                            
                            # Construir ruta de partición
                            partition_path = "/".join([f"{col}={val}" for col, val in zip(partition_columns, partition_values)])
                            partition_dir = os.path.join(data_dir, partition_path)
                            os.makedirs(partition_dir, exist_ok=True)
                            
                            # Guardar datos de partición
                            partition_df.to_parquet(os.path.join(partition_dir, f"{commit_time}.parquet"), engine='pyarrow', index=False)
                    else:
                        # Sin particiones, guardar todo en un archivo
                        df.to_parquet(os.path.join(data_dir, f"{commit_time}.parquet"), engine='pyarrow', index=False)
                    
                    # Crear archivo de log de commits
                    with open(os.path.join(hoodie_dir, "commits.log"), 'w') as f:
                        f.write(f"{commit_time}\n")
                    
                    # Comprimir toda la estructura como archivo .zip para subir
                    zip_path = os.path.join(temp_dir, "hudi_table.zip")
                    
                    # Crear archivo ZIP con la estructura completa
                    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                        for root, _, files in os.walk(hudi_base_dir):
                            for file in files:
                                file_path = os.path.join(root, file)
                                arcname = os.path.relpath(file_path, hudi_base_dir)
                                zipf.write(file_path, arcname)
                    
                    # Usar el ZIP como archivo temporal para subir
                    temp_file = zip_path
                    file_ext = '.zip'
                    
                    self.logger.message(f"Tabla Hudi creada con éxito: {len(df)} registros, clave primaria: {primary_key_cols}")
                
                elif file_format == 'iceberg':
                    # Implementación avanzada para Apache Iceberg
                    self.logger.message(f"Implementando materialización en formato Apache Iceberg")
                    
                    # Obtener configuración para Iceberg
                    partition_by = partition_columns
                    primary_key_cols = []
                    if config:
                        primary_key_cols = config.get('primaryKey', []) or config.get('primary_key', [])
                    
                    # Estructura de directorios para Iceberg
                    iceberg_base_dir = os.path.join(temp_dir, "iceberg_table")
                    os.makedirs(iceberg_base_dir, exist_ok=True)
                    
                    # Crear directorios de metadatos
                    metadata_dir = os.path.join(iceberg_base_dir, "metadata")
                    os.makedirs(metadata_dir, exist_ok=True)
                    
                    # Crear directorio de datos
                    data_dir = os.path.join(iceberg_base_dir, "data")
                    os.makedirs(data_dir, exist_ok=True)
                    
                    # Obtener esquema de la tabla en formato Iceberg
                    fields = []
                    for i, col in enumerate(df.columns):
                        col_type = self._map_pandas_type_to_iceberg(df[col].dtype)
                        field = {
                            "id": i+1,
                            "name": col,
                            "required": False,
                            "type": col_type
                        }
                        fields.append(field)
                    
                    # Crear esquema
                    schema = {
                        "type": "struct",
                        "schema-id": 0,
                        "fields": fields
                    }
                    
                    # Crear archivo de metadatos de tabla
                    table_metadata = {
                        "format-version": 2,
                        "table-uuid": str(uuid.uuid4()),
                        "location": destination_path.rstrip('/'),
                        "last-sequence-number": 0,
                        "last-updated-ms": int(time.time() * 1000),
                        "last-column-id": len(df.columns),
                        "current-schema-id": 0,
                        "schemas": [schema],
                        "partition-specs": [{
                            "spec-id": 0,
                            "fields": [
                                {
                                    "name": col,
                                    "transform": "identity",
                                    "source-id": next((f["id"] for f in fields if f["name"] == col), None),
                                    "field-id": 1000 + i
                                } for i, col in enumerate(partition_by)
                            ]
                        }] if partition_by else [],
                        "default-spec-id": 0,
                        "partition-spec": [
                            {"name": col, "transform": "identity", "source-id": i+1, "field-id": 1000+i} 
                            for i, col in enumerate(partition_by)
                        ] if partition_by else [],
                        "properties": {
                            "write.format.default": "parquet",
                            "write.parquet.compression-codec": "snappy"
                        },
                        "current-snapshot-id": -1,
                        "snapshots": [],
                        "snapshot-log": [],
                        "metadata-log": []
                    }
                    
                    # Guardar metadatos
                    with open(os.path.join(metadata_dir, "v1.json"), 'w') as f:
                        json.dump(table_metadata, f, indent=2)
                    
                    # Guardar datos en parquet
                    snapshot_id = int(time.time())
                    manifest_file = os.path.join(metadata_dir, f"manifest-{snapshot_id}.json")
                    
                    # Crear snapshot actual
                    if partition_by:
                        # Con particiones
                        manifest_entries = []
                        for partition_values, partition_df in df.groupby(partition_by):
                            if not isinstance(partition_values, tuple):
                                partition_values = (partition_values,)
                            
                            # Construir ruta de partición
                            partition_path_parts = [f"{col}={val}" for col, val in zip(partition_by, partition_values)]
                            partition_path = "/".join(partition_path_parts)
                            partition_dir = os.path.join(data_dir, partition_path)
                            os.makedirs(partition_dir, exist_ok=True)
                            
                            # Nombre de archivo para esta partición
                            file_id = str(uuid.uuid4())
                            data_file = os.path.join(partition_dir, f"data-{file_id}.parquet")
                            
                            # Guardar datos
                            partition_df.to_parquet(data_file, engine='pyarrow', index=False)
                            
                            # Registrar en el manifiesto
                            manifest_entries.append({
                                "status": 1,  # ADDED
                                "snapshot-id": snapshot_id,
                                "data-file": {
                                    "file-path": f"data/{partition_path}/data-{file_id}.parquet",
                                    "file-format": "PARQUET",
                                    "partition": dict(zip(partition_by, partition_values)),
                                    "record-count": len(partition_df),
                                    "file-size-in-bytes": os.path.getsize(data_file)
                                }
                            })
                    else:
                        # Sin particiones
                        file_id = str(uuid.uuid4())
                        data_file = os.path.join(data_dir, f"data-{file_id}.parquet")
                        df.to_parquet(data_file, engine='pyarrow', index=False)
                        
                        manifest_entries = [{
                            "status": 1,  # ADDED
                            "snapshot-id": snapshot_id,
                            "data-file": {
                                "file-path": f"data/data-{file_id}.parquet",
                                "file-format": "PARQUET",
                                "partition": {},
                                "record-count": len(df),
                                "file-size-in-bytes": os.path.getsize(data_file)
                            }
                        }]
                    
                    # Guardar manifiesto
                    with open(manifest_file, 'w') as f:
                        for entry in manifest_entries:
                            f.write(json.dumps(entry) + "\n")
                    
                    # Actualizar metadatos con el nuevo snapshot
                    table_metadata["snapshots"].append({
                        "snapshot-id": snapshot_id,
                        "timestamp-ms": int(time.time() * 1000),
                        "summary": {
                            "operation": "append",
                            "added-files": str(len(manifest_entries)),
                            "added-records": str(len(df))
                        },
                        "manifest-list": f"metadata/manifest-{snapshot_id}.json",
                        "schema-id": 0
                    })
                    table_metadata["current-snapshot-id"] = snapshot_id
                    
                    # Guardar metadatos actualizados
                    with open(os.path.join(metadata_dir, "v2.json"), 'w') as f:
                        json.dump(table_metadata, f, indent=2)
                    
                    # Comprimir toda la estructura como archivo .zip para subir
                    zip_path = os.path.join(temp_dir, "iceberg_table.zip")
                    
                    # Crear archivo ZIP con la estructura completa
                    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                        for root, _, files in os.walk(iceberg_base_dir):
                            for file in files:
                                file_path = os.path.join(root, file)
                                arcname = os.path.relpath(file_path, iceberg_base_dir)
                                zipf.write(file_path, arcname)
                    
                    # Usar el ZIP como archivo temporal para subir
                    temp_file = zip_path
                    file_ext = '.zip'
                    
                    self.logger.message(f"Tabla Iceberg creada con éxito: {len(df)} registros, particionada por: {partition_by}")
                
                # Subir el archivo desde la carpeta temporal
                with open(temp_file, 'rb') as file_obj:
                    destination_key = destination_path.lstrip('/')
                    s3_client.upload_fileobj(
                        file_obj, 
                        bucket_name, 
                        destination_key,
                        ExtraArgs={'ContentType': 'application/octet-stream'}
                    )
                
                self.logger.message(f"Archivo materializado en s3://{bucket_name}/{destination_key}")
                return
        else:
            raise ValueError(f"Formato de archivo no soportado: {file_format}")
        
        # Mover el cursor al inicio del buffer
        buffer.seek(0)
        
        # Subir a S3
        destination_key = destination_path.lstrip('/')
        if not destination_key.endswith(file_ext):
            destination_key += file_ext
            
        s3_client.upload_fileobj(
            buffer, 
            bucket_name, 
            destination_key,
            ExtraArgs={'ContentType': content_type}
        )
        
        self.logger.message(f"Archivo materializado en s3://{bucket_name}/{destination_key}")
    
    def _materialize_to_azure(self, df: pd.DataFrame, provider_info: Dict[str, Any], 
                            destination_path: str, file_format: str, 
                            partition_columns: List[str], config: Dict[str, Any] = None) -> None:
        """
        Materializa el DataFrame a Azure Blob Storage.
        
        Args:
            df: DataFrame preparado
            provider_info: Información del proveedor
            destination_path: Ruta de destino
            file_format: Formato del archivo
            partition_columns: Columnas para particionar los datos
        """
        # Parsear credenciales y configuración
        config = provider_info['configuracion'] if isinstance(provider_info['configuracion'], dict) else json.loads(provider_info['configuracion']) if 'configuracion' in provider_info else {}
        credentials = provider_info['credenciales'] if isinstance(provider_info['credenciales'], dict) else json.loads(provider_info['credenciales']) if 'credenciales' in provider_info else {}
        
        # Buscar el container en diferentes variantes de nombre (container, container_name, bucket)
        container_name = credentials.get('container_name') or credentials.get('container') or config.get('container_name') or config.get('container') or config.get('bucket')
        if not container_name:
            raise ValueError(f"No se ha configurado un container para el proveedor Azure {provider_info['nombre']}")
        
        # Preparar el cliente de Azure - Buscar connection_string en credenciales o configuración
        connection_string = credentials.get('connection_string') or config.get('connection_string')
        
        # Log para depuración
        self.logger.message(f"Credenciales Azure: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
        self.logger.message(f"Configuración Azure: {list(config.keys()) if config else 'No hay configuración'}")
        
        # Log adicional para connection_string
        if connection_string:
            self.logger.message(f"Usando connection_string de {'credenciales' if credentials.get('connection_string') else 'configuración'}")
            # Solo mostrar parte inicial y final de la cadena para seguridad
            safe_str = connection_string[:20] + "..." + connection_string[-20:] if len(connection_string) > 50 else "***"
            self.logger.message(f"Connection string (parcial): {safe_str}")
        
        # Crear cliente de blob service según el tipo de credenciales
        blob_service_client = None
        container_client = None
        use_sas = False
        account_name = None
        
        # Verificar si la connection_string es en formato URL+SAS (como en janitor_daemon.py)
        if connection_string:
            # La cadena puede estar en dos formatos:
            # 1. URL+SAS: comienza con https:// o tiene https:// y 'blob.core.windows.net'
            # 2. Formato estándar: comienza con BlobEndpoint=, DefaultEndpointsProtocol=, etc.
            if connection_string.startswith('https://') or ('https://' in connection_string and 'blob.core.windows.net' in connection_string):
                use_sas = True
                self.logger.message("Detectado formato connection_string con URL Blob Storage, activando modo SAS")
            elif connection_string.startswith('BlobEndpoint=') or connection_string.startswith('DefaultEndpointsProtocol='):
                use_sas = False
                self.logger.message("Detectado formato connection_string estándar de Azure")
            
            # Solo intentar extraer el account_name para URLs de Azure Blob
            if use_sas:
                try:
                    parts = connection_string.split(';')
                    for part in parts:
                        if part.startswith('https://'):
                            parsed_url = urlparse(part)
                            hostname = parsed_url.netloc
                            account_match = re.match(r'([^\.]+)\.blob\.core\.windows\.net', hostname)
                            if account_match:
                                account_name = account_match.group(1)
                                self.logger.message(f"Extraído account_name de la URL: {account_name}")
                                break
                except Exception as e:
                    self.logger.warning(f"No se pudo extraer el account_name de la URL: {e}")
        
        # Crear cliente de blob service según el tipo de credenciales
        if use_sas:
            self.logger.message("Usando modo SAS para Azure con URL + SAS token")
            
            # Formato estándar de conexión con SAS incluido
            # Ejemplos:
            # 1. BlobEndpoint=https://account.blob.core.windows.net/;SharedAccessSignature=token
            # 2. https://account.blob.core.windows.net/;SharedAccessSignature=token
            if connection_string and (';SharedAccessSignature=' in connection_string or 'SharedAccessSignature=' in connection_string):
                self.logger.message("Detectado formato con SharedAccessSignature explícito")
                parts = connection_string.split(';')
                base_url = None
                sas_token = None
                
                for part in parts:
                    if part.startswith('https://') or part.startswith('BlobEndpoint=https://'):
                        # Eliminar BlobEndpoint= si existe
                        clean_part = part.replace('BlobEndpoint=', '')
                        base_url = clean_part
                    elif part.startswith('SharedAccessSignature='):
                        sas_token = part.replace('SharedAccessSignature=', '')
                
                if not base_url or not sas_token:
                    raise ValueError("No se pudo extraer la URL base o el SAS token de la cadena de conexión")
                
                # Si el base_url no incluye el container, lo añadimos
                if not f"/{container_name}" in base_url:
                    container_url = f"{base_url}/{container_name}"
                else:
                    container_url = base_url
                
                # Asegurarnos de que el SAS token comience con ?
                if not sas_token.startswith('?'):
                    sas_token = f"?{sas_token}"
                
                self.logger.message(f"URL del contenedor: {container_url}")
                self.logger.message(f"Longitud del SAS token: {len(sas_token)}")
                
                # Crear el container_client directamente con la URL + SAS
                container_client = ContainerClient.from_container_url(f"{container_url}{sas_token}")
                
                # Si necesitamos un BlobServiceClient para operaciones a nivel de servicio 
                if account_name:
                    blob_service_url = f"https://{account_name}.blob.core.windows.net"
                    blob_service_client = BlobServiceClient(account_url=blob_service_url, credential=sas_token)
                else:
                    # En este caso no podemos crear un BlobServiceClient, pero no lo necesitamos
                    # si ya tenemos un ContainerClient
                    blob_service_client = None
            else:
                # La cadena parece ser una URL completa con SAS token en la query
                try:
                    parsed_url = urlparse(connection_string)
                    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"
                    sas_token = f"?{parsed_url.query}" if parsed_url.query else ""
                    
                    # Si la URL no incluye el contenedor, lo añadimos
                    if not f"/{container_name}" in base_url:
                        container_url = f"{base_url}/{container_name}"
                    else:
                        container_url = base_url
                    
                    self.logger.message(f"URL del contenedor: {container_url}")
                    self.logger.message(f"Longitud del SAS token: {len(sas_token)}")
                    
                    # Crear el container_client directamente con la URL + SAS
                    container_client = ContainerClient.from_container_url(f"{container_url}{sas_token}")
                    
                    # Si necesitamos un BlobServiceClient para operaciones a nivel de servicio
                    if account_name:
                        blob_service_url = f"https://{account_name}.blob.core.windows.net"
                        blob_service_client = BlobServiceClient(account_url=blob_service_url, credential=sas_token.lstrip('?'))
                    else:
                        blob_service_client = None
                except Exception as e:
                    self.logger.error(f"Error al procesar la URL de Azure: {e}")
                    raise ValueError(f"No se pudo procesar la URL de Azure: {e}")
        elif not connection_string:
            # No hay connection_string, intentamos con account_name y otras credenciales
            account_name = credentials.get('account_name') or config.get('account_name')
            account_key = credentials.get('account_key') or config.get('account_key')
            sas_token = credentials.get('sas_token') or config.get('sas_token')
            
            if account_name and sas_token:
                # Usar SAS token
                self.logger.message(f"Usando autenticación con SAS token para Azure")
                account_url = f"https://{account_name}.blob.core.windows.net"
                if not sas_token.startswith('?'):
                    sas_token = f"?{sas_token}"
                blob_service_client = BlobServiceClient(account_url=f"{account_url}{sas_token}")
            elif account_name and account_key:
                # Usar account key
                self.logger.message(f"Usando autenticación con account key para Azure")
                connection_string = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={account_key};EndpointSuffix=core.windows.net"
                blob_service_client = BlobServiceClient.from_connection_string(connection_string)
            else:
                raise ValueError("Se requiere connection_string, account_name + sas_token, o account_name + account_key para Azure")
        else:
            # Usar connection_string estándar
            self.logger.message(f"Usando autenticación con connection_string estándar para Azure")
            try:
                blob_service_client = BlobServiceClient.from_connection_string(connection_string)
            except Exception as e:
                self.logger.error(f"Error al crear el cliente de Azure con connection_string estándar: {e}")
                raise ValueError(f"Error al crear el cliente de Azure con connection_string estándar: {e}")
        
        # Si tenemos blob_service_client pero no container_client, creamos el container_client
        if blob_service_client and not container_client:
            container_client = blob_service_client.get_container_client(container_name)
        
        if not container_client:
            raise ValueError("No se pudo crear el cliente de contenedor para Azure")
        
        # Procesar según formato
        buffer = io.BytesIO()
        # Inicializar con un valor por defecto
        content_type = 'application/octet-stream'
        file_ext = '.bin'
        
        if file_format == 'parquet':
            df.to_parquet(buffer, engine='pyarrow', index=False)
            content_type = 'application/octet-stream'
            file_ext = '.parquet'
        elif file_format == 'csv':
            df.to_csv(buffer, index=False)
            content_type = 'text/csv'
            file_ext = '.csv'
        elif file_format == 'excel':
            df.to_excel(buffer, index=False, engine='openpyxl')
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            file_ext = '.xlsx'
        elif file_format == 'json':
            df.to_json(buffer, orient='records', lines=True)
            content_type = 'application/json'
            file_ext = '.json'
        elif file_format in ['avro', 'orc', 'hudi', 'iceberg']:
            # Para formatos avanzados, necesitamos implementación específica
            # Similar a S3 pero con el cliente de Azure
            raise NotImplementedError(f"Formato {file_format} aún no implementado para Azure")
        else:
            raise ValueError(f"Formato de archivo no soportado: {file_format}")
        
        # Mover el cursor al inicio del buffer
        buffer.seek(0)
        
        # Subir a Azure
        destination_key = destination_path.lstrip('/')
        if not destination_key.endswith(file_ext):
            destination_key += file_ext
            
        blob_client = container_client.get_blob_client(destination_key)
        blob_client.upload_blob(buffer, overwrite=True, content_settings=ContentSettings(
            content_type=content_type,
            cache_control=None
        ))
        
        self.logger.message(f"Archivo materializado en azure://{container_name}/{destination_key}")
    
    def _materialize_to_sftp(self, df: pd.DataFrame, provider_info: Dict[str, Any], 
                           destination_path: str, file_format: str, 
                           partition_columns: List[str], config: Dict[str, Any] = None) -> None:
        """
        Materializa el DataFrame a un servidor SFTP.
        
        Args:
            df: DataFrame preparado
            provider_info: Información del proveedor
            destination_path: Ruta de destino
            file_format: Formato del archivo
            partition_columns: Columnas para particionar los datos
        """
        import paramiko
        import tempfile
        import os
        
        # Parsear credenciales y configuración
        config = provider_info.get('configuracion', {}) or {}
        credentials = provider_info.get('credenciales', {}) or {}
        
        # Los parámetros pueden estar en credenciales o en configuración
        host = credentials.get('host') or config.get('host')
        port = int(credentials.get('port', 22) or config.get('port', 22))
        user = credentials.get('user') or config.get('user')
        password = credentials.get('password') or config.get('password')
        
        if not host:
            raise ValueError("No se configuró correctamente el host para SFTP")
            
        if not user:
            raise ValueError("No se configuró correctamente el usuario para SFTP")
            
        if not password:
            raise ValueError("No se configuró correctamente la contraseña para SFTP")
            
        # Logs para depuración
        self.logger.message(f"Credenciales SFTP: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
        self.logger.message(f"Configuración SFTP: {list(config.keys()) if config else 'No hay configuración'}")
        self.logger.message(f"Conexión SFTP a {host}:{port} como {user}")
        
        # Crear archivo temporal para el DataFrame según el formato
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_file_path = os.path.join(temp_dir, f"data")
            
            # Añadir extensión según formato
            if file_format == 'parquet':
                temp_file_path += '.parquet'
                df.to_parquet(temp_file_path, engine='pyarrow', index=False)
            elif file_format == 'csv':
                temp_file_path += '.csv'
                df.to_csv(temp_file_path, index=False)
            elif file_format == 'excel':
                temp_file_path += '.xlsx'
                df.to_excel(temp_file_path, index=False, engine='openpyxl')
            elif file_format == 'json':
                temp_file_path += '.json'
                df.to_json(temp_file_path, orient='records', lines=True)
            elif file_format in ['avro', 'orc', 'hudi', 'iceberg']:
                # Para formatos avanzados, no implementados aún para SFTP
                raise NotImplementedError(f"Formato {file_format} aún no implementado para SFTP")
            else:
                raise ValueError(f"Formato de archivo no soportado: {file_format}")
                
            # Crear cliente SFTP
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            try:
                # Conectar al servidor
                self.logger.message(f"Conectando a servidor SFTP {host}:{port}...")
                ssh_client.connect(
                    hostname=host,
                    port=port,
                    username=user,
                    password=password
                )
                
                # Crear cliente SFTP
                sftp_client = ssh_client.open_sftp()
                
                # Normalizar la ruta de destino
                destination_path = destination_path.lstrip('/')
                
                # Determinar el nombre del archivo remoto (añadir extensión si no la tiene)
                if '/' in destination_path:
                    remote_dir = os.path.dirname(destination_path)
                    remote_file_name = os.path.basename(destination_path)
                else:
                    remote_dir = ''
                    remote_file_name = destination_path
                
                # Añadir extensión si es necesario
                if '.' not in remote_file_name:
                    remote_file_name = f"{remote_file_name}{os.path.splitext(temp_file_path)[1]}"
                
                # Obtener la ruta base desde credenciales o configuración
                base_path = credentials.get('path', '') or config.get('path', '')
                base_path = base_path.rstrip('/') if base_path else ''
                
                # Construir la ruta completa
                if base_path and remote_dir:
                    remote_path = f"{base_path}/{remote_dir}/{remote_file_name}"
                elif base_path:
                    remote_path = f"{base_path}/{remote_file_name}"
                elif remote_dir:
                    remote_path = f"{remote_dir}/{remote_file_name}"
                else:
                    remote_path = remote_file_name
                
                # Log para depuración
                self.logger.message(f"Ruta remota calculada: {remote_path}")
                
                # Intentar crear el directorio remoto si es necesario
                if remote_dir:
                    full_remote_dir = f"{base_path}/{remote_dir}" if base_path else remote_dir
                    try:
                        self.logger.message(f"Verificando/creando directorio remoto: {full_remote_dir}")
                        self._sftp_mkdir_p(sftp_client, full_remote_dir)
                    except Exception as e:
                        self.logger.warning(f"No se pudo crear el directorio remoto {full_remote_dir}: {str(e)}")
                        self.logger.message("Intentando subir archivo directamente en el directorio actual...")
                
                # Subir el archivo
                self.logger.message(f"Subiendo archivo a sftp://{host}:{port}/{remote_path}...")
                sftp_client.put(temp_file_path, remote_path)
                self.logger.message(f"Archivo materializado en sftp://{host}:{port}/{remote_path}")
                
            except Exception as e:
                self.logger.error(f"Error al conectar o subir archivo a SFTP: {str(e)}")
                raise
            
            finally:
                # Cerrar la conexión
                if 'sftp_client' in locals():
                    sftp_client.close()
                if 'ssh_client' in locals():
                    ssh_client.close()
    
    def _sftp_mkdir_p(self, sftp, remote_directory):
        """Crear directorio remoto recursivamente (mkdir -p)"""
        if remote_directory == '/':
            # Directorio raíz
            return
        
        if remote_directory == '':
            # Directorio vacío
            return
        
        try:
            sftp.stat(remote_directory)
        except IOError:
            # El directorio no existe, crearlo
            parent = os.path.dirname(remote_directory)
            if parent:
                self._sftp_mkdir_p(sftp, parent)
            
            try:
                sftp.mkdir(remote_directory)
            except IOError as e:
                if 'Failure' in str(e):
                    # Puede ser que el directorio ya exista (debido a una condición de carrera)
                    pass
                else:
                    raise
                
    def _materialize_to_gcp(self, df: pd.DataFrame, provider_info: Dict[str, Any], 
                          destination_path: str, file_format: str, 
                          partition_columns: List[str], config: Dict[str, Any] = None) -> None:
        """
        Materializa el DataFrame a Google Cloud Storage.
        
        Args:
            df: DataFrame preparado
            provider_info: Información del proveedor
            destination_path: Ruta de destino
            file_format: Formato del archivo
            partition_columns: Columnas para particionar los datos
        """
        # Parsear credenciales y configuración
        config = provider_info['configuracion'] if isinstance(provider_info['configuracion'], dict) else json.loads(provider_info['configuracion']) if 'configuracion' in provider_info else {}
        credentials = provider_info['credenciales'] if isinstance(provider_info['credenciales'], dict) else json.loads(provider_info['credenciales']) if 'credenciales' in provider_info else {}
        
        # Buscar el bucket en diferentes variantes de nombre (bucket, bucket_name)
        bucket_name = credentials.get('bucket_name') or credentials.get('bucket') or config.get('bucket_name') or config.get('bucket')
        if not bucket_name:
            raise ValueError(f"No se ha configurado un bucket para el proveedor GCP {provider_info['nombre']}")
        
        # Crear cliente GCP
        if isinstance(credentials, dict):
            # Las credenciales para GCP tienen que tener un key_file, que es el JSON del service account
            if 'key_file' in credentials:
                key_info = credentials['key_file']
                # Si key_file es un diccionario, usarlo directamente
                if isinstance(key_info, dict):
                    self.logger.message(f"Usando key_file en formato diccionario para GCP")
                    credentials_obj = service_account.Credentials.from_service_account_info(key_info)
                # Si key_file es un string, puede ser un JSON o una ruta
                elif isinstance(key_info, str):
                    try:
                        # Intentar leer como JSON
                        key_dict = json.loads(key_info)
                        self.logger.message(f"Convertido key_file desde string JSON para GCP")
                        credentials_obj = service_account.Credentials.from_service_account_info(key_dict)
                    except json.JSONDecodeError:
                        # Si no es JSON, asumir que es una ruta a un archivo
                        self.logger.message(f"Usando key_file como ruta a archivo de credenciales para GCP")
                        credentials_obj = service_account.Credentials.from_service_account_file(key_info)
                else:
                    raise ValueError(f"Formato de key_file no soportado para GCP: {type(key_info)}")
            else:
                raise ValueError("No se encontró 'key_file' en las credenciales para GCP")
                
            storage_client = GCPStorageClient(credentials=credentials_obj)
        else:
            # Si es un string, asumimos que es un path a un archivo de credenciales
            self.logger.message(f"Usando credenciales como ruta a archivo para GCP")
            storage_client = GCPStorageClient.from_service_account_json(credentials)
        
        bucket = storage_client.bucket(bucket_name)
        
        # Procesar según formato
        buffer = io.BytesIO()
        # Inicializar con un valor por defecto
        content_type = 'application/octet-stream'
        file_ext = '.bin'
        
        if file_format == 'parquet':
            df.to_parquet(buffer, engine='pyarrow', index=False)
            content_type = 'application/octet-stream'
            file_ext = '.parquet'
        elif file_format == 'csv':
            df.to_csv(buffer, index=False)
            content_type = 'text/csv'
            file_ext = '.csv'
        elif file_format == 'excel':
            df.to_excel(buffer, index=False, engine='openpyxl')
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            file_ext = '.xlsx'
        elif file_format == 'json':
            df.to_json(buffer, orient='records', lines=True)
            content_type = 'application/json'
            file_ext = '.json'
        elif file_format in ['avro', 'orc', 'hudi', 'iceberg']:
            # Para formatos avanzados, necesitamos implementación específica
            raise NotImplementedError(f"Formato {file_format} aún no implementado para GCP")
        else:
            raise ValueError(f"Formato de archivo no soportado: {file_format}")
        
        # Mover el cursor al inicio del buffer
        buffer.seek(0)
        
        # Subir a GCP
        destination_key = destination_path.lstrip('/')
        if not destination_key.endswith(file_ext):
            destination_key += file_ext
            
        blob = bucket.blob(destination_key)
        blob.upload_from_file(buffer, content_type=content_type)
        
        self.logger.message(f"Archivo materializado en gs://{bucket_name}/{destination_key}")
    
    def _get_db_connection_info(self, db_conn_id: int) -> Dict[str, Any]:
        """
        Obtiene la información de conexión a una base de datos.
        
        Args:
            db_conn_id: ID de la conexión
            
        Returns:
            Información de la conexión
        """
        conn = self._get_database_connection()
        cursor = conn.cursor()
        
        try:
            # Consultar los secretos de la base de datos
            cursor.execute("""
                SELECT ds.id, ds.nombre, ds.descripcion, ds.tipo, ds.servidor, 
                       ds.puerto, ds.usuario, ds.contrasena, ds.basedatos, ds.estado,
                       ds.opciones_conexion
                FROM db_secrets ds
                JOIN database_connections dc ON ds.id = dc.secret_id
                WHERE dc.id = %s
            """, (db_conn_id,))
            
            row = cursor.fetchone()
            if not row:
                self.logger.error(f"No se encontró la conexión a base de datos con ID {db_conn_id}")
                return {}
                
            columns = [desc[0] for desc in cursor.description]
            result = dict(zip(columns, row))
            
            # Si hay opciones de conexión en formato JSON, convertirlas a diccionario
            if 'opciones_conexion' in result and result['opciones_conexion']:
                # Verificar si son un string o un dict
                if isinstance(result['opciones_conexion'], str):
                    try:
                        result['opciones_conexion'] = json.loads(result['opciones_conexion'])
                    except json.JSONDecodeError:
                        self.logger.error(f"Error decodificando opciones_conexion de la base de datos {db_conn_id}")
                
                # Procesar opciones específicas según el tipo de base de datos
                if result['tipo'] == 'duckdb':
                    # Para DuckDB, las opciones pueden incluir configuraciones adicionales
                    # como rutas de almacenamiento externas, opciones de extensiones, etc.
                    self.logger.message(f"Procesando opciones de conexión para DuckDB: {result['opciones_conexion']}")
                    
                    # Si hay ruta de archivo específica, actualizar el campo servidor
                    opciones = result['opciones_conexion']
                    if isinstance(opciones, dict) and 'file_path' in opciones:
                        result['servidor'] = opciones['file_path']
                        self.logger.message(f"Usando ruta de archivo personalizada para DuckDB: {result['servidor']}")
            
            self.logger.message(f"Información de conexión obtenida para la base de datos (tipo: {result.get('tipo')})")
            return result
        finally:
            cursor.close()
    
    def _get_cloud_provider_info(self, provider_id: int) -> Dict[str, Any]:
        """
        Obtiene la información de un proveedor cloud.
        
        Args:
            provider_id: ID del proveedor
            
        Returns:
            Información del proveedor
        """
        conn = self._get_database_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT id, nombre, tipo, credenciales, configuracion, activo, estado, secreto_id
                FROM cloud_providers
                WHERE id = %s AND activo = true
            """, (provider_id,))
            
            row = cursor.fetchone()
            if not row:
                self.logger.error(f"No se encontró el proveedor cloud con ID {provider_id}")
                return {}
                
            columns = [desc[0] for desc in cursor.description]
            provider_dict = dict(zip(columns, row))
            
            # Convertir credenciales y configuración de JSON a dict si son strings
            if 'credenciales' in provider_dict and isinstance(provider_dict['credenciales'], str):
                try:
                    provider_dict['credenciales'] = json.loads(provider_dict['credenciales'])
                except json.JSONDecodeError:
                    self.logger.error(f"Error decodificando credenciales del proveedor {provider_id}")
            
            if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], str):
                try:
                    provider_dict['configuracion'] = json.loads(provider_dict['configuracion'])
                except json.JSONDecodeError:
                    self.logger.error(f"Error decodificando configuración del proveedor {provider_id}")
            elif 'configuracion' not in provider_dict or provider_dict['configuracion'] is None:
                provider_dict['configuracion'] = {}
            
            # ADAPTADO DE JANITOR_DAEMON: Verificar si este proveedor usa secreto_id
            provider_name = provider_dict.get('nombre', f"ID:{provider_id}")
            if 'secreto_id' in provider_dict and provider_dict['secreto_id'] is not None:
                secreto_id = provider_dict['secreto_id']
                self.logger.message(f"El proveedor {provider_id} - {provider_name} usa secreto_id: {secreto_id}")
                
                try:
                    # Obtener el secreto correspondiente
                    cursor.execute(
                        "SELECT id, nombre, tipo, secretos FROM cloud_secrets WHERE id = %s AND activo = TRUE",
                        (secreto_id,)
                    )
                    secret_result = cursor.fetchone()
                    
                    if not secret_result:
                        self.logger.error(f"No se encontró el secreto activo con ID {secreto_id} para el proveedor {provider_name}")
                        # Si no hay secreto, intentar usar las credenciales directas (si existen)
                        if not provider_dict.get('credenciales'):
                            provider_dict['credenciales'] = {}
                        return provider_dict
                        
                    # Convertir a diccionario
                    secret_dict = dict(zip(
                        ['id', 'nombre', 'tipo', 'secretos'], 
                        secret_result
                    ))
                    
                    # Si el secreto está en formato string JSON, convertirlo a dict
                    if isinstance(secret_dict['secretos'], str):
                        try:
                            secret_dict['secretos'] = json.loads(secret_dict['secretos'])
                        except json.JSONDecodeError:
                            self.logger.error(f"No se pudo parsear el secreto del proveedor {provider_name}")
                            # Si hay error con el secreto, intentar usar las credenciales directas
                            return provider_dict
                    
                    # Verificar que los tipos coincidan
                    if secret_dict['tipo'] != provider_dict['tipo']:
                        self.logger.warning(
                            f"El tipo del secreto ({secret_dict['tipo']}) no coincide con el tipo del proveedor ({provider_dict['tipo']})"
                        )
                        
                    # Reemplazar las credenciales del proveedor con las del secreto
                    self.logger.message(f"Reemplazando credenciales del proveedor {provider_name} con las del secreto {secret_dict['nombre']}")
                    credentials = secret_dict['secretos']
                    
                    # Normalizar las credenciales según el tipo de proveedor
                    if provider_dict['tipo'] == 's3' or provider_dict['tipo'] == 'minio':
                        # Asegurar formato uniforme para S3/MinIO
                        normalized_credentials = {
                            **credentials,
                            'access_key': credentials.get('access_key') or credentials.get('accessKey'),
                            'secret_key': credentials.get('secret_key') or credentials.get('secretKey')
                        }
                        # Eliminar campos no reconocidos por boto3
                        if 'aws_account_id' in normalized_credentials:
                            self.logger.message(f"Eliminando campo 'aws_account_id' no compatible con boto3")
                            normalized_credentials.pop('aws_account_id', None)
                        
                        # SOLUCIÓN: Para MinIO, transferir el bucket desde la configuración a las credenciales
                        if provider_dict['tipo'] == 'minio':
                            # Obtener el bucket desde la configuración
                            if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], dict):
                                bucket_from_config = provider_dict['configuracion'].get('bucket')
                                if bucket_from_config:
                                    self.logger.message(f"Transferido bucket '{bucket_from_config}' desde configuración a credenciales para MinIO con secreto")
                                    normalized_credentials['bucket'] = bucket_from_config
                            else:
                                self.logger.warning(f"Proveedor MinIO con secreto sin configuración para obtener bucket")
                        
                        provider_dict['credenciales'] = normalized_credentials
                    elif provider_dict['tipo'] == 'azure':
                        # SOLUCIÓN: Para Azure, transferir el container_name desde la configuración a las credenciales
                        if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], dict):
                            # Buscar todas las posibles nomenclaturas para el contenedor en Azure
                            container_from_config = (
                                provider_dict['configuracion'].get('container_name') or 
                                provider_dict['configuracion'].get('bucket') or
                                provider_dict['configuracion'].get('container') or
                                provider_dict['configuracion'].get('blob_container')
                            )
                            if container_from_config:
                                self.logger.message(f"Transferido container '{container_from_config}' desde configuración a credenciales para Azure con secreto")
                                credentials['container_name'] = container_from_config
                                # También guardar como 'bucket' por compatibilidad
                                if 'bucket' not in credentials:
                                    credentials['bucket'] = container_from_config
                        provider_dict['credenciales'] = credentials
                    elif provider_dict['tipo'] == 'gcp':
                        # Para GCP, asegurar que key_file sea un diccionario
                        if 'key_file' in credentials and isinstance(credentials['key_file'], str):
                            try:
                                credentials['key_file'] = json.loads(credentials['key_file'])
                                self.logger.message(f"Convertido key_file de formato string a diccionario para GCP")
                            except json.JSONDecodeError:
                                self.logger.warning(f"No se pudo convertir key_file a diccionario para GCP, manteniendo formato original")
                        
                        # SOLUCIÓN: Transferir el bucket_name desde la configuración a las credenciales
                        if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], dict):
                            bucket_from_config = provider_dict['configuracion'].get('bucket_name') or provider_dict['configuracion'].get('bucket')
                            if bucket_from_config:
                                self.logger.message(f"Transferido bucket '{bucket_from_config}' desde configuración a credenciales para GCP con secreto")
                                credentials['bucket_name'] = bucket_from_config
                        provider_dict['credenciales'] = credentials
                    else:
                        # Para otros tipos, usar tal cual
                        provider_dict['credenciales'] = credentials
                    
                    # Añadir información de que se usó un secreto
                    provider_dict['usa_secreto'] = True
                    provider_dict['secreto_nombre'] = secret_dict['nombre']
                    
                except Exception as e:
                    self.logger.error(f"Error cargando secreto para proveedor {provider_name}: {str(e)}")
            else:
                # El proveedor NO usa secreto, continúa con el flujo normal
                self.logger.message(f"El proveedor {provider_id} - {provider_name} usa credenciales directas")
                
            return provider_dict
        finally:
            cursor.close()
    
    def _build_db_connection_string(self, db_info: Dict[str, Any]) -> str:
        """
        Construye un connection string para una base de datos.
        
        Args:
            db_info: Información de la conexión
            
        Returns:
            Connection string
        """
        if db_info['tipo'] == 'postgresql':
            return f"postgresql://{db_info['usuario']}:{db_info['contrasena']}@{db_info['servidor']}:{db_info['puerto']}/{db_info['basedatos']}"
        elif db_info['tipo'] == 'mysql':
            return f"mysql+pymysql://{db_info['usuario']}:{db_info['contrasena']}@{db_info['servidor']}:{db_info['puerto']}/{db_info['basedatos']}"
        elif db_info['tipo'] == 'mssql':
            return f"mssql+pyodbc://{db_info['usuario']}:{db_info['contrasena']}@{db_info['servidor']}:{db_info['puerto']}/{db_info['basedatos']}?driver=ODBC+Driver+17+for+SQL+Server"
        elif db_info['tipo'] == 'duckdb':
            # Para DuckDB el campo servidor contiene la ruta al archivo
            base_conn_string = ""
            if db_info['servidor'] == ':memory:':
                base_conn_string = "duckdb:///:memory:"
            else:
                base_conn_string = f"duckdb:///{db_info['servidor']}"
            
            # Verificar si hay opciones adicionales de conexión
            if 'opciones_conexion' in db_info and isinstance(db_info['opciones_conexion'], dict):
                opts = db_info['opciones_conexion']
                query_params = []
                
                # Valores booleanos
                for bool_opt in ['access_mode', 'read_only', 'allow_unsigned_extensions']:
                    if bool_opt in opts:
                        query_params.append(f"{bool_opt}={str(opts[bool_opt]).lower()}")
                
                # Tamaño de buffer de página
                if 'page_size' in opts:
                    query_params.append(f"page_size={opts['page_size']}")
                
                # Extensiones a cargar
                if 'extensions' in opts and isinstance(opts['extensions'], list):
                    extensions = ','.join(opts['extensions'])
                    query_params.append(f"extensions={extensions}")
                
                # Si hay opciones, agregarlas al connection string
                if query_params:
                    base_conn_string += "?" + "&".join(query_params)
                    self.logger.message(f"Añadiendo opciones de conexión a DuckDB: {query_params}")
            
            return base_conn_string
        else:
            raise ValueError(f"Tipo de base de datos no soportado: {db_info['tipo']}")
    
    def _get_s3_client(self, provider_info: Dict[str, Any]) -> Any:
        """
        Obtiene un cliente S3 o compatible.
        
        Args:
            provider_info: Información del proveedor
            
        Returns:
            Cliente S3
        """
        provider_id = provider_info['id']
        
        # Verificar si ya tenemos un cliente para este proveedor
        if provider_id in self.cloud_clients:
            return self.cloud_clients[provider_id]
        
        # Parsear credenciales y configuración
        config = provider_info['configuracion'] if isinstance(provider_info['configuracion'], dict) else json.loads(provider_info['configuracion']) if 'configuracion' in provider_info else {}
        credentials = provider_info['credenciales'] if isinstance(provider_info['credenciales'], dict) else json.loads(provider_info['credenciales']) if 'credenciales' in provider_info else {}
        
        # Logs para depuración
        self.logger.message(f"Credenciales S3: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
        self.logger.message(f"Configuración S3: {list(config.keys()) if config else 'No hay configuración'}")
        
        # Obtener solo los parámetros necesarios para S3
        endpoint_url = credentials.get('endpoint_url') or credentials.get('endpoint')
        access_key = credentials.get('access_key') or credentials.get('accessKey')
        secret_key = credentials.get('secret_key') or credentials.get('secretKey')
        region = credentials.get('region', 'us-east-1')  # Valor predeterminado como en el JavaScript
        
        # Logs específicos para S3
        self.logger.message(f"Usando endpoint S3: {endpoint_url or 'Default S3'}")
        self.logger.message(f"Usando región S3: {region}")
        self.logger.message(f"Credenciales procesadas: access_key={access_key}, region={region}")
        
        # Bucket puede estar en credenciales o en configuración
        bucket = credentials.get('bucket') or config.get('bucket')
        self.logger.message(f"Bucket a usar: {bucket}")
        
        if not bucket:
            raise ValueError("No se pudo determinar el bucket desde las credenciales o configuración")
        
        # Configurar el cliente S3
        s3_kwargs = {
            'aws_access_key_id': access_key,
            'aws_secret_access_key': secret_key,
            'region_name': region
        }
        
        # Si hay un endpoint_url, agregarlo a los kwargs
        if endpoint_url:
            s3_kwargs['endpoint_url'] = endpoint_url
            
            # Para endpoints personalizados, usar path-style URLs
            s3_kwargs['config'] = boto3.session.Config(
                signature_version='s3v4',
                s3={'addressing_style': 'path'}
            )
        
        # Crear el cliente
        try:
            if provider_info['tipo'] == 'minio':
                self.logger.message(f"Creando cliente MinIO para endpoint {endpoint_url}")
            else:
                self.logger.message(f"Creando cliente S3 para la región {region}")
                
            s3_client = boto3.client('s3', **s3_kwargs)
            
            # Guardar el cliente en caché
            self.cloud_clients[provider_id] = s3_client
            
            return s3_client
        except Exception as e:
            raise ValueError(f"Error al crear cliente S3: {str(e)}")
    
    def _map_pandas_type_to_hudi(self, pandas_dtype):
        """
        Convierte un tipo de dato de pandas a un tipo compatible con Apache Hudi
        
        Args:
            pandas_dtype: Tipo de dato de pandas
            
        Returns:
            String con el tipo de dato para Hudi
        """
        dtype_str = str(pandas_dtype)
        
        if 'int' in dtype_str:
            return 'long'
        elif 'float' in dtype_str:
            return 'double'
        elif 'bool' in dtype_str:
            return 'boolean'
        elif 'datetime' in dtype_str:
            return 'timestamp'
        elif 'timedelta' in dtype_str:
            return 'string'  # No hay soporte directo en Hudi
        elif 'object' in dtype_str or 'string' in dtype_str:
            return 'string'
        else:
            # Tipo desconocido, usar string por defecto
            self.logger.warning(f"Tipo de dato desconocido {dtype_str}, se usará 'string' por defecto")
            return 'string'
    
    def _map_pandas_type_to_iceberg(self, pandas_dtype):
        """
        Convierte un tipo de dato de pandas a un tipo compatible con Apache Iceberg
        
        Args:
            pandas_dtype: Tipo de dato de pandas
            
        Returns:
            String con el tipo de dato para Iceberg
        """
        dtype_str = str(pandas_dtype)
        
        if 'int8' in dtype_str or 'int16' in dtype_str:
            return 'int'
        elif 'int32' in dtype_str or 'int' in dtype_str:
            return 'int'
        elif 'int64' in dtype_str:
            return 'long'
        elif 'float32' in dtype_str or 'float' in dtype_str:
            return 'float'
        elif 'float64' in dtype_str:
            return 'double'
        elif 'bool' in dtype_str:
            return 'boolean'
        elif 'datetime' in dtype_str:
            return 'timestamp'
        elif 'timedelta' in dtype_str:
            return 'string'  # No hay soporte directo en Iceberg
        elif 'object' in dtype_str or 'string' in dtype_str:
            return 'string'
        else:
            # Tipo desconocido, usar string por defecto
            self.logger.warning(f"Tipo de dato desconocido {dtype_str}, se usará 'string' por defecto")
            return 'string'
    
    def _register_materialization_execution(self, materialization_id: int, execution_id: str, 
                                           status: str, message: str, records_count: int = None) -> None:
        """
        Registra la ejecución de una materialización.
        
        Args:
            materialization_id: ID de la materialización
            execution_id: ID de la ejecución SAGE
            status: Estado de la materialización (pendiente, completado, error)
            message: Mensaje descriptivo
            records_count: Número de registros procesados (opcional)
        """
        conn = self._get_database_connection()
        cursor = conn.cursor()
        
        try:
            # Incluir registros_procesados si se proporciona
            if records_count is not None:
                cursor.execute("""
                    INSERT INTO materializaciones_ejecuciones
                    (materialization_id, execution_id, estado, mensaje, fecha_creacion, fecha_fin, registros_procesados)
                    VALUES (%s, %s, %s, %s, NOW(), NOW(), %s)
                """, (materialization_id, execution_id, status, message, records_count))
            else:
                cursor.execute("""
                    INSERT INTO materializaciones_ejecuciones
                    (materialization_id, execution_id, estado, mensaje, fecha_creacion, fecha_fin)
                    VALUES (%s, %s, %s, %s, NOW(), NOW())
                """, (materialization_id, execution_id, status, message))
            
            # Actualizar la última materialización en la tabla materializaciones
            cursor.execute("""
                UPDATE materializaciones
                SET ultima_materializacion = NOW()
                WHERE id = %s
            """, (materialization_id,))
            
            conn.commit()
            self.logger.message(f"Registrada ejecución de materialización {materialization_id}: {status}")
        except Exception as e:
            conn.rollback()
            self.logger.error(f"Error al registrar ejecución de materialización: {str(e)}")
        finally:
            cursor.close()


def process_materializations(casilla_id: Optional[int], execution_id: str, dataframe: pd.DataFrame, logger: SageLogger) -> None:
    """
    Función principal para procesar las materializaciones de una casilla.
    
    Args:
        casilla_id: ID de la casilla (puede ser None)
        execution_id: ID de la ejecución
        dataframe: DataFrame resultante del procesamiento
        logger: Logger SAGE
    """
    if casilla_id is None:
        logger.message("No se puede procesar materializaciones sin ID de casilla")
        return
        
    processor = MaterializationProcessor(logger)
    processor.process(casilla_id, execution_id, dataframe)
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
from typing import Optional, Dict, List, Any, Tuple, Union
from urllib.parse import urlparse
from azure.storage.blob import BlobServiceClient
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
                SELECT id, nombre, descripcion, config, metadata,
                       fecha_creacion, fecha_modificacion, estado, casilla_id
                FROM materializaciones
                WHERE casilla_id = %s AND estado = 'activo'
            """, (casilla_id,))
            
            columns = [desc[0] for desc in cursor.description]
            result = []
            
            for row in cursor.fetchall():
                row_dict = dict(zip(columns, row))
                
                # Deserializar los campos JSON
                if 'config' in row_dict and row_dict['config']:
                    try:
                        if isinstance(row_dict['config'], str):
                            row_dict['config'] = json.loads(row_dict['config'])
                    except json.JSONDecodeError:
                        self.logger.warning(f"No se pudo deserializar el campo config para la materialización {row_dict['id']}")
                        
                if 'metadata' in row_dict and row_dict['metadata']:
                    try:
                        if isinstance(row_dict['metadata'], str):
                            row_dict['metadata'] = json.loads(row_dict['metadata'])
                    except json.JSONDecodeError:
                        self.logger.warning(f"No se pudo deserializar el campo metadata para la materialización {row_dict['id']}")
                
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
                
            # Obtener tipo de destino (db o cloud)
            destination_type = config.get('destination_type')
            if not destination_type:
                raise ValueError("No se ha especificado el tipo de destino")
                
            # Obtener ID del destino
            destination_id = config.get('destination_id')
            if not destination_id:
                raise ValueError("No se ha especificado el ID del destino")
                
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
        column_mapping = config.get('column_mapping', {})
        if column_mapping:
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
        table_name = config.get('table_name')
        if not table_name:
            raise ValueError("No se ha especificado el nombre de la tabla")
            
        schema_name = config.get('schema_name', 'public')
        operation = config.get('operation', 'append')
        
        # Conectar a la base de datos de destino
        target_conn = None
        try:
            # Construir el connection string según el tipo de base de datos
            conn_string = self._build_db_connection_string(db_connection_info)
            
            # Conectar usando el driver adecuado según el tipo de base de datos
            if db_connection_info['tipo'] == 'postgresql':
                target_conn = psycopg2.connect(conn_string)
            
            # Usar SQLAlchemy para la materialización
            import sqlalchemy
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
                pk_columns = config.get('primary_key', [])
                if not pk_columns:
                    raise ValueError("Para operación upsert se requiere especificar primary_key")
                
                # Implementación de upsert dependiente del tipo de base de datos
                if db_connection_info['tipo'] == 'postgresql':
                    self._postgres_upsert(engine, df, table_name, schema_name, pk_columns)
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
        file_format = config.get('file_format', 'parquet')
        if file_format not in SUPPORTED_FORMATS:
            raise ValueError(f"Formato de archivo no soportado: {file_format}")
            
        destination_path = config.get('destination_path')
        if not destination_path:
            raise ValueError("No se ha especificado la ruta de destino")
            
        # Asegurar que la ruta comienza con /
        if not destination_path.startswith('/'):
            destination_path = '/' + destination_path
            
        # Crear cliente según el tipo de proveedor
        provider_type = provider_info['tipo']
        
        # Verificar la partición si está configurada
        partition_columns = config.get('partition_columns', [])
        
        try:
            if provider_type == 's3' or provider_type == 'minio':
                self._materialize_to_s3_compatible(df, provider_info, destination_path, file_format, partition_columns)
            elif provider_type == 'azure':
                self._materialize_to_azure(df, provider_info, destination_path, file_format, partition_columns)
            elif provider_type == 'gcp':
                self._materialize_to_gcp(df, provider_info, destination_path, file_format, partition_columns)
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
                                    partition_columns: List[str]) -> None:
        """
        Materializa el DataFrame a un bucket S3 o compatible (ej: MinIO).
        
        Args:
            df: DataFrame preparado
            provider_info: Información del proveedor
            destination_path: Ruta de destino
            file_format: Formato del archivo
            partition_columns: Columnas para particionar los datos
        """
        # Extraer credenciales
        credentials = json.loads(provider_info['credenciales']) if isinstance(provider_info['credenciales'], str) else provider_info['credenciales']
        bucket_name = provider_info['bucket']
        
        # Crear cliente S3
        s3_client = self._get_s3_client(provider_info)
        
        # Procesar según formato
        buffer = io.BytesIO()
        
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
                
                elif file_format == 'hudi' or file_format == 'iceberg':
                    # Para Hudi e Iceberg necesitamos usar Spark o bibliotecas específicas
                    # Por ahora, guardamos como parquet pero debemos implementar la conversión adecuada
                    temp_file = os.path.join(temp_dir, "data.parquet")
                    df.to_parquet(temp_file, engine='pyarrow', index=False)
                
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
                            partition_columns: List[str]) -> None:
        """
        Materializa el DataFrame a Azure Blob Storage.
        
        Args:
            df: DataFrame preparado
            provider_info: Información del proveedor
            destination_path: Ruta de destino
            file_format: Formato del archivo
            partition_columns: Columnas para particionar los datos
        """
        # Extraer credenciales
        credentials = json.loads(provider_info['credenciales']) if isinstance(provider_info['credenciales'], str) else provider_info['credenciales']
        container_name = provider_info['bucket']
        
        # Preparar el cliente de Azure
        connection_string = credentials.get('connection_string')
        if not connection_string:
            account_name = credentials.get('account_name')
            account_key = credentials.get('account_key')
            if not (account_name and account_key):
                raise ValueError("Se requiere connection_string o account_name + account_key para Azure")
            connection_string = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={account_key};EndpointSuffix=core.windows.net"
        
        # Crear cliente Azure
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_client = blob_service_client.get_container_client(container_name)
        
        # Procesar según formato
        buffer = io.BytesIO()
        
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
        blob_client.upload_blob(buffer, overwrite=True, content_settings={"content_type": content_type})
        
        self.logger.message(f"Archivo materializado en azure://{container_name}/{destination_key}")
    
    def _materialize_to_gcp(self, df: pd.DataFrame, provider_info: Dict[str, Any], 
                          destination_path: str, file_format: str, 
                          partition_columns: List[str]) -> None:
        """
        Materializa el DataFrame a Google Cloud Storage.
        
        Args:
            df: DataFrame preparado
            provider_info: Información del proveedor
            destination_path: Ruta de destino
            file_format: Formato del archivo
            partition_columns: Columnas para particionar los datos
        """
        # Extraer credenciales
        credentials = json.loads(provider_info['credenciales']) if isinstance(provider_info['credenciales'], str) else provider_info['credenciales']
        bucket_name = provider_info['bucket']
        
        # Crear cliente GCP
        if isinstance(credentials, dict):
            # Si las credenciales son un diccionario de service account
            credentials_obj = service_account.Credentials.from_service_account_info(credentials)
            storage_client = GCPStorageClient(credentials=credentials_obj)
        else:
            # Si es un string, asumimos que es un path a un archivo de credenciales
            storage_client = GCPStorageClient.from_service_account_json(credentials)
        
        bucket = storage_client.bucket(bucket_name)
        
        # Procesar según formato
        buffer = io.BytesIO()
        
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
                       ds.puerto, ds.usuario, ds.contrasena, ds.basedatos, ds.estado
                FROM db_secrets ds
                JOIN database_connections dc ON ds.id = dc.db_secret_id
                WHERE dc.id = %s
            """, (db_conn_id,))
            
            row = cursor.fetchone()
            if not row:
                return None
                
            columns = [desc[0] for desc in cursor.description]
            result = dict(zip(columns, row))
            
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
                SELECT id, nombre, tipo, credenciales, bucket, region, endpoint, 
                       puerto, path_style, estado
                FROM cloud_providers
                WHERE id = %s
            """, (provider_id,))
            
            row = cursor.fetchone()
            if not row:
                return None
                
            columns = [desc[0] for desc in cursor.description]
            result = dict(zip(columns, row))
            
            return result
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
            if db_info['servidor'] == ':memory:':
                return "duckdb:///:memory:"
            else:
                return f"duckdb:///{db_info['servidor']}"
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
        
        # Extraer credenciales
        credentials = json.loads(provider_info['credenciales']) if isinstance(provider_info['credenciales'], str) else provider_info['credenciales']
        
        # Configurar cliente según el tipo de proveedor
        if provider_info['tipo'] == 's3':
            # AWS S3
            session = boto3.Session(
                aws_access_key_id=credentials.get('access_key'),
                aws_secret_access_key=credentials.get('secret_key'),
                region_name=provider_info.get('region')
            )
            s3_client = session.client('s3')
            
        elif provider_info['tipo'] == 'minio':
            # MinIO o S3 compatible
            endpoint_url = provider_info.get('endpoint')
            if not endpoint_url:
                raise ValueError("Se requiere endpoint_url para MinIO")
                
            if provider_info.get('puerto'):
                if not endpoint_url.startswith('http'):
                    endpoint_url = f"http{'s' if endpoint_url.startswith('https') else ''}://{endpoint_url}"
                endpoint_url = f"{endpoint_url}:{provider_info['puerto']}"
                
            s3_client = boto3.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=credentials.get('access_key'),
                aws_secret_access_key=credentials.get('secret_key'),
                region_name=provider_info.get('region', 'us-east-1'),
                config=boto3.session.Config(signature_version='s3v4'),
                verify=False  # Desactivar verificación SSL para MinIO local
            )
        else:
            raise ValueError(f"Tipo de proveedor no soportado para cliente S3: {provider_info['tipo']}")
            
        # Guardar el cliente en la caché
        self.cloud_clients[provider_id] = s3_client
        
        return s3_client
    
    def _register_materialization_execution(self, materialization_id: int, execution_id: str, 
                                           status: str, message: str) -> None:
        """
        Registra la ejecución de una materialización.
        
        Args:
            materialization_id: ID de la materialización
            execution_id: ID de la ejecución SAGE
            status: Estado de la materialización (pendiente, completado, error)
            message: Mensaje descriptivo
        """
        conn = self._get_database_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO materializaciones_ejecuciones
                (materialization_id, execution_id, estado, mensaje, fecha_creacion)
                VALUES (%s, %s, %s, %s, NOW())
            """, (materialization_id, execution_id, status, message))
            
            conn.commit()
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
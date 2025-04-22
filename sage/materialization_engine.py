"""
Motor de Materialización para SAGE

Este módulo implementa el motor de materialización que permite convertir
datos procesados por SAGE en estructuras optimizadas para consulta.
"""

import os
import logging
import json
import tempfile
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime

try:
    import pandas as pd
    from .exporters import DataLakeExporter
except ImportError:
    logging.warning("Algunas dependencias para materialization_engine no están instaladas")

logger = logging.getLogger(__name__)

class MaterializationEngine:
    """
    Motor principal para la materialización de datos

    Este motor se encarga de:
    1. Analizar los datos de entrada
    2. Determinar la estructura de las tablas
    3. Aplicar estrategias de actualización
    4. Materializar los datos en destinos configurados
    """

    def __init__(self, db_connection=None, config: Optional[Dict[str, Any]] = None):
        """
        Inicializa el motor de materialización

        Args:
            db_connection: Conexión a la base de datos para operaciones
            config: Configuración opcional del motor
        """
        self.db_connection = db_connection
        self.config = config or {}
        self.data_lake_exporter = DataLakeExporter(config=self.config.get('data_lake', {}))
        self.temp_dir = self.config.get('temp_dir') or tempfile.mkdtemp(prefix='sage_materialization_')

    def analyze_execution_data(self, execution_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analiza datos de ejecución y determina estructura de tablas

        Args:
            execution_data: Datos de ejecución a analizar

        Returns:
            Diccionario con metadatos y estructura de tablas
        """
        try:
            # Extraer archivos y datos
            files = {}
            metadata = {
                'execution_id': execution_data.get('id'),
                'name': execution_data.get('name'),
                'source': execution_data.get('source'),
                'timestamp': datetime.now().isoformat()
            }

            # Procesar los archivos según el formato
            if isinstance(execution_data, dict) and 'files' in execution_data:
                for file_name, file_data in execution_data['files'].items():
                    # Procesar DataFrame si está disponible
                    if isinstance(file_data, pd.DataFrame):
                        df = file_data
                    elif isinstance(file_data, dict) and 'data' in file_data:
                        if isinstance(file_data['data'], pd.DataFrame):
                            df = file_data['data']
                        else:
                            try:
                                df = pd.DataFrame(file_data['data'])
                            except Exception as e:
                                logger.warning(f"No se pudo convertir {file_name} a DataFrame: {str(e)}")
                                continue
                    else:
                        continue

                    # Analizar la estructura
                    files[file_name] = self._analyze_dataframe_structure(df, file_name)

            # Si no tiene el formato esperado
            else:
                raise ValueError("Formato de datos de ejecución no soportado")

            if not files:
                raise ValueError("No se encontraron archivos válidos para analizar")

            return {
                'metadata': metadata,
                'files': files
            }

        except Exception as e:
            logger.error(f"Error al analizar datos de ejecución: {str(e)}")
            raise

    def _analyze_dataframe_structure(self, df: "pd.DataFrame", file_name: str) -> Dict[str, Any]:
        """
        Analiza la estructura de un DataFrame

        Args:
            df: DataFrame a analizar
            file_name: Nombre del archivo o fuente

        Returns:
            Diccionario con metadatos y estructura
        """
        # Obtener información de esquema
        schema = {}
        for col_name, dtype in df.dtypes.items():
            if pd.api.types.is_integer_dtype(dtype):
                col_type = 'integer'
            elif pd.api.types.is_float_dtype(dtype):
                col_type = 'float'
            elif pd.api.types.is_bool_dtype(dtype):
                col_type = 'boolean'
            elif pd.api.types.is_datetime64_any_dtype(dtype):
                col_type = 'datetime'
            elif pd.api.types.is_string_dtype(dtype) or dtype == 'object':
                col_type = 'string'
            else:
                col_type = 'string'  # Tipo por defecto

            schema[col_name] = {
                'type': col_type,
                'nullable': df[col_name].isna().any(),
                'stats': {
                    'min': str(df[col_name].min()) if not pd.isna(df[col_name].min()) else None,
                    'max': str(df[col_name].max()) if not pd.isna(df[col_name].max()) else None,
                    'unique_count': int(df[col_name].nunique()) if not pd.isna(df[col_name].nunique()) else 0,
                    'null_count': int(df[col_name].isna().sum()) if not pd.isna(df[col_name].isna().sum()) else 0
                }
            }

        # Inferir posible clave primaria
        primary_key_candidates = []
        for col_name, col_info in schema.items():
            if not col_info['nullable'] and col_info['stats']['unique_count'] == len(df):
                primary_key_candidates.append(col_name)

        # Determinar candidatos a partición
        partition_candidates = []
        for col_name, col_info in schema.items():
            unique_ratio = col_info['stats']['unique_count'] / len(df) if len(df) > 0 else 0
            # Columnas con cardinalidad baja son buenas candidatas (entre 0.001% y 10%)
            if 0.001 < unique_ratio < 0.1:
                partition_candidates.append({
                    'column': col_name,
                    'unique_count': col_info['stats']['unique_count'],
                    'unique_ratio': unique_ratio
                })

        # Ordenar particiones por idoneidad (de mejor a peor)
        partition_candidates.sort(key=lambda x: abs(x['unique_ratio'] - 0.01))

        # Preparar las estadísticas generales
        return {
            'row_count': len(df),
            'column_count': len(df.columns),
            'schema': schema,
            'primary_key_candidates': primary_key_candidates,
            'partition_candidates': partition_candidates,
            'file_name': file_name,
            'table_name': os.path.splitext(os.path.basename(file_name))[0],
            'sample_data': df.head(5).to_dict(orient='records') if len(df) > 0 else []
        }

    def create_materialization_plan(
        self,
        analysis_result: Dict[str, Any],
        materialization_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Crea un plan de materialización basado en el análisis

        Args:
            analysis_result: Resultado del análisis de datos
            materialization_config: Configuración de materialización

        Returns:
            Plan de materialización
        """
        try:
            plan = {
                'metadata': analysis_result['metadata'],
                'tables': [],
                'destinations': materialization_config.get('destinations', []),
                'server': materialization_config.get('server', {})
            }

            # Procesar cada archivo para crear plan de tabla
            for file_name, file_analysis in analysis_result['files'].items():
                # Obtener configuración específica para esta tabla, si existe
                table_config = None
                for table in materialization_config.get('tables', []):
                    if table.get('file_name') == file_name or table.get('table_name') == file_analysis['table_name']:
                        table_config = table
                        break

                # Si no hay configuración específica, usar valores por defecto
                if not table_config:
                    table_config = {
                        'file_name': file_name,
                        'table_name': file_analysis['table_name'],
                        'update_strategy': 'append',  # Estrategia por defecto
                    }

                # Determinar clave primaria
                primary_key = table_config.get('primary_key')
                if not primary_key and file_analysis['primary_key_candidates']:
                    # Usar el primer candidato
                    primary_key = [file_analysis['primary_key_candidates'][0]]

                # Determinar particionamiento
                partitioning = table_config.get('partitioning')
                if not partitioning and file_analysis['partition_candidates']:
                    # Usar las dos mejores columnas de partición
                    partitioning = [p['column'] for p in file_analysis['partition_candidates'][:2]]

                # Crear plan para esta tabla
                table_plan = {
                    'file_name': file_name,
                    'table_name': table_config.get('table_name') or file_analysis['table_name'],
                    'schema': file_analysis['schema'],
                    'primary_key': primary_key,
                    'partitioning': partitioning,
                    'update_strategy': table_config.get('update_strategy', 'append'),
                    'row_count': file_analysis['row_count'],
                    'configuration': table_config.get('configuration', {})
                }

                plan['tables'].append(table_plan)

            return plan

        except Exception as e:
            logger.error(f"Error al crear plan de materialización: {str(e)}")
            raise

    def materialize(
        self,
        execution_data: Dict[str, Any],
        materialization_plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Materializa los datos según el plan

        Args:
            execution_data: Datos de ejecución
            materialization_plan: Plan de materialización

        Returns:
            Resultado de la materialización
        """
        try:
            start_time = datetime.now()
            results = {
                'metadata': {
                    'start_time': start_time.isoformat(),
                    'status': 'in_progress'
                },
                'tables': {},
                'destinations': {}
            }

            # Procesar cada destino
            for destination in materialization_plan.get('destinations', []):
                dest_type = destination.get('type')
                dest_id = destination.get('id')
                dest_config = destination.get('config', {})

                logger.info(f"Materializando a destino tipo={dest_type}, id={dest_id}")

                # Procesar según tipo de destino
                if dest_type == 'cloud':
                    # Materializar a formato data lake en nube
                    dest_result = self._materialize_to_data_lake(
                        execution_data,
                        materialization_plan,
                        dest_config
                    )
                elif dest_type == 'database':
                    # Materializar a base de datos
                    dest_result = self._materialize_to_database(
                        execution_data,
                        materialization_plan,
                        dest_config
                    )
                else:
                    logger.warning(f"Tipo de destino no soportado: {dest_type}")
                    continue

                results['destinations'][f"{dest_type}_{dest_id}"] = dest_result

            # Completar los resultados
            end_time = datetime.now()
            results['metadata'].update({
                'end_time': end_time.isoformat(),
                'duration_seconds': (end_time - start_time).total_seconds(),
                'status': 'completed'
            })

            return results

        except Exception as e:
            logger.error(f"Error en materialización: {str(e)}")
            end_time = datetime.now()
            return {
                'metadata': {
                    'start_time': start_time.isoformat() if 'start_time' in locals() else datetime.now().isoformat(),
                    'end_time': end_time.isoformat(),
                    'status': 'failed',
                    'error': str(e)
                },
                'tables': results.get('tables', {}) if 'results' in locals() else {},
                'destinations': results.get('destinations', {}) if 'results' in locals() else {}
            }

    def _materialize_to_data_lake(
        self,
        execution_data: Dict[str, Any],
        materialization_plan: Dict[str, Any],
        destination_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Materializa los datos a formato data lake

        Args:
            execution_data: Datos de ejecución
            materialization_plan: Plan de materialización
            destination_config: Configuración del destino

        Returns:
            Resultado de la materialización
        """
        format_type = destination_config.get('format', 'parquet')
        format_config = destination_config.get('format_config', {})
        
        logger.info(f"Materializando a formato data lake: {format_type}")
        
        if format_type in ['iceberg', 'hudi']:
            # Para formatos data lake avanzados, usar el exportador
            tables_config = {}
            for table in materialization_plan.get('tables', []):
                tables_config[table['file_name']] = {
                    'table_name': table['table_name'],
                    'primary_key': table['primary_key'][0] if table['primary_key'] else None,
                    'partition_by': table['partitioning']
                }
            
            # Configurar el exportador
            export_result = self.data_lake_exporter.export_data(
                execution_data,
                format_type=format_type,
                **format_config
            )
            
            return {
                'format': format_type,
                'tables': export_result.get('tables', {}),
                'location': export_result.get('location')
            }
        else:
            # Para formatos simples (parquet, csv, etc.)
            result = {
                'format': format_type,
                'tables': {},
                'location': destination_config.get('output_dir')
            }
            
            # Verificar que tengamos la ubicación de salida
            if not result['location']:
                result['location'] = os.path.join(self.temp_dir, f"export_{format_type}")
                os.makedirs(result['location'], exist_ok=True)
            
            # Extraer los DataFrames de los datos de ejecución
            if isinstance(execution_data, dict) and 'files' in execution_data:
                for file_name, file_data in execution_data['files'].items():
                    if isinstance(file_data, pd.DataFrame):
                        df = file_data
                    elif isinstance(file_data, dict) and 'data' in file_data:
                        if isinstance(file_data['data'], pd.DataFrame):
                            df = file_data['data']
                        else:
                            continue
                    else:
                        continue
                    
                    # Encontrar la configuración de tabla correspondiente
                    table_config = None
                    for table in materialization_plan.get('tables', []):
                        if table['file_name'] == file_name:
                            table_config = table
                            break
                    
                    if not table_config:
                        continue
                    
                    # Guardar en el formato correspondiente
                    table_name = table_config['table_name']
                    file_path = os.path.join(result['location'], f"{table_name}.{format_type}")
                    
                    if format_type == 'parquet':
                        df.to_parquet(file_path)
                    elif format_type == 'csv':
                        df.to_csv(file_path, index=False)
                    elif format_type == 'json':
                        df.to_json(file_path, orient='records')
                    else:
                        logger.warning(f"Formato no soportado directamente: {format_type}")
                        continue
                    
                    result['tables'][file_name] = {
                        'table_name': table_name,
                        'file_path': file_path,
                        'row_count': len(df)
                    }
            
            return result

    def _materialize_to_database(
        self,
        execution_data: Dict[str, Any],
        materialization_plan: Dict[str, Any],
        destination_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Materializa los datos a una base de datos

        Args:
            execution_data: Datos de ejecución
            materialization_plan: Plan de materialización
            destination_config: Configuración del destino

        Returns:
            Resultado de la materialización
        """
        # Verificar que tengamos conexión a la base de datos
        if not self.db_connection:
            error_msg = "No hay conexión a base de datos disponible para materialización"
            logger.error(error_msg)
            return {
                'status': 'error',
                'error': error_msg
            }
        
        db_type = destination_config.get('db_type', 'postgresql')
        schema = destination_config.get('schema')
        result = {
            'db_type': db_type,
            'tables': {},
            'schema': schema
        }
        
        # Materializar cada tabla según su estrategia
        if isinstance(execution_data, dict) and 'files' in execution_data:
            for file_name, file_data in execution_data['files'].items():
                if isinstance(file_data, pd.DataFrame):
                    df = file_data
                elif isinstance(file_data, dict) and 'data' in file_data:
                    if isinstance(file_data['data'], pd.DataFrame):
                        df = file_data['data']
                    else:
                        continue
                else:
                    continue
                
                # Encontrar la configuración de tabla correspondiente
                table_config = None
                for table in materialization_plan.get('tables', []):
                    if table['file_name'] == file_name:
                        table_config = table
                        break
                
                if not table_config:
                    continue
                
                # Aplicar estrategia de actualización
                table_name = table_config['table_name']
                update_strategy = table_config['update_strategy']
                primary_key = table_config.get('primary_key')
                
                # Construir nombre completo de tabla con esquema si existe
                full_table_name = f"{schema}.{table_name}" if schema else table_name
                
                try:
                    if update_strategy == 'truncate_insert':
                        # Vaciar tabla y luego insertar
                        self._truncate_and_insert(db_type, full_table_name, df)
                    elif update_strategy == 'delete_insert' and primary_key:
                        # Eliminar registros existentes e insertar
                        self._delete_and_insert(db_type, full_table_name, df, primary_key)
                    elif update_strategy == 'upsert' and primary_key:
                        # Actualizar existentes e insertar nuevos
                        self._upsert(db_type, full_table_name, df, primary_key)
                    else:
                        # Estrategia por defecto: append
                        self._append(db_type, full_table_name, df)
                    
                    result['tables'][file_name] = {
                        'table_name': table_name,
                        'full_table_name': full_table_name,
                        'strategy': update_strategy,
                        'row_count': len(df),
                        'status': 'success'
                    }
                except Exception as e:
                    logger.error(f"Error al materializar tabla {full_table_name}: {str(e)}")
                    result['tables'][file_name] = {
                        'table_name': table_name,
                        'full_table_name': full_table_name,
                        'strategy': update_strategy,
                        'status': 'error',
                        'error': str(e)
                    }
        
        return result

    def _truncate_and_insert(self, db_type: str, table_name: str, df: "pd.DataFrame"):
        """Implementa estrategia truncate+insert"""
        # Este método varía según el tipo de base de datos
        if db_type == 'postgresql':
            # PostgreSQL tiene una transacción para TRUNCATE
            with self.db_connection.cursor() as cursor:
                cursor.execute(f"TRUNCATE TABLE {table_name}")
                # Usar copy_from para inserción rápida
                from io import StringIO
                output = StringIO()
                df.to_csv(output, sep='\t', header=False, index=False)
                output.seek(0)
                cursor.copy_from(output, table_name, null='')
        else:
            # Método genérico
            with self.db_connection.cursor() as cursor:
                cursor.execute(f"DELETE FROM {table_name}")
                # Insertar fila por fila (menos eficiente pero más compatible)
                for _, row in df.iterrows():
                    placeholders = ', '.join(['%s'] * len(row))
                    columns = ', '.join(row.index)
                    sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                    cursor.execute(sql, tuple(row))
        
        self.db_connection.commit()

    def _delete_and_insert(self, db_type: str, table_name: str, df: "pd.DataFrame", primary_key: List[str]):
        """Implementa estrategia delete+insert"""
        # Obtener valores únicos de claves primarias
        pk_values = df[primary_key].drop_duplicates().values.tolist()
        
        with self.db_connection.cursor() as cursor:
            # Eliminar registros existentes que coincidan con las claves primarias
            if len(pk_values) > 0:
                # Si son muchos valores, dividir en lotes
                batch_size = 1000
                for i in range(0, len(pk_values), batch_size):
                    batch = pk_values[i:i+batch_size]
                    placeholders = ', '.join(['%s'] * len(batch))
                    if len(primary_key) == 1:
                        sql = f"DELETE FROM {table_name} WHERE {primary_key[0]} IN ({placeholders})"
                        cursor.execute(sql, [v[0] for v in batch])
                    else:
                        # Múltiples columnas como clave primaria
                        conditions = []
                        params = []
                        for pk_row in batch:
                            condition_parts = [f"{col} = %s" for col in primary_key]
                            conditions.append(f"({' AND '.join(condition_parts)})")
                            params.extend(pk_row)
                        
                        sql = f"DELETE FROM {table_name} WHERE {' OR '.join(conditions)}"
                        cursor.execute(sql, params)
            
            # Insertar todos los registros
            for _, row in df.iterrows():
                placeholders = ', '.join(['%s'] * len(row))
                columns = ', '.join(row.index)
                sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                cursor.execute(sql, tuple(row))
        
        self.db_connection.commit()

    def _upsert(self, db_type: str, table_name: str, df: "pd.DataFrame", primary_key: List[str]):
        """Implementa estrategia upsert (update o insert)"""
        if db_type == 'postgresql':
            # PostgreSQL tiene ON CONFLICT para upsert
            for _, row in df.iterrows():
                columns = ', '.join(row.index)
                placeholders = ', '.join(['%s'] * len(row))
                update_clauses = ', '.join([f"{col} = EXCLUDED.{col}" for col in row.index if col not in primary_key])
                conflict_columns = ', '.join(primary_key)
                
                sql = f"""
                INSERT INTO {table_name} ({columns})
                VALUES ({placeholders})
                ON CONFLICT ({conflict_columns})
                DO UPDATE SET {update_clauses}
                """
                
                with self.db_connection.cursor() as cursor:
                    cursor.execute(sql, tuple(row))
        else:
            # Para otras bases de datos, simular upsert con operaciones separadas
            primary_keys_values = df[primary_key].values.tolist()
            
            with self.db_connection.cursor() as cursor:
                # Verificar qué registros existen
                existing_records = set()
                for pk_values in primary_keys_values:
                    conditions = [f"{pk} = %s" for pk in primary_key]
                    sql = f"SELECT 1 FROM {table_name} WHERE {' AND '.join(conditions)}"
                    cursor.execute(sql, pk_values)
                    if cursor.fetchone():
                        # Convertir a tupla para poder usarlo como clave de conjunto
                        existing_records.add(tuple(pk_values))
                
                # Actualizar los existentes e insertar los nuevos
                for _, row in df.iterrows():
                    pk_values = tuple(row[pk] for pk in primary_key)
                    
                    if pk_values in existing_records:
                        # Actualizar
                        set_clauses = ', '.join([f"{col} = %s" for col in row.index if col not in primary_key])
                        conditions = [f"{pk} = %s" for pk in primary_key]
                        
                        sql = f"UPDATE {table_name} SET {set_clauses} WHERE {' AND '.join(conditions)}"
                        params = [row[col] for col in row.index if col not in primary_key]
                        params.extend([row[pk] for pk in primary_key])
                        
                        cursor.execute(sql, params)
                    else:
                        # Insertar
                        placeholders = ', '.join(['%s'] * len(row))
                        columns = ', '.join(row.index)
                        
                        sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                        cursor.execute(sql, tuple(row))
        
        self.db_connection.commit()

    def _append(self, db_type: str, table_name: str, df: "pd.DataFrame"):
        """Implementa estrategia append (solo insertar)"""
        with self.db_connection.cursor() as cursor:
            for _, row in df.iterrows():
                placeholders = ', '.join(['%s'] * len(row))
                columns = ', '.join(row.index)
                sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                cursor.execute(sql, tuple(row))
        
        self.db_connection.commit()
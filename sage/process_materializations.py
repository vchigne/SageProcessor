"""
Procesador de materializaciones para SAGE

Este módulo implementa la funcionalidad para procesar materializaciones
después de que un archivo ha sido validado y procesado por SAGE.
"""
import os
import pandas as pd
import psycopg2
from typing import Optional, Dict, List, Any
from .logger import SageLogger

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
                result.append(dict(zip(columns, row)))
                
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
        
        # Aquí iría la lógica para procesar la materialización según su configuración
        # Por ahora solo registramos la actividad
        
        self._register_materialization_execution(
            materialization['id'],
            execution_id,
            status='pendiente',
            message='Configuración de materialización registrada para su procesamiento'
        )
        
        self.logger.message(f"Materialización {materialization['nombre']} registrada para su procesamiento")
    
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
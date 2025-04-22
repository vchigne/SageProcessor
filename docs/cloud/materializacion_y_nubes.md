# Materialización de Datos y su Integración con el Sistema de Nubes

Este documento técnico describe la arquitectura del sistema de materialización de datos en SAGE y cómo se integra con el sistema de almacenamiento en la nube para permitir la transformación y persistencia de datos procesados en diferentes destinos.

## Índice

1. [Concepto de Materialización](#1-concepto-de-materialización)
2. [Arquitectura del Sistema de Materialización](#2-arquitectura-del-sistema-de-materialización)
3. [Flujo de Procesamiento](#3-flujo-de-procesamiento)
4. [Integración con Proveedores de Nube](#4-integración-con-proveedores-de-nube)
5. [Formatos de Archivos Soportados](#5-formatos-de-archivos-soportados)
6. [Esquema de la Base de Datos](#6-esquema-de-la-base-de-datos)
7. [Mejores Prácticas y Recomendaciones](#7-mejores-prácticas-y-recomendaciones)
8. [Solución de Problemas Comunes](#8-solución-de-problemas-comunes)

## 1. Concepto de Materialización

La "materialización" en SAGE se refiere al proceso mediante el cual los datos que han sido procesados y validados durante una ejecución de YAML son transformados y persistidos en un destino específico (base de datos o sistema de almacenamiento en la nube) en un formato optimizado para su análisis y consulta posterior.

### 1.1 Propósito

* **Persistencia de datos procesados**: Guardar los resultados de manera estructurada y duradera
* **Transformación de formatos**: Convertir datos temporales en formatos optimizados para analítica
* **Actualización incremental**: Mantener datos históricos actualizados con nuevas ejecuciones
* **Gestión de particiones**: Organizar datos de manera eficiente para consultas rápidas

## 2. Arquitectura del Sistema de Materialización

El sistema de materialización está diseñado con una arquitectura modular que se integra con el procesamiento principal de SAGE.

### 2.1 Componentes Principales

* **Procesador de Materialización**: Módulo central que orquesta el proceso
* **Preparadores de DataFrame**: Módulos para transformar y mapear columnas
* **Conectores de Destino**: Interfaces para diferentes destinos (DB, Cloud)
* **Registrador de Ejecuciones**: Sistema para seguimiento y auditoria

### 2.2 Diagrama de Arquitectura

```
┌───────────────────┐
│ Procesador YAML   │
│  (file_processor) │
└─────────┬─────────┘
          │
          │ DataFrame
          ▼
┌───────────────────┐
│ Procesador de     │
│ Materialización   │
└───┬─────────┬─────┘
    │         │
    ▼         ▼
┌───────┐ ┌────────┐
│ DB    │ │ Cloud  │
│ Dest. │ │ Dest.  │
└───────┘ └────────┘
```

## 3. Flujo de Procesamiento

El proceso de materialización sigue estos pasos:

1. **Inicio**: Se inicia automáticamente después de una ejecución exitosa de YAML
   ```python
   # En sage/main.py
   if casilla_id and hasattr(processor, 'last_processed_df') and processor.last_processed_df is not None and error_count == 0:
       try:
           from .process_materializations import process_materializations
           process_materializations(
               casilla_id=casilla_id,
               execution_id=execution_uuid,
               dataframe=processor.last_processed_df,
               logger=logger
           )
   ```

2. **Obtención de configuraciones**: Se consultan las materializaciones configuradas para la casilla
   ```python
   def _get_materializations(self, casilla_id):
       # Consulta SQL para obtener las materializaciones activas para la casilla
       cursor.execute("""
           SELECT id, nombre, descripcion, configuracion, 
                  fecha_creacion, fecha_actualizacion, estado, casilla_id
           FROM materializaciones
           WHERE casilla_id = %s AND (estado = 'activo' OR estado = 'pendiente')
       """, (casilla_id,))
   ```

3. **Preparación de los datos**: Se aplican transformaciones al DataFrame según la configuración
   ```python
   def _prepare_dataframe(self, df, config):
       # Aplicar mapeo de columnas
       # Aplicar transformaciones de tipos
       # Aplicar filtros
   ```

4. **Materialización según destino**: Se envían los datos al destino configurado
   ```python
   # Bifurcación según el tipo de destino
   if destination_type == 'db':
       self._materialize_to_database(...)
   elif destination_type == 'cloud':
       self._materialize_to_cloud(...)
   ```

5. **Registro de resultado**: Se guarda el registro de la materialización
   ```python
   def _register_materialization_execution(self, materialization_id, execution_id, estado, mensaje=None):
       # Insertar registro en la tabla de ejecuciones de materialización
   ```

## 4. Integración con Proveedores de Nube

La materialización a destinos en la nube utiliza el sistema de proveedores cloud de SAGE.

### 4.1 Flujo para Materialización a Nube

1. **Obtención de información del proveedor**: Se consulta el proveedor configurado
   ```python
   provider_info = self._get_cloud_provider_info(cloud_provider_id)
   ```

2. **Selección de formato y ruta**: Se determinan según la configuración
   ```python
   file_format = config.get('file_format', 'parquet')
   destination_path = config.get('destination_path')
   ```

3. **Procesamiento según proveedor**: Se utiliza el adaptador específico
   ```python
   if provider_type == 's3' or provider_type == 'minio':
       self._materialize_to_s3_compatible(...)
   elif provider_type == 'azure':
       self._materialize_to_azure(...)
   ```

4. **Estrategias de actualización**: Reemplazo o actualización incremental
   ```python
   # Estrategias soportadas
   # - replace: Reemplazar archivos existentes
   # - append: Añadir nuevos datos a los existentes
   # - upsert: Actualizar registros existentes e insertar nuevos (para formatos que lo soporten)
   ```

### 4.2 Dependencias con el Sistema de Nubes

El sistema de materialización depende de la tabla `cloud_providers` de la siguiente manera:

```sql
-- Consulta utilizada para obtener información del proveedor
SELECT id, nombre, tipo, credenciales, configuracion 
FROM cloud_providers 
WHERE id = %s AND activo = true
```

**Campos utilizados**:
* `id`: Identificador único del proveedor
* `nombre`: Nombre descriptivo (para logs)
* `tipo`: Tipo de proveedor (s3, azure, gcp, minio, sftp)
* `credenciales`: Credenciales de autenticación en formato JSON
* `configuracion`: Configuración específica del proveedor en formato JSON

## 5. Formatos de Archivos Soportados

La materialización a destinos cloud soporta estos formatos:

### 5.1 Formatos Tabulares

| Formato | Extensión | Ventajas | Casos de Uso |
|---------|-----------|----------|--------------|
| CSV | .csv | Simple, universal | Intercambio de datos, compatibilidad |
| Parquet | .parquet | Columnar, eficiente | Analítica, consultas por columnas |
| Avro | .avro | Esquema integrado | Preservación de esquema, evolución |
| ORC | .orc | Compresión alta | Almacenamiento eficiente |

### 5.2 Formatos de Data Lake

| Formato | Características | Configuración Adicional |
|---------|-----------------|-------------------------|
| Delta Lake | Transaccional, evolución de esquema | `tabla_destino`, `estrategia_actualizacion` |
| Apache Iceberg | Atomicidad, evolución de esquema | `primaryKey`, `tabla_destino` |
| Apache Hudi | Upserts, optimización de lectura | `primaryKey`, `tabla_destino` |

## 6. Esquema de la Base de Datos

El sistema de materialización utiliza estas tablas principales:

### 6.1 Tabla de Materializaciones

```sql
CREATE TABLE materializaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    configuracion JSONB NOT NULL,
    casilla_id INTEGER REFERENCES casillas(id),
    estado VARCHAR(50) DEFAULT 'pendiente', -- 'pendiente', 'activo', 'inactivo'
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_materializacion TIMESTAMP
);
```

La columna `configuracion` almacena un JSON con la siguiente estructura:

```json
{
  "tipoProveedor": "cloud", // o "db"
  "proveedorId": 123, // ID del proveedor en cloud_providers o db_secrets
  "formato": "hudi", // Para cloud: "csv", "parquet", "avro", "hudi", "iceberg", "delta"
  "columnas": ["col1", "col2"], // Opcional: Lista de columnas a materializar
  "primaryKey": ["id"], // Clave primaria para formatos que lo soportan
  "tablaDestino": "tabla_destino", // Nombre de la tabla o archivo destino
  "estrategiaActualizacion": "reemplazar", // "reemplazar", "anexar", "upsert"
  "columnMappings": [ // Mapeo de columnas origen->destino
    {"originName": "col_origen", "targetName": "col_destino"}
  ]
}
```

### 6.2 Tabla de Ejecuciones de Materialización

```sql
CREATE TABLE materializaciones_ejecuciones (
    id SERIAL PRIMARY KEY,
    materializacion_id INTEGER REFERENCES materializaciones(id),
    ejecucion_id VARCHAR(255), -- UUID de la ejecución YAML
    estado VARCHAR(50), -- 'completado', 'error'
    mensaje TEXT, -- Mensaje de éxito o error
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    registros_procesados INTEGER
);
```

## 7. Mejores Prácticas y Recomendaciones

### 7.1 Configuración de Materializaciones

* **Estado por defecto**: Crear materializaciones con estado "activo" para procesamiento inmediato
* **Claves primarias**: Definir claves primarias para formatos que soportan actualización incremental
* **Columnas**: Materializar solo las columnas necesarias para mejorar rendimiento
* **Uso de mapeo**: Usar mapeo de columnas para adaptarse a sistemas externos

### 7.2 Rendimiento

* **Particionamiento**: Utilizar particionamiento para grandes volúmenes de datos
* **Compresión**: Habilitar compresión para reducir almacenamiento y mejorar velocidad
* **Batch size**: Ajustar tamaño de lotes para operaciones de materialización grandes
* **Índices**: Configurar índices para formatos y destinos que lo soporten

### 7.3 Monitoreo

* **Revisar logs**: Los logs contienen información detallada del proceso
* **Tabla de ejecuciones**: Consultar materializaciones_ejecuciones para historial
* **Mensajes de error**: Revisar campo 'mensaje' para diagnóstico
* **Tiempo de ejecución**: Monitorear diferencia entre fecha_inicio y fecha_fin

## 8. Solución de Problemas Comunes

### 8.1 Errores de Esquema

**Problema**: Incompatibilidad entre el esquema del DataFrame y el destino

**Solución**:
1. Verificar el mapeo de columnas en la configuración
2. Comprobar si todos los tipos de datos son compatibles
3. Usar transformaciones explícitas de tipos en la configuración

### 8.2 Errores de Autenticación

**Problema**: Fallos de acceso al proveedor de nube

**Solución**:
1. Verificar que el ID del proveedor es correcto
2. Probar la conexión al proveedor desde la interfaz de administración
3. Revisar permisos de escritura en el destino configurado

### 8.3 Errores de Configuración

**Problema**: Configuración incompleta o incorrecta

**Solución**:
1. Verificar que la materialización tiene estado "activo"
2. Comprobar que todos los campos obligatorios están presentes
3. Validar que el formato elegido es compatible con el proveedor

## Conclusión

El sistema de materialización de SAGE proporciona un mecanismo potente y flexible para persistir datos procesados en diferentes formatos y destinos. La integración con el sistema de nubes permite aprovechar diversas tecnologías de almacenamiento y formatos optimizados para análisis de datos.

La correcta configuración y mantenimiento de las materializaciones asegura un flujo eficiente de datos desde su procesamiento inicial hasta su disponibilidad para análisis y consultas de negocio.
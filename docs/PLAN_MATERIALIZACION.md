# Plan de Implementación: Sistema de Materialización para SAGE

## Descripción General

El sistema de materialización permitirá a los usuarios de SAGE convertir los datos procesados en estructuras persistentes optimizadas para consulta, tanto en nubes (formatos data lake como Iceberg y Hudi) como en bases de datos relacionales (SQL Server, PostgreSQL, MySQL, DuckDB).

## Objetivos

1. Permitir materializar datos de casillas en tablas estructuradas
2. Soportar destinos en nubes (data lakes) y bases de datos
3. Ofrecer configuración flexible de tablas, claves y particiones
4. Implementar distintas estrategias de actualización
5. Distribuir el procesamiento entre servidores para optimizar rendimiento

## Arquitectura

### Modelo de Datos

```
DB_SECRETS
- id (PK)
- nombre
- descripcion 
- tipo_servidor (enum: postgresql, mysql, sqlserver, duckdb)
- credenciales (JSON encriptado)
- creado_en
- modificado_en
- activo

DATABASE_CONNECTIONS
- id (PK)
- nombre
- descripcion
- secret_id (FK a DB_SECRETS)
- base_datos
- esquema (opcional)
- configuracion (JSON)
- estado_conexion
- ultimo_test
- creado_en
- modificado_en
- activo

MATERIALIZATION_SERVERS
- id (PK)
- nombre
- descripcion
- tipo (enum: local, remote, container)
- endpoint
- secret_id (FK a cloud_secrets)
- capacidad
- estado
- metricas (JSON)
- creado_en
- modificado_en
- activo

MATERIALIZATIONS
- id (PK)
- casilla_id (FK a data_boxes)
- nombre
- descripcion
- configuracion_general (JSON)
- ultimo_analisis
- ultima_materializacion
- estado
- servidor_id (FK a MATERIALIZATION_SERVERS)
- creado_en
- modificado_en
- activo

MATERIALIZATION_TABLES
- id (PK)
- materializacion_id (FK a MATERIALIZATIONS)
- archivo_fuente
- nombre_tabla
- esquema_definido (JSON)
- clave_primaria (array)
- partitioning (JSON)
- update_strategy (enum)
- configuracion (JSON)
- activo

MATERIALIZATION_DESTINATIONS
- id (PK)
- materializacion_id (FK a MATERIALIZATIONS)
- tipo_destino (enum: cloud, database)
- destino_id (FK a clouds o database_connections)
- formato (enum)
- configuracion (JSON)
- ultimo_refresh
- estado
- creado_en
- modificado_en
- activo

MATERIALIZATION_HISTORY
- id (PK)
- materializacion_id (FK)
- tabla_id (FK)
- destino_id (FK)
- servidor_id (FK)
- fecha_inicio
- fecha_fin
- tamaño_datos
- filas_procesadas
- estado
- mensaje_error
- metricas (JSON)
```

### Estructura Jerárquica

1. **Nivel de Servidor (DB_SECRETS)**:
   - Define un servidor de base de datos
   - Almacena credenciales de acceso
   - Similar a los cloud_secrets

2. **Nivel de Base de Datos (DATABASE_CONNECTIONS)**:
   - Define una base de datos específica en un servidor
   - Asociada a un DB_SECRET
   - Similar a buckets/contenedores en nubes

3. **Nivel de Tabla (MATERIALIZATION_TABLES)**:
   - Define mapeos de archivos a tablas de destino
   - Para cada archivo detectado en YAML, configura una tabla
   - Incluye nombre, schema, claves, particiones y estrategia

### Estrategias de Actualización

Para cada tabla, se podrá seleccionar una estrategia:

1. **Upsert**:
   - Actualiza registros existentes e inserta nuevos
   - Para datos maestros con actualización incremental

2. **Delete + Insert**:
   - Elimina registros existentes que cumplan condición
   - Inserta todos los nuevos registros
   - Para actualizaciones completas de conjuntos

3. **Append Only**:
   - Solo añade nuevos registros
   - Para logs, historial o series temporales

4. **Truncate + Insert**:
   - Vacía completamente la tabla y luego inserta todos los datos
   - Para actualizaciones totales sin historial

### Sistema de Servidores

1. **Servidor Local**:
   - Integrado en SAGE
   - Para materializaciones pequeñas (<1MB)

2. **Servidores Remotos**:
   - Instancias dedicadas
   - Conectados mediante API REST
   - Diferentes entornos (VMs, contenedores)

3. **Balanceador de Carga**:
   - Decisión basada en tamaño, capacidad y prioridad
   - Archivos <1MB siempre local
   - Otros casos: algoritmo de asignación óptima

## Plan de Implementación

### Fase 1: Base de Datos y Estructura

1. Crear migraciones para nuevas tablas
2. Implementar modelos en la ORM
3. Definir relaciones entre entidades
4. Crear API básicas para CRUD

### Fase 2: Administración de BD

1. Implementar páginas de DB Secrets
2. Desarrollar páginas de conexiones a BD
3. Crear funciones de prueba de conectividad
4. Implementar validaciones

### Fase 3: Servidores de Materialización

1. Implementar servidor local básico
2. Crear estructura para servidores remotos
3. Desarrollar balanceador inicial
4. Implementar sistema de monitoreo

### Fase 4: Detección y Configuración

1. Crear analizador de YAML para tablas
2. Desarrollar inferencia de tipos y estructura
3. Implementar editor de configuración de tablas
4. Crear funciones de validación

### Fase 5: Interfaz de Materialización

1. Agregar botón a casillas
2. Desarrollar página de materialización
3. Crear formularios de configuración por tabla
4. Implementar selector de destinos

### Fase 6: Motor de Materialización

1. Implementar procesadores para BD
2. Integrar con exportadores de data lake
3. Desarrollar estrategias de actualización
4. Crear sistema de registro y monitoreo

### Fase 7: Refinamiento y Optimización

1. Optimizar rendimiento y escalabilidad
2. Mejorar interfaz de usuario
3. Implementar características avanzadas
4. Desarrollar documentación completa

## Detalles de Implementación

### Tecnologías Frontend

- Next.js (estructura existente)
- React hooks para gestión de estado
- Tailwind CSS para estilos
- React Query para fetching
- Formularios con React Hook Form + Zod

### Tecnologías Backend

- API Routes de Next.js
- SQL Server/PostgreSQL para almacenamiento
- ORM existente para modelos
- Python para procesamiento de datos

### Servidores de Materialización

- API REST para comunicación
- Sistema de colas para procesamiento
- Node.js o Python para implementación
- Docker para contenerización (opcional)

## Consideraciones de Seguridad

1. Cifrado de credenciales en tránsito y reposo
2. Validación de permisos para operaciones
3. Auditoría completa de acciones
4. Tokens de seguridad para comunicación entre componentes

## Ejemplos de Uso

### Ejemplo: Materialización de Datos de Ventas

1. Usuario accede a casilla "Ventas Semanales"
2. Sistema detecta archivos: clientes.csv, productos.csv, ventas.csv
3. Para cada archivo, se configura:
   - Nombre de tabla
   - Clave primaria
   - Estrategia de actualización
   - Particionamiento (para data lakes)
4. Se seleccionan destinos:
   - Base de datos SQL Server
   - Data Lake en formato Iceberg
5. Sistema ejecuta materialización:
   - Archivos pequeños: servidor local
   - Archivos grandes: servidores remotos
6. Datos disponibles en destinos configurados

## Cronograma Estimado

- Fase 1: 1 semana
- Fase 2: 1 semana
- Fase 3: 2 semanas
- Fase 4: 1 semana
- Fase 5: 2 semanas
- Fase 6: 2 semanas
- Fase 7: 1 semana

Total: 10 semanas para implementación completa
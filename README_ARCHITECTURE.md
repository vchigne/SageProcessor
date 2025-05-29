# Arquitectura SAGE Platform

Este documento describe la arquitectura técnica de la plataforma SAGE para procesamiento de datos y materialización multi-cloud.

## Visión General

SAGE es una plataforma empresarial diseñada para el procesamiento complejo de datos con capacidades de materialización en múltiples proveedores de nube y bases de datos relacionales.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Storage       │
│   (Next.js)     │◄──►│   (Node.js +    │◄──►│   (PostgreSQL + │
│                 │    │    Python)      │    │    Multi-Cloud) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Componentes Principales

### 1. Frontend Web (Next.js)
- **Ubicación**: `/src/pages/`
- **Tecnologías**: Next.js, React, Tailwind CSS
- **Funcionalidades**:
  - Dashboard de monitoreo en tiempo real
  - Gestión de casillas de datos
  - Configuración de materializaciones
  - Administración de proveedores cloud

### 2. API Layer (Next.js API Routes)
- **Ubicación**: `/src/pages/api/`
- **Funcionalidades**:
  - REST APIs para CRUD operations
  - Endpoints de estadísticas y métricas
  - Integración con servicios Python
  - Autenticación y autorización

### 3. Processing Engine (Python)
- **Ubicación**: `/sage/`
- **Componentes principales**:
  - `main.py` - Punto de entrada principal
  - `file_processor.py` - Procesamiento de archivos
  - `process_materializations.py` - Lógica de materialización

### 4. Daemon Services (Python)

#### SAGE Daemon 2
- **Archivo**: `run_sage_daemon2.py`
- **Responsabilidades**:
  - Monitoreo continuo de casillas de datos
  - Procesamiento automático de archivos
  - Gestión de notificaciones
  - Ejecución de materializaciones

#### Janitor Daemon
- **Archivo**: `janitor_daemon.py`
- **Responsabilidades**:
  - Migración a proveedores cloud
  - Limpieza de archivos temporales
  - Backup automático
  - Mantenimiento del sistema

## Flujo de Datos

### 1. Ingesta de Datos
```
Archivo → Casilla de Datos → Validación → Procesamiento → Materialización
```

### 2. Procesamiento de Archivos
1. **Detección**: SAGE Daemon monitorea casillas configuradas
2. **Validación**: Verificación contra esquemas YAML
3. **Transformación**: Aplicación de reglas de negocio
4. **Materialización**: Exportación a destinos configurados

### 3. Estrategias de Materialización

#### Bases de Datos
- **UPSERT**: Insertar o actualizar registros existentes
- **DELETE_INSERT**: Eliminar y reinsertar datos
- **APPEND**: Agregar nuevos registros
- **TRUNCATE_INSERT**: Vaciar tabla y reinsertar
- **FULL**: Reemplazo completo con UUID de control

#### Data Lakes
- **Apache Iceberg**: Formato de tabla transaccional
- **Apache Hudi**: Copy-on-write y merge-on-read
- **Parquet**: Almacenamiento columnar optimizado

## Base de Datos

### Esquema Principal (PostgreSQL)

#### Tablas Core
- `casillas_datos` - Configuración de fuentes de datos
- `ejecuciones_yaml` - Historial de procesamientos
- `materializaciones` - Configuración de destinos
- `catalogos` - Organización de datos por catálogo

#### Tablas de Configuración
- `proveedores_nube` - Configuración multi-cloud
- `secretos_nube` - Credenciales cifradas
- `plantillas_email` - Templates de notificaciones
- `suscripciones_notificaciones` - Alertas configuradas

### Relaciones Clave
```sql
casillas_datos (1) ──── (N) catalogos
catalogos (1) ──── (N) materializaciones
ejecuciones_yaml (N) ──── (1) casillas_datos
```

## Integración Multi-Cloud

### Proveedores Soportados

#### Amazon Web Services (S3)
- Bucket storage para data lakes
- IAM roles para seguridad
- S3 Transfer Acceleration

#### Microsoft Azure
- Blob Storage containers
- Azure Data Lake Storage Gen2
- SAS tokens para acceso temporal

#### Google Cloud Platform
- Cloud Storage buckets
- Service accounts con JSON keys
- Signed URLs para acceso seguro

#### MinIO
- S3-compatible object storage
- On-premise y cloud deployment
- Presigned URLs

#### SFTP
- Transferencia segura de archivos
- Soporte para múltiples protocolos
- Retry automático en fallos

## Monitoreo y Observabilidad

### Métricas Clave
- **Throughput**: Archivos procesados por hora
- **Latencia**: Tiempo de procesamiento promedio
- **Tasa de Error**: Porcentaje de fallos
- **Utilización**: Uso de recursos del sistema

### Logging
- **Niveles**: DEBUG, INFO, WARNING, ERROR
- **Rotación**: Archivos de log rotativos
- **Centralización**: Logs estructurados en JSON

### Health Checks
- `/api/health` - Estado general
- `/api/database/health` - Conectividad BD
- `/api/services/status` - Estado daemons

## Seguridad

### Cifrado
- **En Tránsito**: TLS 1.2+ para todas las comunicaciones
- **En Reposo**: Cifrado de credenciales en base de datos
- **Claves**: Rotación automática de tokens de acceso

### Autenticación
- Tokens de sesión seguros
- Integración con sistemas empresariales
- Rate limiting en APIs

### Auditoría
- Log completo de operaciones
- Trazabilidad de cambios
- Retención configurable

## Escalabilidad

### Horizontal
- Múltiples instancias de daemons
- Load balancing para frontend
- Particionamiento de casillas por servidor

### Vertical
- Configuración de recursos por componente
- Optimización de consultas SQL
- Caching de resultados frecuentes

### Almacenamiento
- Particionamiento temporal de tablas
- Archivado automático de datos antiguos
- Compresión de archivos históricos

## Despliegue

### Contenedores (Docker)
```dockerfile
# Multi-stage build optimizado
FROM node:18-alpine AS base
# ... configuración completa
```

### Orquestación (Docker Compose)
- Servicios independientes
- Volúmenes persistentes
- Redes aisladas
- Health checks integrados

### Configuración
- Variables de entorno centralizadas
- Secrets management
- Feature flags para funcionalidades

## Desarrollo

### Stack Tecnológico
- **Frontend**: Next.js 13+, React 18+, Tailwind CSS 3+
- **Backend**: Node.js 18+, Python 3.11+
- **Base de Datos**: PostgreSQL 15+
- **Caching**: Redis (opcional)
- **Monitoreo**: Custom metrics + logs

### Estructura de Directorios
```
sage-platform/
├── src/                    # Frontend Next.js
├── sage/                   # Core Python engine
├── deploy_scripts/         # Deployment tools
├── docker/                 # Container configs
├── docs/                   # Documentation
└── tests/                  # Test suites
```

### Flujo de Desarrollo
1. **Feature branches** para nuevas funcionalidades
2. **Pull requests** con revisión de código
3. **CI/CD** con testing automatizado
4. **Staging** environment para validación
5. **Production** deployment con rollback

Esta arquitectura proporciona una base sólida para el procesamiento empresarial de datos con alta disponibilidad, escalabilidad y mantenibilidad.
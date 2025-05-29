# SAGE API Documentation

Documentación completa de las APIs REST disponibles en la plataforma SAGE.

## Base URL
```
http://localhost:5000/api
```

## Autenticación
Las APIs utilizan autenticación por sesión. Incluir cookies de sesión en las requests.

## Endpoints Principales

### Dashboard y Estadísticas

#### GET /api/dashboard/stats
Obtiene estadísticas generales del sistema.

**Parámetros de Query:**
- `dias` (opcional): Número de días para el filtro (default: 30)

**Respuesta:**
```json
{
  "archivos_procesados": 1250,
  "archivos_exitosos": 1180,
  "archivos_parciales": 45,
  "archivos_fallidos": 25
}
```

#### GET /api/dashboard/tendencia
Obtiene datos de tendencia por día.

**Parámetros de Query:**
- `dias` (opcional): Número de días para el filtro (default: 30)

**Respuesta:**
```json
[
  {
    "fecha": "29/05",
    "procesados": 45,
    "exitosos": 42,
    "parciales": 2,
    "fallidos": 1
  }
]
```

#### GET /api/dashboard/ultimas-ejecuciones
Obtiene resumen de últimas ejecuciones agrupadas por estado.

**Respuesta:**
```json
[
  {
    "estado": "Éxito",
    "cantidad": 890
  },
  {
    "estado": "Fallido",
    "cantidad": 23
  }
]
```

### Casillas de Datos

#### GET /api/admin/casillas
Lista todas las casillas de datos configuradas.

**Respuesta:**
```json
[
  {
    "id_casilla": 1,
    "nombre": "Ventas Retail",
    "descripcion": "Datos de ventas del canal retail",
    "ruta_monitoreo": "/data/retail/",
    "activa": true,
    "fecha_creacion": "2025-01-15T10:30:00Z"
  }
]
```

#### POST /api/admin/casillas
Crea una nueva casilla de datos.

**Body:**
```json
{
  "nombre": "Nueva Casilla",
  "descripcion": "Descripción de la casilla",
  "ruta_monitoreo": "/data/nueva/",
  "activa": true,
  "configuracion_yaml": "...",
  "frecuencia_monitoreo": 300
}
```

#### PUT /api/admin/casillas/{id}
Actualiza una casilla existente.

#### DELETE /api/admin/casillas/{id}
Elimina una casilla de datos.

### Materializaciones

#### GET /api/admin/materializations
Lista todas las materializaciones configuradas.

**Respuesta:**
```json
[
  {
    "id_materializacion": 1,
    "nombre": "Export to DataLake",
    "tipo_destino": "datalake",
    "formato": "parquet",
    "estrategia_actualizacion": "upsert",
    "activa": true
  }
]
```

#### POST /api/admin/materializations
Crea una nueva materialización.

#### GET /api/admin/materializations/{id}
Obtiene detalles de una materialización específica.

#### PUT /api/admin/materializations/{id}
Actualiza una materialización existente.

#### DELETE /api/admin/materializations/{id}
Elimina una materialización.

### Ejecuciones

#### GET /api/admin/executions
Lista las ejecuciones recientes.

**Parámetros de Query:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 50)
- `estado` (opcional): Filtrar por estado
- `casilla_id` (opcional): Filtrar por casilla

**Respuesta:**
```json
{
  "data": [
    {
      "id_ejecucion": 1,
      "nombre_archivo": "ventas_2025_05.xlsx",
      "estado": "Éxito",
      "fecha_ejecucion": "2025-05-29T14:30:00Z",
      "tiempo_procesamiento": "00:02:45",
      "registros_procesados": 15420,
      "warnings_detectados": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "pages": 25
  }
}
```

#### GET /api/admin/executions/{id}
Obtiene detalles completos de una ejecución.

**Respuesta:**
```json
{
  "id_ejecucion": 1,
  "uuid_ejecucion": "123e4567-e89b-12d3-a456-426614174000",
  "nombre_archivo": "ventas_2025_05.xlsx",
  "estado": "Éxito",
  "fecha_ejecucion": "2025-05-29T14:30:00Z",
  "fecha_finalizacion": "2025-05-29T14:32:45Z",
  "registros_procesados": 15420,
  "materializaciones_exitosas": 3,
  "materializaciones_fallidas": 0,
  "warnings_detectados": 0,
  "errores_detectados": 0,
  "logs": "...",
  "ruta_cloud": "cloud://sage.vidasoft/executions/..."
}
```

#### POST /api/admin/executions/{id}/retry
Reintenta una ejecución fallida.

### Proveedores de Nube

#### GET /api/admin/cloud-providers
Lista los proveedores de nube configurados.

**Respuesta:**
```json
[
  {
    "id": 1,
    "nombre": "AWS Production",
    "tipo": "s3",
    "activo": true,
    "estado": "connected",
    "ultimo_chequeo": "2025-05-29T14:30:00Z"
  }
]
```

#### POST /api/admin/cloud-providers
Configura un nuevo proveedor de nube.

**Body:**
```json
{
  "nombre": "Azure Backup",
  "descripcion": "Backup secundario en Azure",
  "tipo": "azure",
  "credenciales": {
    "connection_string": "...",
    "container_name": "backups"
  },
  "configuracion": {
    "prefix": "sage-backups/",
    "use_sas": true
  }
}
```

#### PUT /api/admin/cloud-providers/{id}
Actualiza un proveedor existente.

#### DELETE /api/admin/cloud-providers/{id}
Elimina un proveedor de nube.

#### POST /api/admin/cloud-providers/{id}/test
Prueba la conectividad con un proveedor.

### Notificaciones

#### GET /api/admin/notifications/subscriptions
Lista las suscripciones de notificaciones.

#### POST /api/admin/notifications/subscriptions
Crea una nueva suscripción.

**Body:**
```json
{
  "nombre": "Alertas de Errores",
  "casilla_id": 1,
  "tipos_evento": ["error", "warning"],
  "frecuencia": "inmediata",
  "destinatarios": ["admin@empresa.com"],
  "plantilla_id": 1
}
```

#### GET /api/admin/notifications/templates
Lista las plantillas de email disponibles.

#### POST /api/admin/notifications/send-test
Envía un email de prueba.

### Configuración del Sistema

#### GET /api/admin/config/email
Obtiene la configuración de email.

#### PUT /api/admin/config/email
Actualiza la configuración de email.

**Body:**
```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "notifications@empresa.com",
  "smtp_password": "app_password",
  "smtp_use_tls": true,
  "from_address": "noreply@empresa.com"
}
```

#### GET /api/admin/config/system
Obtiene configuración general del sistema.

### Health Checks

#### GET /api/health
Verifica el estado general del sistema.

**Respuesta:**
```json
{
  "status": "healthy",
  "timestamp": "2025-05-29T14:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "sage_daemon": "healthy",
    "janitor_daemon": "healthy"
  },
  "uptime": "72h 15m 30s"
}
```

#### GET /api/database/health
Verifica conectividad específica con la base de datos.

#### GET /api/services/status
Estado detallado de los servicios de background.

## Códigos de Estado HTTP

- `200` - Éxito
- `201` - Recurso creado exitosamente
- `400` - Error en la request (validación)
- `401` - No autorizado
- `403` - Acceso prohibido
- `404` - Recurso no encontrado
- `409` - Conflicto (recurso ya existe)
- `422` - Error de validación de datos
- `500` - Error interno del servidor

## Formato de Errores

```json
{
  "error": true,
  "message": "Descripción del error",
  "code": "ERROR_CODE",
  "details": {
    "field": "campo específico con error",
    "value": "valor recibido"
  }
}
```

## Rate Limiting

- **Límite general**: 1000 requests por hora por IP
- **Límite para uploads**: 10 archivos por minuto
- **Límite para health checks**: Sin límite

## Ejemplos de Uso

### Subir y Procesar Archivo

```bash
# 1. Subir archivo
curl -X POST \
  -F "file=@datos.xlsx" \
  -F "casilla_id=1" \
  http://localhost:5000/api/admin/upload

# 2. Verificar estado de procesamiento
curl http://localhost:5000/api/admin/executions?casilla_id=1&limit=1
```

### Configurar Nueva Materialización

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Export PostgreSQL",
    "tipo_destino": "database",
    "estrategia_actualizacion": "upsert",
    "configuracion_destino": {
      "tipo_bd": "postgresql",
      "host": "localhost",
      "puerto": 5432,
      "base_datos": "analytics",
      "tabla": "ventas_processed"
    }
  }' \
  http://localhost:5000/api/admin/materializations
```

Esta documentación cubre los endpoints principales. Para endpoints específicos adicionales, consultar el código fuente en `/src/pages/api/`.
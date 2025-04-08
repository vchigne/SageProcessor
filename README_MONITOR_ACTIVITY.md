# Sistema de Monitoreo de Actividad SAGE

## Descripción

El sistema de monitoreo de actividad SAGE proporciona un registro centralizado de todas las operaciones relacionadas con el procesamiento de archivos, tanto a través de SFTP como de correo electrónico. Permite realizar un seguimiento detallado de las actividades y generar informes periódicos.

## Características Principales

- **Registro Unificado**: Centraliza los logs de todas las operaciones SFTP y Email.
- **Estadísticas en Tiempo Real**: Mantiene contadores actualizados de archivos procesados, correos recibidos, etc.
- **Reportes Detallados**: Genera informes HTML y JSON con métricas de actividad.
- **Notificaciones por Email**: Envía informes periódicos a direcciones configuradas.
- **Segmentación por Casilla**: Permite ver estadísticas detalladas por cada casilla.

## Implementación

El sistema consta de una clase principal `LogManager` que proporciona los siguientes métodos:

### Registro de Actividades

- `log_sftp_activity()`: Registra actividades relacionadas con SFTP.
- `log_email_activity()`: Registra actividades relacionadas con correo electrónico.

### Generación de Informes

- `generate_activity_report()`: Genera un informe completo de actividad.
- `send_report_email()`: Envía un informe por correo electrónico.

## Datos Registrados

### Para SFTP

- Archivos procesados
- Archivos procesados exitosamente
- Archivos con errores
- Último archivo procesado
- Tiempo de último procesamiento
- Estadísticas por casilla

### Para Email

- Correos recibidos
- Correos procesados
- Correos con adjuntos
- Remitentes no autorizados
- Último correo procesado
- Tiempo de último procesamiento
- Estadísticas por casilla

## Configuración

El sistema se configura mediante un diccionario de configuración que puede incluir:

```python
config = {
    'log_file': 'sage_daemon2_activity.log',  # Archivo de log principal
    'save_details': True,                     # Guardar detalles en archivos separados
    'details_dir': 'logs/details',            # Directorio para logs detallados
    'report_schedule': {                      # Programación de informes
        'daily': True,                        
        'weekly': True,
        'monthly': True
    },
    'report_recipients': [                    # Destinatarios de informes
        'admin@example.com',
        'operations@example.com'
    ]
}
```

## Integración con SAGE Daemon 2

Para integrar el sistema de monitoreo con SAGE Daemon 2:

1. Crear una instancia de `LogManager` en la inicialización del daemon.
2. Llamar a los métodos de registro en los puntos apropiados del código.
3. Configurar la generación automática de informes.

## Ejemplo de Uso

```python
from sftp_email_log import LogManager

# Crear instancia de LogManager
log_manager = LogManager(config)

# Registrar actividad SFTP
log_manager.log_sftp_activity(
    activity_type='process',
    file_name='datos.csv',
    casilla_id=45,
    status='Processing file'
)

# Registrar actividad de correo
log_manager.log_email_activity(
    activity_type='receive',
    email_address='sender@example.com',
    casilla_id=45,
    has_attachments=True,
    status='Email received'
)

# Generar y enviar informe
smtp_config = {
    'servidor_salida': 'smtp.example.com',
    'puerto_salida': 587,
    'usuario': 'user@example.com',
    'password': 'password',
    'usar_tls_salida': True
}

log_manager.send_report_email(
    to_address='admin@example.com',
    smtp_config=smtp_config,
    report_type='all'
)
```

## Formato de Informes

### Informe HTML

El informe HTML incluye:

- Encabezado con fecha y hora de generación
- Sección de estadísticas SFTP
- Sección de estadísticas Email
- Tablas detalladas por casilla
- Estilo CSS para una presentación clara

### Informe JSON

El informe JSON contiene toda la información estadística en un formato estructurado para su procesamiento automático.

## Beneficios

- **Visibilidad completa**: Proporciona una visión general del funcionamiento del sistema.
- **Diagnóstico rápido**: Facilita la identificación de problemas.
- **Auditoría**: Mantiene un registro histórico de todas las operaciones.
- **Métricas operativas**: Permite evaluar el rendimiento del sistema.

## Extensiones Futuras

- Interfaz web para visualización de estadísticas en tiempo real.
- Alertas automatizadas basadas en umbrales configurables.
- Retención configurable de logs históricos.
- Dashboard con gráficos de tendencias.
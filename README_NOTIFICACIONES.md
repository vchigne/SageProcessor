# Notificaciones en SAGE

## Descripción

El sistema de notificaciones de SAGE permite enviar alertas y reportes sobre los eventos de procesamiento a diferentes destinatarios según sus preferencias. Este módulo ha sido optimizado para usar una cuenta administrativa centralizada para enviar todas las notificaciones del sistema.

## Características principales

- **Configuración centralizada**: Las credenciales de correo electrónico se obtienen desde la base de datos, priorizando cuentas con propósito "admin".
- **Diferentes frecuencias**: Soporta notificaciones inmediatas, diarias, semanales y mensuales.
- **Niveles de detalle**: Permite configurar el nivel de detalle de las notificaciones (detallado, resumido por emisor, resumido por casilla).
- **Filtros por tipo de evento**: Cada suscripción puede filtrar qué tipos de eventos desea recibir (error, warning, info, success).
- **Filtros por emisor**: Es posible configurar suscripciones para recibir solo eventos de emisores específicos.
- **Historial de notificaciones**: El sistema registra cuándo fue la última notificación enviada para cada suscripción.

## Flujo de trabajo

1. El sistema procesa archivos a través de SFTP o Email.
2. Se registran eventos de procesamiento en la base de datos.
3. El Notificador consulta las suscripciones activas que coinciden con los criterios del evento.
4. Se genera el contenido de la notificación según el nivel de detalle configurado.
5. Se envía el email utilizando la cuenta administrativa configurada.
6. Se actualiza la fecha de última notificación para la suscripción.

## Estructura de la base de datos

### Tabla `email_configuraciones`

Almacena la configuración de las cuentas de correo electrónico utilizadas por el sistema.

| Campo | Descripción |
|-------|-------------|
| id | Identificador único |
| email | Dirección de email |
| nombre | Nombre de la cuenta |
| servidor | Servidor SMTP |
| puerto | Puerto SMTP |
| usuario | Usuario de autenticación |
| password | Contraseña de autenticación |
| usar_tls | Si debe usar TLS |
| proposito | Propósito de la cuenta (admin, notificaciones, etc.) |
| estado | Estado de la cuenta (activo, pendiente, inactivo) |

### Tabla `suscripciones`

Almacena las suscripciones a notificaciones.

| Campo | Descripción |
|-------|-------------|
| id | Identificador único |
| nombre | Nombre del suscriptor |
| email | Email del suscriptor |
| telefono | Teléfono del suscriptor (opcional) |
| activo | Si la suscripción está activa |
| frecuencia | Frecuencia de notificación (inmediata, diaria, semanal, mensual) |
| dia_envio | Día de envío para frecuencias semanales o mensuales |
| hora_envio | Hora de envío para frecuencias diarias, semanales o mensuales |
| nivel_detalle | Nivel de detalle de la notificación (detallado, resumido_emisor, resumido_casilla) |
| tipos_evento | Tipos de eventos de interés (JSON array) |
| metodo_envio | Método de envío (email, webhook, sms) |
| webhook_url | URL del webhook (si aplica) |
| emisores | Emisores de interés (JSON array, opcional) |
| casilla_id | ID de la casilla (opcional) |
| last_notification_at | Fecha de la última notificación enviada |

## Cómo configurar una cuenta administrativa para notificaciones

1. Insertar o actualizar una cuenta en la tabla `email_configuraciones` con el campo `proposito` establecido como "admin":

```sql
UPDATE email_configuraciones 
SET proposito = 'admin', estado = 'activo' 
WHERE email = 'info@sage.vidahub.ai';
```

2. Asegurarse de que la cuenta esté activa con `estado = 'activo'`.

## Cómo añadir una nueva suscripción

```sql
INSERT INTO suscripciones (
    nombre, email, activo, frecuencia, nivel_detalle, 
    tipos_evento, casilla_id, emisores
)
VALUES (
    'Nombre Suscriptor', 
    'email@ejemplo.com', 
    TRUE, 
    'inmediata', 
    'detallado', 
    '["error", "warning", "info", "success"]', 
    45, 
    '[]'
);
```

## Ejemplos de uso

### Obtener notificaciones solo de errores

```sql
INSERT INTO suscripciones (
    nombre, email, activo, frecuencia, nivel_detalle, 
    tipos_evento, casilla_id
)
VALUES (
    'Alertas de Errores', 
    'alertas@ejemplo.com', 
    TRUE, 
    'inmediata', 
    'detallado', 
    '["error"]', 
    NULL
);
```

### Resumen diario de actividad

```sql
INSERT INTO suscripciones (
    nombre, email, activo, frecuencia, nivel_detalle, 
    tipos_evento, hora_envio
)
VALUES (
    'Resumen Diario', 
    'reporte@ejemplo.com', 
    TRUE, 
    'diaria', 
    'resumido_emisor', 
    '["error", "warning", "info", "success"]', 
    '18'
);
```

### Notificaciones por WhatsApp (webhook)

```sql
INSERT INTO suscripciones (
    nombre, activo, frecuencia, nivel_detalle, 
    tipos_evento, metodo_envio, webhook_url
)
VALUES (
    'Alertas por WhatsApp', 
    TRUE, 
    'inmediata', 
    'resumido_casilla', 
    '["error", "warning"]', 
    'webhook', 
    'https://webhook.ejemplo.com/whatsapp'
);
```

## Pruebas

Para probar el sistema de notificaciones, puede usar los siguientes scripts:

1. `test_notificaciones.py`: Prueba completa del sistema de notificaciones.
2. `test_suscripcion_especifica.py`: Prueba una suscripción específica enviando eventos de prueba.
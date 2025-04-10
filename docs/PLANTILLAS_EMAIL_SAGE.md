# Sistema de Plantillas de Email SAGE

## Introducción

El Sistema de Plantillas de Email SAGE es una solución diseñada para proporcionar flexibilidad, personalización y consistencia en las comunicaciones por correo electrónico del sistema SAGE. Este documento describe la arquitectura, componentes y funcionalidades principales del sistema.

## Objetivos

- **Flexibilidad**: Permitir diferentes estilos y formatos de email según el contexto y propósito.
- **Personalización**: Ofrecer contenidos personalizados según las preferencias del suscriptor.
- **Extensibilidad**: Facilitar la extensión a otros canales de comunicación (WhatsApp, Telegram, etc.)
- **Compatibilidad**: Mantener compatibilidad con el sistema existente mediante plantillas predeterminadas.

## Arquitectura

El sistema se ha implementado siguiendo un enfoque modular y extensible, con los siguientes componentes principales:

### Componentes Core

1. **TemplateManager**: 
   - Gestor central de plantillas que maneja la carga, almacenamiento y recuperación de plantillas.
   - Responsable de la caché y optimización del acceso a plantillas.
   - Gestiona plantillas predeterminadas y específicas por suscriptor.

2. **TemplateRenderer**: 
   - Motor de renderizado de plantillas que procesa el contenido con variables dinámicas.
   - Maneja la interpolación de variables y sanitización del contenido.
   - Genera versiones HTML y texto plano según necesidad.

3. **NotificadorAdapter**: 
   - Adaptador para integrar el sistema de plantillas con el Notificador existente.
   - Proporciona una capa de compatibilidad para garantizar cero impacto en el sistema actual.
   - Prepara los contextos necesarios para cada tipo de plantilla.

### Diagrama de Componentes

```
                     ┌─────────────────┐
                     │    Notificador  │
                     └────────┬────────┘
                              │
                              ▼
┌─────────────────┐   ┌─────────────────┐
│ Template Manager │◄──┤NotificadorAdapter│
└────────┬────────┘   └─────────────────┘
         │
         ▼
┌─────────────────┐
│TemplateRenderer │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Base de Datos  │
└─────────────────┘
```

## Esquema de Base de Datos

### Tabla: plantillas_email

```sql
CREATE TABLE plantillas_email (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL, -- 'notificacion', 'respuesta_daemon', etc.
    subtipo VARCHAR(50), -- 'detallado', 'resumido_emisor', etc.
    variante VARCHAR(50) DEFAULT 'standard', -- 'standard', 'marketing', etc.
    canal VARCHAR(50) DEFAULT 'email', -- 'email', 'whatsapp', 'telegram', etc.
    idioma VARCHAR(10) DEFAULT 'es',
    asunto VARCHAR(200), -- Para email
    contenido_html TEXT, -- Para email
    contenido_texto TEXT, -- Versión texto plano
    es_predeterminada BOOLEAN DEFAULT FALSE, -- Si es la plantilla predeterminada
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creador_id INTEGER,
    version INTEGER DEFAULT 1,
    estado VARCHAR(20) DEFAULT 'activo' -- 'activo', 'borrador', 'inactivo'
);
```

### Modificación de Tabla: suscripciones

```sql
ALTER TABLE suscripciones ADD COLUMN plantilla_id INTEGER REFERENCES plantillas_email(id);
```

## Tipos de Plantillas

El sistema actual contempla los siguientes tipos principales de plantillas:

### 1. Notificaciones
- **Detalladas**: Incluyen todos los detalles de los eventos
  - Muestra una tabla completa con cada evento, su tipo, emisor y mensaje.
  - Adecuada para usuarios que necesitan información detallada.

- **Resumidas por emisor**: Agrupan eventos del mismo emisor
  - Resume los eventos agrupándolos por emisor.
  - Muestra contadores para cada tipo de evento (error, warning, info, success).
  - Ideal para supervisores o administradores de sistemas.

- **Resumidas por casilla**: Muestran resumen estadístico por casilla
  - Ofrece un resumen general del estado de una casilla específica.
  - Presenta contadores globales de cada tipo de evento.
  - Adecuada para reportes ejecutivos o informes de estado.

### 2. Respuestas del Daemon
- **Remitente no autorizado**: Para responder a remitentes desconocidos
  - Informa al remitente que no está autorizado para utilizar el sistema.
  - Incluye instrucciones sobre cómo solicitar autorización.

- **Falta de adjunto**: Cuando se recibe un email sin archivos adjuntos
  - Notifica al remitente que no se detectó ningún adjunto para procesar.
  - Solicita reenvío del mensaje con los archivos necesarios.

- **Formato inválido**: Para notificar sobre formatos incompatibles
  - Informa sobre problemas con el formato de los archivos.
  - Proporciona guías sobre formatos aceptados.

## Sistema de Variables

Las plantillas soportan variables dinámicas que se reemplazan con valores contextuales:

- **Formato**: `{{ nombre_variable }}` o `{{nombre_variable}}`

### Variables Comunes

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{{ fecha }}` | Fecha y hora actual | 10/04/2025 15:30 |
| `{{ portal_nombre }}` | Nombre del portal | SAGE |
| `{{ casilla_nombre }}` | Nombre de la casilla | Validación de Datos |
| `{{ email_remitente }}` | Email del remitente | usuario@ejemplo.com |
| `{{ email_casilla }}` | Email de la casilla | procesamiento@sage.com |
| `{{ asunto_original }}` | Asunto del email original | Procesamiento de archivo mensual |
| `{{ evento_resumen }}` | Resumen breve de eventos | 3 errores, 2 advertencias |

### Variables Específicas por Tipo de Plantilla

#### Notificación Detallada
- `{{ detalle_eventos }}`: HTML con tabla de eventos detallados
- `{{ detalle_eventos_texto }}`: Versión texto plano de eventos

#### Notificación Resumida por Emisor
- `{{ resumen_emisor }}`: HTML con tabla de resumen por emisor
- `{{ resumen_emisor_texto }}`: Versión texto plano

#### Notificación Resumida por Casilla
- `{{ resumen_casilla }}`: HTML con tabla de resumen por casilla
- `{{ resumen_casilla_texto }}`: Versión texto plano

## Integraciones

### Integración con Notificador

El sistema se integra con el Notificador existente a través del adaptador NotificadorAdapter, que permite una transición gradual sin romper funcionalidades existentes.

```python
# En el Notificador
def _generar_contenido_notificacion(...):
    # Primero intenta con el sistema de plantillas
    if HAS_TEMPLATE_SYSTEM and self.template_adapter:
        try:
            asunto, contenido_html = self.template_adapter.generar_contenido_notificacion(...)
            if asunto and contenido_html:
                return asunto, contenido_html
        except Exception:
            # Si falla, continúa con el método tradicional
            pass
    
    # Método tradicional (preserva compatibilidad)
    # ...
```

### Integración con Daemon 2

El sistema se puede integrar con SAGE Daemon 2 para gestionar respuestas automáticas, adaptando su gestión de plantillas.

## Personalización por Suscriptor

Una característica clave es la capacidad de asignar plantillas específicas a suscriptores individuales, permitiendo personalizar las comunicaciones según sus preferencias y necesidades.

Los pasos para asignar una plantilla a un suscriptor son:

1. Identificar o crear la plantilla deseada
2. Asignar la plantilla al suscriptor mediante el TemplateManager:
   ```python
   template_manager.assign_template_to_subscriber(subscriber_id, template_id)
   ```
3. El sistema utilizará automáticamente esta plantilla al generar notificaciones para ese suscriptor.

## Futuras Extensiones

El sistema está diseñado para soportar futuras extensiones, como:

1. **Canales adicionales**: 
   - WhatsApp, Telegram, SMS
   - Cada canal podría tener sus propios requisitos de formato y longitud

2. **Variantes de plantillas**: 
   - Marketing: Diseño más visual y atractivo
   - Técnicas: Con mayor nivel de detalle técnico
   - Simplificadas: Versiones minimalistas para dispositivos móviles

3. **Internacionalización**:
   - Soporte para múltiples idiomas
   - Adaptación cultural de mensajes

4. **Editor visual**:
   - Interfaz gráfica para edición de plantillas
   - Vista previa en tiempo real
   - Biblioteca de componentes reutilizables

## Cómo Usar el Sistema

### Obtener una Plantilla

```python
# Ejemplo de uso del TemplateManager
from sage.templates.email.template_manager import TemplateManager

# Inicializar el gestor
manager = TemplateManager()

# Obtener una plantilla específica
template = manager.get_template(
    template_type='notificacion',
    subtype='detallado',
    variant='standard',
    language='es',
    channel='email'
)

# Obtener la plantilla para un suscriptor específico
subscriber_template = manager.get_template_for_subscriber(
    subscriber_id=123,
    template_type='notificacion',
    subtype='detallado'
)
```

### Renderizar una Plantilla

```python
# Ejemplo de renderizado
from sage.templates.email.template_renderer import TemplateRenderer

# Inicializar el renderizador
renderer = TemplateRenderer()

# Preparar el contexto
context = {
    'fecha': '10/04/2025 15:30',
    'portal_nombre': 'SAGE',
    'casilla_nombre': 'Validación de Datos',
    'detalle_eventos': '...' # HTML con el detalle de eventos
}

# Renderizar la plantilla
subject = renderer.render_subject(template, context)
html_content, text_content = renderer.render(template, context)
```

### Usar el Adaptador con el Notificador

```python
# Ejemplo de uso del adaptador
from sage.templates.email.notificador_adapter import NotificadorAdapter

# Inicializar el adaptador
adapter = NotificadorAdapter()

# Generar contenido para notificación
asunto, contenido_html = adapter.generar_contenido_notificacion(
    eventos=lista_eventos,
    nivel_detalle='detallado',
    portal_id=None,
    casilla_id=123,
    suscriptor_id=456
)
```

## Recomendaciones

1. **Mantenimiento de plantillas predeterminadas**: 
   - Es importante mantener actualizadas las plantillas predeterminadas para garantizar la consistencia.
   - Revisar periódicamente las plantillas predeterminadas para asegurar su relevancia.

2. **Variables contextuales**: 
   - Al crear nuevas plantillas, asegurarse de documentar las variables que requiere cada tipo.
   - Mantener un registro centralizado de variables disponibles para cada tipo de plantilla.

3. **Pruebas de renderizado**: 
   - Probar el renderizado de plantillas con diferentes contextos para garantizar su correcta visualización.
   - Verificar la compatibilidad con diferentes clientes de email.

4. **Migración gradual**: 
   - Implementar el sistema de forma gradual, empezando por nuevas funcionalidades.
   - Monitorear el rendimiento y obtener feedback de los usuarios.

## Conclusión

El Sistema de Plantillas de Email SAGE proporciona una solución flexible y extensible para la gestión de comunicaciones. Su diseño modular permite una integración suave con los sistemas existentes y sienta las bases para futuras expansiones hacia múltiples canales de comunicación.
"""
Inicializador de la base de datos para el sistema de plantillas de email

Este módulo proporciona funciones para inicializar la base de datos del sistema de plantillas,
creando las tablas necesarias y cargando plantillas predeterminadas.
"""

import logging
import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

logger = logging.getLogger(__name__)

def get_db_connection():
    """
    Establece conexión con la base de datos PostgreSQL
    
    Returns:
        connection: Conexión a la base de datos PostgreSQL
    """
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("No se ha configurado DATABASE_URL en el entorno")
        
    return psycopg2.connect(database_url)

def create_tables(conn=None):
    """
    Crea las tablas necesarias para el sistema de plantillas
    
    Args:
        conn: Conexión a la base de datos (opcional)
    """
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True
        
    try:
        with conn.cursor() as cursor:
            # Crear tabla de plantillas si no existe
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS plantillas_email (
                    id SERIAL PRIMARY KEY,
                    nombre VARCHAR(100) NOT NULL,
                    descripcion TEXT,
                    tipo VARCHAR(50) NOT NULL,
                    subtipo VARCHAR(50),
                    variante VARCHAR(50) DEFAULT 'standard',
                    canal VARCHAR(50) DEFAULT 'email',
                    idioma VARCHAR(10) DEFAULT 'es',
                    asunto VARCHAR(200),
                    contenido_html TEXT,
                    contenido_texto TEXT,
                    es_predeterminada BOOLEAN DEFAULT FALSE,
                    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    creador_id INTEGER,
                    version INTEGER DEFAULT 1,
                    estado VARCHAR(20) DEFAULT 'activo',
                    UNIQUE(tipo, subtipo, variante, canal, idioma, es_predeterminada)
                )
            """)
            
            # Agregar comentarios a la tabla y columnas
            try:
                cursor.execute("""
                    COMMENT ON TABLE plantillas_email IS 'Almacena plantillas para comunicaciones por email y otros canales'
                """)
                
                cursor.execute("""
                    COMMENT ON COLUMN plantillas_email.tipo IS 'Tipo principal de la plantilla (notificacion, respuesta_daemon, etc.)'
                """)
                
                cursor.execute("""
                    COMMENT ON COLUMN plantillas_email.subtipo IS 'Subtipo específico (detallado, resumido_emisor, etc.)'
                """)
                
                cursor.execute("""
                    COMMENT ON COLUMN plantillas_email.es_predeterminada IS 'Indica si esta es la plantilla predeterminada para su tipo/subtipo'
                """)
            except Exception as e:
                logger.warning(f"No se pudieron agregar comentarios a la tabla: {e}")
                # Continuar con la ejecución, esto no es crítico
            
            # Verificar si existe la tabla suscripciones antes de añadir la columna
            cursor.execute("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suscripciones') THEN
                        -- Verificar si la columna ya existe antes de intentar crearla
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                      WHERE table_name = 'suscripciones' AND column_name = 'plantilla_id') THEN
                            ALTER TABLE suscripciones ADD COLUMN plantilla_id INTEGER REFERENCES plantillas_email(id);
                            COMMENT ON COLUMN suscripciones.plantilla_id IS 'Referencia a la plantilla preferida del suscriptor';
                        END IF;
                    END IF;
                END $$;
            """)
            
            # Crear índices para optimizar consultas
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_plantillas_email_tipo_subtipo 
                ON plantillas_email(tipo, subtipo)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_plantillas_email_predeterminada 
                ON plantillas_email(es_predeterminada)
            """)
            
            conn.commit()
            logger.info("Tablas creadas correctamente")
            
    except Exception as e:
        logger.error(f"Error al crear tablas: {e}")
        conn.rollback()
        raise
        
    finally:
        if close_conn and conn:
            conn.close()

def load_default_templates(conn=None):
    """
    Carga las plantillas predeterminadas en la base de datos
    
    Args:
        conn: Conexión a la base de datos (opcional)
    """
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True
        
    try:
        with conn.cursor() as cursor:
            # Verificar si ya existen plantillas
            cursor.execute("SELECT COUNT(*) FROM plantillas_email")
            result = cursor.fetchone()
            count = result[0] if result else 0
            
            if count > 0:
                logger.info(f"Ya existen {count} plantillas, no se cargarán predeterminadas")
                return
                
            logger.info("Cargando plantillas predeterminadas")
            
            # Plantilla de notificación detallada
            cursor.execute("""
                INSERT INTO plantillas_email (
                    nombre, descripcion, tipo, subtipo, variante, 
                    canal, idioma, asunto, contenido_html, contenido_texto, 
                    es_predeterminada
                ) VALUES (
                    'Notificación Detallada', 
                    'Plantilla para notificaciones con detalle completo de eventos',
                    'notificacion',
                    'detallado',
                    'standard',
                    'email',
                    'es',
                    'SAGE Notificación: Eventos de {{casilla_nombre}}',
                    %s,
                    %s,
                    TRUE
                )
            """, (TEMPLATE_DETALLADO_HTML, TEMPLATE_DETALLADO_TEXTO))
            
            # Plantilla de notificación resumida por emisor
            cursor.execute("""
                INSERT INTO plantillas_email (
                    nombre, descripcion, tipo, subtipo, variante, 
                    canal, idioma, asunto, contenido_html, contenido_texto, 
                    es_predeterminada
                ) VALUES (
                    'Notificación Resumida por Emisor', 
                    'Plantilla para notificaciones con resumen por emisor',
                    'notificacion',
                    'resumido_emisor',
                    'standard',
                    'email',
                    'es',
                    'SAGE Resumen: Eventos por Emisor - {{casilla_nombre}}',
                    %s,
                    %s,
                    TRUE
                )
            """, (TEMPLATE_RESUMIDO_EMISOR_HTML, TEMPLATE_RESUMIDO_EMISOR_TEXTO))
            
            # Plantilla de notificación resumida por casilla
            cursor.execute("""
                INSERT INTO plantillas_email (
                    nombre, descripcion, tipo, subtipo, variante, 
                    canal, idioma, asunto, contenido_html, contenido_texto, 
                    es_predeterminada
                ) VALUES (
                    'Notificación Resumida por Casilla', 
                    'Plantilla para notificaciones con resumen general de casilla',
                    'notificacion',
                    'resumido_casilla',
                    'standard',
                    'email',
                    'es',
                    'SAGE Resumen: Estado de Casilla {{casilla_nombre}}',
                    %s,
                    %s,
                    TRUE
                )
            """, (TEMPLATE_RESUMIDO_CASILLA_HTML, TEMPLATE_RESUMIDO_CASILLA_TEXTO))
            
            # Plantilla de respuesta: Remitente no autorizado
            cursor.execute("""
                INSERT INTO plantillas_email (
                    nombre, descripcion, tipo, subtipo, variante, 
                    canal, idioma, asunto, contenido_html, contenido_texto, 
                    es_predeterminada
                ) VALUES (
                    'Respuesta: Remitente No Autorizado', 
                    'Respuesta automática para remitentes no autorizados',
                    'respuesta_daemon',
                    'remitente_no_autorizado',
                    'standard',
                    'email',
                    'es',
                    'SAGE: Remitente no autorizado',
                    %s,
                    %s,
                    TRUE
                )
            """, (TEMPLATE_REMITENTE_NO_AUTORIZADO_HTML, TEMPLATE_REMITENTE_NO_AUTORIZADO_TEXTO))
            
            # Plantilla de respuesta: Sin adjunto
            cursor.execute("""
                INSERT INTO plantillas_email (
                    nombre, descripcion, tipo, subtipo, variante, 
                    canal, idioma, asunto, contenido_html, contenido_texto, 
                    es_predeterminada
                ) VALUES (
                    'Respuesta: Sin Adjunto', 
                    'Respuesta automática para correos sin archivos adjuntos',
                    'respuesta_daemon',
                    'sin_adjunto',
                    'standard',
                    'email',
                    'es',
                    'SAGE: No se encontraron adjuntos en su mensaje',
                    %s,
                    %s,
                    TRUE
                )
            """, (TEMPLATE_SIN_ADJUNTO_HTML, TEMPLATE_SIN_ADJUNTO_TEXTO))
            
            conn.commit()
            logger.info("Plantillas predeterminadas cargadas correctamente")
            
    except Exception as e:
        logger.error(f"Error al cargar plantillas predeterminadas: {e}")
        conn.rollback()
        raise
        
    finally:
        if close_conn and conn:
            conn.close()

# Templates para notificación detallada
TEMPLATE_DETALLADO_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAGE Notificación</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 10px 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6c757d; text-align: center; }
        h1 { margin: 0; font-size: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e9ecef; }
        th { background-color: #e9ecef; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #007bff; }
        .success { color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{portal_nombre}} - Notificación</h1>
        </div>
        <div class="content">
            <p>Este es un mensaje automático del sistema de notificaciones de <strong>{{portal_nombre}}</strong>.</p>
            <p>Se han detectado los siguientes eventos para la casilla <strong>{{casilla_nombre}}</strong> que requieren su atención:</p>
            
            <table>
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Emisor</th>
                        <th>Mensaje</th>
                        <th>Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    {{detalle_eventos}}
                </tbody>
            </table>
            
            <p>Fecha y hora del reporte: {{fecha}}</p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
            <p>&copy; {{portal_nombre}} - Sistema Automático de Gestión de Eventos</p>
        </div>
    </div>
</body>
</html>
"""

TEMPLATE_DETALLADO_TEXTO = """
{{portal_nombre}} - NOTIFICACIÓN

Este es un mensaje automático del sistema de notificaciones de {{portal_nombre}}.

Se han detectado los siguientes eventos para la casilla {{casilla_nombre}} que requieren su atención:

DETALLE DE EVENTOS:
{{detalle_eventos_texto}}

Fecha y hora del reporte: {{fecha}}

---
Este es un mensaje automático, por favor no responda a este correo.
© {{portal_nombre}} - Sistema Automático de Gestión de Eventos
"""

# Templates para notificación resumida por emisor
TEMPLATE_RESUMIDO_EMISOR_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAGE Resumen por Emisor</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 10px 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6c757d; text-align: center; }
        h1 { margin: 0; font-size: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e9ecef; }
        th { background-color: #e9ecef; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #007bff; }
        .success { color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{portal_nombre}} - Resumen por Emisor</h1>
        </div>
        <div class="content">
            <p>Este es un mensaje automático del sistema de notificaciones de <strong>{{portal_nombre}}</strong>.</p>
            <p>A continuación se presenta un resumen de eventos por emisor para la casilla <strong>{{casilla_nombre}}</strong>:</p>
            
            <table>
                <thead>
                    <tr>
                        <th>Emisor</th>
                        <th>Errores</th>
                        <th>Advertencias</th>
                        <th>Info</th>
                        <th>Exitosos</th>
                    </tr>
                </thead>
                <tbody>
                    {{resumen_emisor}}
                </tbody>
            </table>
            
            <p>Total de eventos: {{evento_resumen}}</p>
            <p>Fecha y hora del reporte: {{fecha}}</p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
            <p>&copy; {{portal_nombre}} - Sistema Automático de Gestión de Eventos</p>
        </div>
    </div>
</body>
</html>
"""

TEMPLATE_RESUMIDO_EMISOR_TEXTO = """
{{portal_nombre}} - RESUMEN POR EMISOR

Este es un mensaje automático del sistema de notificaciones de {{portal_nombre}}.

A continuación se presenta un resumen de eventos por emisor para la casilla {{casilla_nombre}}:

{{resumen_emisor_texto}}

Total de eventos: {{evento_resumen}}
Fecha y hora del reporte: {{fecha}}

---
Este es un mensaje automático, por favor no responda a este correo.
© {{portal_nombre}} - Sistema Automático de Gestión de Eventos
"""

# Templates para notificación resumida por casilla
TEMPLATE_RESUMIDO_CASILLA_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAGE Estado de Casilla</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 10px 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6c757d; text-align: center; }
        h1 { margin: 0; font-size: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e9ecef; }
        th { background-color: #e9ecef; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #007bff; }
        .success { color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{portal_nombre}} - Estado de Casilla</h1>
        </div>
        <div class="content">
            <p>Este es un mensaje automático del sistema de notificaciones de <strong>{{portal_nombre}}</strong>.</p>
            <p>Resumen del estado actual de la casilla <strong>{{casilla_nombre}}</strong>:</p>
            
            <table>
                <thead>
                    <tr>
                        <th>Tipo de Evento</th>
                        <th>Cantidad</th>
                    </tr>
                </thead>
                <tbody>
                    {{resumen_casilla}}
                </tbody>
            </table>
            
            <p>Total de eventos: {{evento_resumen}}</p>
            <p>Fecha y hora del reporte: {{fecha}}</p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
            <p>&copy; {{portal_nombre}} - Sistema Automático de Gestión de Eventos</p>
        </div>
    </div>
</body>
</html>
"""

TEMPLATE_RESUMIDO_CASILLA_TEXTO = """
{{portal_nombre}} - ESTADO DE CASILLA

Este es un mensaje automático del sistema de notificaciones de {{portal_nombre}}.

Resumen del estado actual de la casilla {{casilla_nombre}}:

{{resumen_casilla_texto}}

Total de eventos: {{evento_resumen}}
Fecha y hora del reporte: {{fecha}}

---
Este es un mensaje automático, por favor no responda a este correo.
© {{portal_nombre}} - Sistema Automático de Gestión de Eventos
"""

# Template para respuesta a remitente no autorizado
TEMPLATE_REMITENTE_NO_AUTORIZADO_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAGE - Remitente no autorizado</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc3545; color: white; padding: 10px 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6c757d; text-align: center; }
        h1 { margin: 0; font-size: 24px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{portal_nombre}} - Acceso no autorizado</h1>
        </div>
        <div class="content">
            <p>Estimado remitente,</p>
            <p>Hemos recibido un correo electrónico desde su dirección <strong>{{email_remitente}}</strong> dirigido a nuestra casilla <strong>{{email_casilla}}</strong> con el asunto "<em>{{asunto_original}}</em>".</p>
            <p>Lamentamos informarle que su dirección de correo electrónico no está autorizada para enviar mensajes a esta casilla del sistema {{portal_nombre}}.</p>
            <p>Si considera que esto es un error o necesita acceso, por favor contacte al administrador del sistema.</p>
            <p>Fecha y hora: {{fecha}}</p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
            <p>&copy; {{portal_nombre}} - Sistema Automático de Gestión de Eventos</p>
        </div>
    </div>
</body>
</html>
"""

TEMPLATE_REMITENTE_NO_AUTORIZADO_TEXTO = """
{{portal_nombre}} - ACCESO NO AUTORIZADO

Estimado remitente,

Hemos recibido un correo electrónico desde su dirección {{email_remitente}} dirigido a nuestra casilla {{email_casilla}} con el asunto "{{asunto_original}}".

Lamentamos informarle que su dirección de correo electrónico no está autorizada para enviar mensajes a esta casilla del sistema {{portal_nombre}}.

Si considera que esto es un error o necesita acceso, por favor contacte al administrador del sistema.

Fecha y hora: {{fecha}}

---
Este es un mensaje automático, por favor no responda a este correo.
© {{portal_nombre}} - Sistema Automático de Gestión de Eventos
"""

# Template para respuesta sin adjunto
TEMPLATE_SIN_ADJUNTO_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAGE - Sin adjuntos</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ffc107; color: #333; padding: 10px 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6c757d; text-align: center; }
        h1 { margin: 0; font-size: 24px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{portal_nombre}} - Sin archivos adjuntos</h1>
        </div>
        <div class="content">
            <p>Estimado remitente,</p>
            <p>Hemos recibido su correo electrónico con el asunto "<em>{{asunto_original}}</em>", pero no encontramos ningún archivo adjunto para procesar.</p>
            <p>Para que el sistema {{portal_nombre}} procese correctamente su solicitud, por favor reenvíe su mensaje incluyendo los archivos necesarios como adjuntos.</p>
            <p>Si necesita ayuda sobre cómo adjuntar archivos o qué formatos son aceptados, por favor contacte al administrador del sistema.</p>
            <p>Fecha y hora: {{fecha}}</p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
            <p>&copy; {{portal_nombre}} - Sistema Automático de Gestión de Eventos</p>
        </div>
    </div>
</body>
</html>
"""

TEMPLATE_SIN_ADJUNTO_TEXTO = """
{{portal_nombre}} - SIN ARCHIVOS ADJUNTOS

Estimado remitente,

Hemos recibido su correo electrónico con el asunto "{{asunto_original}}", pero no encontramos ningún archivo adjunto para procesar.

Para que el sistema {{portal_nombre}} procese correctamente su solicitud, por favor reenvíe su mensaje incluyendo los archivos necesarios como adjuntos.

Si necesita ayuda sobre cómo adjuntar archivos o qué formatos son aceptados, por favor contacte al administrador del sistema.

Fecha y hora: {{fecha}}

---
Este es un mensaje automático, por favor no responda a este correo.
© {{portal_nombre}} - Sistema Automático de Gestión de Eventos
"""
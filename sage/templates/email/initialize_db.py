"""
Script para inicializar la base de datos de plantillas de email

Este script crea las tablas necesarias para el sistema de plantillas
y carga las plantillas predeterminadas.
"""

import os
import sys
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def get_db_connection():
    """Obtiene una conexión a la base de datos PostgreSQL"""
    conn_string = os.environ.get('DATABASE_URL')
    if not conn_string:
        logger.error("No se ha configurado DATABASE_URL")
        raise ValueError("No se ha configurado DATABASE_URL")
    
    return psycopg2.connect(conn_string)

def create_tables(connection):
    """Crea las tablas necesarias para el sistema de plantillas"""
    cursor = connection.cursor()
    
    try:
        # Tabla de plantillas de email
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plantillas_email (
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
                estado VARCHAR(20) DEFAULT 'activo', -- 'activo', 'borrador', 'inactivo'
                UNIQUE(tipo, subtipo, variante, canal, idioma, es_predeterminada)
            )
        """)
        
        # Verificar si ya existe la columna plantilla_id en la tabla suscripciones
        cursor.execute("""
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'suscripciones' 
            AND column_name = 'plantilla_id'
        """)
        
        column_exists = cursor.fetchone()
        
        if not column_exists:
            # Añadir columna para referencia a plantilla preferida en suscripciones
            cursor.execute("""
                ALTER TABLE suscripciones 
                ADD COLUMN plantilla_id INTEGER REFERENCES plantillas_email(id)
            """)
        
        # Índices para optimizar consultas
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_plantillas_email_tipo_subtipo 
            ON plantillas_email(tipo, subtipo)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_plantillas_email_predeterminada 
            ON plantillas_email(es_predeterminada)
        """)
        
        # Comentarios para documentación
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
        
        connection.commit()
        logger.info("Tablas creadas correctamente")
        
    except Exception as e:
        connection.rollback()
        logger.error(f"Error al crear tablas: {e}")
        raise
    finally:
        cursor.close()

def load_default_templates(connection):
    """Carga las plantillas predeterminadas en la base de datos"""
    cursor = connection.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Verificar si ya existen plantillas predeterminadas
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM plantillas_email
            WHERE es_predeterminada = TRUE
        """)
        
        result = cursor.fetchone()
        
        if result and result['count'] > 0:
            logger.info(f"Ya existen {result['count']} plantillas predeterminadas")
            return
        
        # Plantilla predeterminada para notificación detallada
        cursor.execute("""
            INSERT INTO plantillas_email (
                nombre, descripcion, tipo, subtipo, variante, 
                canal, idioma, asunto, contenido_html, contenido_texto,
                es_predeterminada, estado
            ) VALUES (
                'Notificación Detallada', 
                'Plantilla predeterminada para notificaciones con detalle completo de eventos',
                'notificacion', 
                'detallado', 
                'standard',
                'email', 
                'es', 
                'SAGE - Notificación: {{ evento_resumen }}',
                %s,
                %s,
                TRUE, 
                'activo'
            )
        """, (
            """<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }
        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .error { color: #e53e3e; }
        .warning { color: #dd6b20; }
        .info { color: #3182ce; }
        .success { color: #38a169; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Notificación SAGE</h2>
        <p>Fecha: {{ fecha }}</p>
    </div>
    
    <div class="content">
        <h3>Detalle de eventos</h3>
        <table>
            <tr>
                <th>Tipo</th>
                <th>Emisor</th>
                <th>Mensaje</th>
                <th>Fecha</th>
            </tr>
            {{ detalle_eventos }}
        </table>
    </div>
    
    <div class="footer">
        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>
    </div>
</body>
</html>""",
            """Notificación SAGE

Fecha: {{ fecha }}

Detalle de eventos:

{{ detalle_eventos_texto }}

Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo."""
        ))
        
        # Plantilla predeterminada para notificación resumida por emisor
        cursor.execute("""
            INSERT INTO plantillas_email (
                nombre, descripcion, tipo, subtipo, variante, 
                canal, idioma, asunto, contenido_html, contenido_texto,
                es_predeterminada, estado
            ) VALUES (
                'Notificación Resumida por Emisor', 
                'Plantilla predeterminada para notificaciones resumidas por emisor',
                'notificacion', 
                'resumido_emisor', 
                'standard',
                'email', 
                'es', 
                'SAGE - Resumen por emisor: {{ evento_resumen }}',
                %s,
                %s,
                TRUE, 
                'activo'
            )
        """, (
            """<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }
        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .error { color: #e53e3e; }
        .warning { color: #dd6b20; }
        .info { color: #3182ce; }
        .success { color: #38a169; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Resumen por Emisor</h2>
        <p>Fecha: {{ fecha }}</p>
    </div>
    
    <div class="content">
        <h3>Resumen por emisor</h3>
        <table>
            <tr>
                <th>Emisor</th>
                <th>Errores</th>
                <th>Advertencias</th>
                <th>Información</th>
                <th>Exitosos</th>
            </tr>
            {{ resumen_emisor }}
        </table>
    </div>
    
    <div class="footer">
        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>
    </div>
</body>
</html>""",
            """Resumen por Emisor SAGE

Fecha: {{ fecha }}

Resumen por emisor:

{{ resumen_emisor_texto }}

Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo."""
        ))
        
        # Plantilla predeterminada para notificación resumida por casilla
        cursor.execute("""
            INSERT INTO plantillas_email (
                nombre, descripcion, tipo, subtipo, variante, 
                canal, idioma, asunto, contenido_html, contenido_texto,
                es_predeterminada, estado
            ) VALUES (
                'Notificación Resumida por Casilla', 
                'Plantilla predeterminada para notificaciones resumidas por casilla',
                'notificacion', 
                'resumido_casilla', 
                'standard',
                'email', 
                'es', 
                'SAGE - Resumen de casilla: {{ casilla_nombre }}',
                %s,
                %s,
                TRUE, 
                'activo'
            )
        """, (
            """<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }
        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .error { color: #e53e3e; }
        .warning { color: #dd6b20; }
        .info { color: #3182ce; }
        .success { color: #38a169; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Resumen de Casilla: {{ casilla_nombre }}</h2>
        <p>Fecha: {{ fecha }}</p>
    </div>
    
    <div class="content">
        <h3>Resumen de eventos</h3>
        <table>
            <tr>
                <th>Tipo</th>
                <th>Cantidad</th>
            </tr>
            {{ resumen_casilla }}
        </table>
    </div>
    
    <div class="footer">
        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>
    </div>
</body>
</html>""",
            """Resumen de Casilla SAGE: {{ casilla_nombre }}

Fecha: {{ fecha }}

Resumen de eventos:

{{ resumen_casilla_texto }}

Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo."""
        ))
        
        # Plantilla predeterminada para respuestas de remitente no autorizado
        cursor.execute("""
            INSERT INTO plantillas_email (
                nombre, descripcion, tipo, subtipo, variante, 
                canal, idioma, asunto, contenido_html, contenido_texto,
                es_predeterminada, estado
            ) VALUES (
                'Respuesta de Remitente No Autorizado', 
                'Plantilla predeterminada para respuestas a remitentes no autorizados',
                'respuesta_daemon', 
                'remitente_no_autorizado', 
                'standard',
                'email', 
                'es', 
                'Re: {{ asunto_original }}',
                %s,
                %s,
                TRUE, 
                'activo'
            )
        """, (
            """<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }
        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }
        .highlight { background-color: #f9f9f9; padding: 10px; border-left: 4px solid #3182ce; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Respuesta Automática</h2>
    </div>
    
    <div class="content">
        <p>Estimado/a Usuario,</p>
        
        <p>¡Gracias por comunicarse con nosotros a través de {{ email_casilla }}!</p>
        
        <p>Queremos informarle que actualmente su dirección de correo electrónico ({{ email_remitente }}) no se encuentra en nuestra lista de remitentes autorizados para esta casilla. ¡Pero no se preocupe! Valoramos enormemente su interés en utilizar nuestros servicios de procesamiento de datos.</p>
        
        <div class="highlight">
            <p>Para brindarle una experiencia completa y personalizada con el Sistema SAGE, le invitamos a contactar a su administrador de sistema para solicitar su autorización. Una vez autorizado, podrá disfrutar de todas las ventajas y beneficios de nuestra plataforma de procesamiento automatizado:</p>
            
            <p>✓ Validación automática de archivos<br>
            ✓ Notificaciones en tiempo real<br>
            ✓ Reportes detallados de procesamiento<br>
            ✓ Integración con sus sistemas existentes</p>
        </div>
        
        <p>Si tiene alguna consulta o necesita asistencia adicional, nuestro equipo está siempre disponible para ayudarle. ¡Nos encantaría poder atenderle pronto como usuario autorizado!</p>
        
        <p>Gracias por su comprensión y por elegirnos.</p>
        
        <p>Atentamente,<br>
        El Equipo SAGE</p>
    </div>
    
    <div class="footer">
        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor contacte a su administrador para más información.</p>
    </div>
</body>
</html>""",
            """Estimado/a Usuario,

¡Gracias por comunicarse con nosotros a través de {{ email_casilla }}!

Queremos informarle que actualmente su dirección de correo electrónico ({{ email_remitente }}) no se encuentra en nuestra lista de remitentes autorizados para esta casilla. ¡Pero no se preocupe! Valoramos enormemente su interés en utilizar nuestros servicios de procesamiento de datos.

Para brindarle una experiencia completa y personalizada con el Sistema SAGE, le invitamos a contactar a su administrador de sistema para solicitar su autorización. Una vez autorizado, podrá disfrutar de todas las ventajas y beneficios de nuestra plataforma de procesamiento automatizado:

✓ Validación automática de archivos
✓ Notificaciones en tiempo real
✓ Reportes detallados de procesamiento
✓ Integración con sus sistemas existentes

Si tiene alguna consulta o necesita asistencia adicional, nuestro equipo está siempre disponible para ayudarle. ¡Nos encantaría poder atenderle pronto como usuario autorizado!

Gracias por su comprensión y por elegirnos.

Atentamente,
El Equipo SAGE

Este es un mensaje automático generado por el sistema SAGE. Por favor contacte a su administrador para más información."""
        ))
        
        # Plantilla predeterminada para respuestas de falta de adjunto
        cursor.execute("""
            INSERT INTO plantillas_email (
                nombre, descripcion, tipo, subtipo, variante, 
                canal, idioma, asunto, contenido_html, contenido_texto,
                es_predeterminada, estado
            ) VALUES (
                'Respuesta de Falta de Adjunto', 
                'Plantilla predeterminada para respuestas cuando falta un adjunto',
                'respuesta_daemon', 
                'falta_adjunto', 
                'standard',
                'email', 
                'es', 
                'Re: {{ asunto_original }}',
                %s,
                %s,
                TRUE, 
                'activo'
            )
        """, (
            """<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }
        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }
        .highlight { background-color: #f9f9f9; padding: 10px; border-left: 4px solid #dd6b20; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Respuesta Automática</h2>
    </div>
    
    <div class="content">
        <p>Estimado/a Usuario,</p>
        
        <p>Hemos recibido su mensaje en {{ email_casilla }}, pero no se encontró ningún archivo adjunto para procesar.</p>
        
        <div class="highlight">
            <p>Para que el sistema SAGE pueda procesar su solicitud, por favor reenvíe su mensaje incluyendo el archivo que desea procesar como adjunto.</p>
        </div>
        
        <p>Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.</p>
        
        <p>Saludos cordiales,<br>
        Sistema SAGE</p>
    </div>
    
    <div class="footer">
        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>
    </div>
</body>
</html>""",
            """Estimado/a Usuario,

Hemos recibido su mensaje en {{ email_casilla }}, pero no se encontró ningún archivo adjunto para procesar.

Para que el sistema SAGE pueda procesar su solicitud, por favor reenvíe su mensaje incluyendo el archivo que desea procesar como adjunto.

Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.

Saludos cordiales,
Sistema SAGE

Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo."""
        ))
        
        connection.commit()
        logger.info("Plantillas predeterminadas cargadas correctamente")
        
    except Exception as e:
        connection.rollback()
        logger.error(f"Error al cargar plantillas predeterminadas: {e}")
        raise
    finally:
        cursor.close()

def main():
    """Función principal"""
    try:
        logger.info("Inicializando base de datos de plantillas de email")
        
        connection = get_db_connection()
        
        # Crear tablas
        create_tables(connection)
        
        # Cargar plantillas predeterminadas
        load_default_templates(connection)
        
        logger.info("Base de datos de plantillas inicializada correctamente")
        
    except Exception as e:
        logger.error(f"Error al inicializar base de datos: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
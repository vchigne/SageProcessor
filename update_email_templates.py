#!/usr/bin/env python3
"""
Script para actualizar las plantillas de email con estructura compatible con React Email

Este script:
1. Conecta a la base de datos
2. Actualiza las plantillas existentes con estructura responsive basada en React Email
"""

import os
import sys
import logging
import argparse
import psycopg2

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def configurar_parser():
    """Configura el parser de argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(
        description='Actualiza las plantillas de email con estructura React Email'
    )
    parser.add_argument(
        '--force', 
        action='store_true',
        help='Forzar actualización aunque ya estén actualizadas'
    )
    return parser

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

def update_email_templates(conn, force=False):
    """
    Actualiza las plantillas de email con estructura React Email
    
    Args:
        conn: Conexión a la base de datos
        force: Forzar actualización aunque ya estén actualizadas
    """
    try:
        with conn.cursor() as cursor:
            # Verificar si hay plantillas para actualizar
            cursor.execute("SELECT id, nombre, tipo, subtipo FROM plantillas_email")
            templates = cursor.fetchall()
            
            if not templates:
                logger.warning("No se encontraron plantillas para actualizar")
                return
                
            logger.info(f"Se encontraron {len(templates)} plantillas")
            
            # Actualizar cada plantilla
            for template_id, nombre, tipo, subtipo in templates:
                logger.info(f"Actualizando plantilla {nombre} (ID: {template_id})")
                
                # Seleccionar el HTML apropiado según el tipo y subtipo
                if tipo == 'notificacion' and subtipo == 'detallado':
                    html_content = TEMPLATE_DETALLADO_HTML_REACT
                elif tipo == 'notificacion' and subtipo == 'resumido_emisor':
                    html_content = TEMPLATE_RESUMIDO_EMISOR_HTML_REACT
                elif tipo == 'notificacion' and subtipo == 'resumido_casilla':
                    html_content = TEMPLATE_RESUMIDO_CASILLA_HTML_REACT
                elif tipo == 'respuesta_daemon' and subtipo == 'remitente_no_autorizado':
                    html_content = TEMPLATE_REMITENTE_NO_AUTORIZADO_HTML_REACT
                elif tipo == 'respuesta_daemon' and (subtipo == 'sin_adjunto' or subtipo == 'falta_adjunto'):
                    html_content = TEMPLATE_SIN_ADJUNTO_HTML_REACT
                else:
                    logger.warning(f"No se encontró plantilla React Email para {tipo}/{subtipo}")
                    continue
                
                # Actualizar la plantilla en la base de datos
                cursor.execute("""
                    UPDATE plantillas_email
                    SET contenido_html = %s,
                        fecha_modificacion = CURRENT_TIMESTAMP,
                        version = version + 1
                    WHERE id = %s
                """, (html_content, template_id))
                
            conn.commit()
            logger.info("Plantillas actualizadas correctamente")
            
    except Exception as e:
        logger.error(f"Error al actualizar plantillas: {e}")
        conn.rollback()
        raise

def main():
    """Función principal"""
    parser = configurar_parser()
    args = parser.parse_args()
    
    try:
        # Establecer conexión con la base de datos
        logger.info("Conectando a la base de datos...")
        conn = get_db_connection()
        
        # Actualizar plantillas
        logger.info("Actualizando plantillas...")
        update_email_templates(conn, args.force)
        
        # Cerrar conexión
        conn.close()
        
        logger.info("Actualización completada correctamente")
        return 0
        
    except Exception as e:
        logger.error(f"Error durante la actualización: {e}")
        return 1

# Templates React Email compatible
TEMPLATE_DETALLADO_HTML_REACT = """
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>{{portal_nombre}} - Notificación</title>
    <style type="text/css">
        /* Base */
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; -webkit-text-size-adjust: none; -ms-text-size-adjust: none; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; line-height: 1.5; color: #333333; }
        
        /* Layout */
        .container { margin: 0 auto; width: 100%; max-width: 600px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        
        /* Typography */
        h1 { margin: 0; font-size: 24px; font-weight: 500; }
        p { margin: 16px 0; }
        
        /* Table */
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; }
        .table th { background-color: #e9ecef; }
        
        /* Colors */
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #007bff; }
        .success { color: #28a745; }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content { padding: 15px !important; }
            .table th, .table td { padding: 8px !important; }
        }
    </style>
</head>
<body>
    <table class="container" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
            <td align="center">
                <table class="header" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <h1>{{portal_nombre}} - Notificación</h1>
                        </td>
                    </tr>
                </table>
                <table class="content" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <p>Este es un mensaje automático del sistema de notificaciones de <strong>{{portal_nombre}}</strong>.</p>
                            <p>Se han detectado los siguientes eventos para la casilla <strong>{{casilla_nombre}}</strong> que requieren su atención:</p>
                            
                            <table class="table" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                                <tr>
                                    <th align="left">Tipo</th>
                                    <th align="left">Emisor</th>
                                    <th align="left">Mensaje</th>
                                    <th align="left">Fecha</th>
                                </tr>
                                {{detalle_eventos}}
                            </table>
                            
                            <p>Fecha y hora del reporte: {{fecha}}</p>
                        </td>
                    </tr>
                </table>
                <table class="footer" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td align="center">
                            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
                            <p>&copy; {{portal_nombre}} - Sistema Automático de Gestión de Eventos</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

TEMPLATE_RESUMIDO_EMISOR_HTML_REACT = """
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>{{portal_nombre}} - Resumen por Emisor</title>
    <style type="text/css">
        /* Base */
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; -webkit-text-size-adjust: none; -ms-text-size-adjust: none; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; line-height: 1.5; color: #333333; }
        
        /* Layout */
        .container { margin: 0 auto; width: 100%; max-width: 600px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        
        /* Typography */
        h1 { margin: 0; font-size: 24px; font-weight: 500; }
        p { margin: 16px 0; }
        
        /* Table */
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; }
        .table th { background-color: #e9ecef; }
        
        /* Colors */
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #007bff; }
        .success { color: #28a745; }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content { padding: 15px !important; }
            .table th, .table td { padding: 8px !important; }
        }
    </style>
</head>
<body>
    <table class="container" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
            <td align="center">
                <table class="header" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <h1>{{portal_nombre}} - Resumen por Emisor</h1>
                        </td>
                    </tr>
                </table>
                <table class="content" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <p>Este es un mensaje automático del sistema de notificaciones de <strong>{{portal_nombre}}</strong>.</p>
                            <p>A continuación se presenta un resumen de eventos por emisor para la casilla <strong>{{casilla_nombre}}</strong>:</p>
                            
                            <table class="table" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                                <tr>
                                    <th align="left">Emisor</th>
                                    <th align="left">Errores</th>
                                    <th align="left">Advertencias</th>
                                    <th align="left">Info</th>
                                    <th align="left">Exitosos</th>
                                </tr>
                                {{resumen_emisor}}
                            </table>
                            
                            <p>Total de eventos: {{evento_resumen}}</p>
                            <p>Fecha y hora del reporte: {{fecha}}</p>
                        </td>
                    </tr>
                </table>
                <table class="footer" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td align="center">
                            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
                            <p>&copy; {{portal_nombre}} - Sistema Automático de Gestión de Eventos</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

TEMPLATE_RESUMIDO_CASILLA_HTML_REACT = """
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>{{portal_nombre}} - Resumen de Casilla</title>
    <style type="text/css">
        /* Base */
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; -webkit-text-size-adjust: none; -ms-text-size-adjust: none; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; line-height: 1.5; color: #333333; }
        
        /* Layout */
        .container { margin: 0 auto; width: 100%; max-width: 600px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        
        /* Typography */
        h1 { margin: 0; font-size: 24px; font-weight: 500; }
        p { margin: 16px 0; }
        
        /* Table */
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; }
        .table th { background-color: #e9ecef; }
        
        /* Colors */
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #007bff; }
        .success { color: #28a745; }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content { padding: 15px !important; }
            .table th, .table td { padding: 8px !important; }
        }
    </style>
</head>
<body>
    <table class="container" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
            <td align="center">
                <table class="header" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <h1>Resumen de Casilla: {{casilla_nombre}}</h1>
                        </td>
                    </tr>
                </table>
                <table class="content" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <p>Este es un mensaje automático del sistema de notificaciones de <strong>{{portal_nombre}}</strong>.</p>
                            <p>A continuación se presenta un resumen del estado de la casilla <strong>{{casilla_nombre}}</strong>:</p>
                            
                            <table class="table" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                                <tr>
                                    <th align="left">Tipo</th>
                                    <th align="left">Cantidad</th>
                                </tr>
                                {{resumen_casilla}}
                            </table>
                            
                            <p>Fecha y hora del reporte: {{fecha}}</p>
                        </td>
                    </tr>
                </table>
                <table class="footer" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td align="center">
                            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
                            <p>&copy; {{portal_nombre}} - Sistema Automático de Gestión de Eventos</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

TEMPLATE_REMITENTE_NO_AUTORIZADO_HTML_REACT = """
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Remitente No Autorizado</title>
    <style type="text/css">
        /* Base */
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; -webkit-text-size-adjust: none; -ms-text-size-adjust: none; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; line-height: 1.5; color: #333333; }
        
        /* Layout */
        .container { margin: 0 auto; width: 100%; max-width: 600px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        
        /* Typography */
        h1 { margin: 0; font-size: 24px; font-weight: 500; }
        p { margin: 16px 0; }
        
        /* Highlight */
        .highlight { background-color: #f9f9f9; padding: 15px; border-left: 4px solid #3182ce; margin: 15px 0; }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content { padding: 15px !important; }
        }
    </style>
</head>
<body>
    <table class="container" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
            <td align="center">
                <table class="header" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <h1>Respuesta Automática</h1>
                        </td>
                    </tr>
                </table>
                <table class="content" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <p>Estimado/a Usuario,</p>
                            
                            <p>¡Gracias por comunicarse con nosotros a través de {{email_casilla}}!</p>
                            
                            <p>Queremos informarle que actualmente su dirección de correo electrónico ({{email_remitente}}) no se encuentra en nuestra lista de remitentes autorizados para esta casilla. ¡Pero no se preocupe! Valoramos enormemente su interés en utilizar nuestros servicios de procesamiento de datos.</p>
                            
                            <table class="highlight" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                                <tr>
                                    <td>
                                        <p>Para brindarle una experiencia completa y personalizada con el Sistema SAGE, le invitamos a contactar a su administrador de sistema para solicitar su autorización. Una vez autorizado, podrá disfrutar de todas las ventajas y beneficios de nuestra plataforma de procesamiento automatizado:</p>
                                        
                                        <p>✓ Validación automática de archivos<br />
                                        ✓ Notificaciones en tiempo real<br />
                                        ✓ Reportes detallados de procesamiento<br />
                                        ✓ Integración con sus sistemas existentes</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p>Si tiene alguna consulta o necesita asistencia adicional, nuestro equipo está siempre disponible para ayudarle. ¡Nos encantaría poder atenderle pronto como usuario autorizado!</p>
                            
                            <p>Gracias por su comprensión y por elegirnos.</p>
                            
                            <p>Atentamente,<br />
                            El Equipo SAGE</p>
                        </td>
                    </tr>
                </table>
                <table class="footer" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td align="center">
                            <p>Este es un mensaje automático generado por el sistema SAGE. Por favor contacte a su administrador para más información.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

TEMPLATE_SIN_ADJUNTO_HTML_REACT = """
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Sin Adjunto</title>
    <style type="text/css">
        /* Base */
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; -webkit-text-size-adjust: none; -ms-text-size-adjust: none; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; line-height: 1.5; color: #333333; }
        
        /* Layout */
        .container { margin: 0 auto; width: 100%; max-width: 600px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        
        /* Typography */
        h1 { margin: 0; font-size: 24px; font-weight: 500; }
        p { margin: 16px 0; }
        
        /* Highlight */
        .highlight { background-color: #f9f9f9; padding: 15px; border-left: 4px solid #dd6b20; margin: 15px 0; }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content { padding: 15px !important; }
        }
    </style>
</head>
<body>
    <table class="container" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
            <td align="center">
                <table class="header" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <h1>Respuesta Automática</h1>
                        </td>
                    </tr>
                </table>
                <table class="content" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td>
                            <p>Estimado/a Usuario,</p>
                            
                            <p>Hemos recibido su mensaje en {{email_casilla}}, pero no se encontró ningún archivo adjunto para procesar.</p>
                            
                            <table class="highlight" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                                <tr>
                                    <td>
                                        <p>Para que el sistema SAGE pueda procesar su solicitud, por favor reenvíe su mensaje incluyendo el archivo que desea procesar como adjunto.</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p>Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.</p>
                            
                            <p>Saludos cordiales,<br />
                            Sistema SAGE</p>
                        </td>
                    </tr>
                </table>
                <table class="footer" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                    <tr>
                        <td align="center">
                            <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

if __name__ == "__main__":
    sys.exit(main())
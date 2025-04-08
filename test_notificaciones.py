#!/usr/bin/env python3
"""
Test para verificar la funcionalidad del Notificador con la nueva configuración SMTP
que obtiene credenciales desde la base de datos.
"""

import sys
import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from sage.notificaciones.notificador import Notificador

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("TestNotificaciones")

def obtener_conexion_db():
    """Obtiene una conexión a la base de datos PostgreSQL"""
    conn_string = os.environ.get('DATABASE_URL')
    if not conn_string:
        logger.error("No se ha configurado DATABASE_URL")
        sys.exit(1)
        
    return psycopg2.connect(conn_string)

def test_obtener_configuracion_email():
    """
    Prueba la obtención de configuración de email desde la base de datos
    """
    notificador = Notificador()
    
    # Obtener la configuración SMTP que está utilizando
    smtp_config = notificador.smtp_config
    
    logger.info("Configuración SMTP obtenida:")
    for key, value in smtp_config.items():
        if key != 'password':
            logger.info(f"  - {key}: {value}")
        else:
            logger.info(f"  - {key}: {'*' * len(str(value))}")  # No mostrar password real
    
    return smtp_config

def test_enviar_notificacion_email(destinatario):
    """
    Prueba el envío de notificaciones por email
    
    Args:
        destinatario: Email del destinatario
    """
    notificador = Notificador()
    
    asunto = "SAGE - Prueba de notificación"
    
    # Obtener valores para formatear el HTML
    servidor = notificador.smtp_config.get('server', 'No disponible')
    puerto = notificador.smtp_config.get('port', 'No disponible')
    remitente = notificador.smtp_config.get('from_email', 'No disponible')
    
    contenido_html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
            .header {{ background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }}
            .content {{ padding: 20px; }}
            .footer {{ background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Prueba de Notificación SAGE</h2>
        </div>
        <div class="content">
            <p>Este es un correo de prueba enviado por el sistema de notificaciones de SAGE.</p>
            <p>La configuración de SMTP ahora se obtiene directamente desde la base de datos, priorizando las cuentas con propósito 'admin'.</p>
            <ul>
                <li>Servidor: {servidor}</li>
                <li>Puerto: {puerto}</li>
                <li>Remitente: {remitente}</li>
            </ul>
            <p>Si estás leyendo este mensaje, la configuración es correcta.</p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>
        </div>
    </body>
    </html>
    """
    
    logger.info(f"Enviando correo de prueba a {destinatario}")
    resultado = notificador.enviar_notificacion_email(
        destinatario, 
        asunto, 
        contenido_html
    )
    
    if resultado:
        logger.info(f"Correo enviado exitosamente a {destinatario}")
    else:
        logger.error(f"Error al enviar correo a {destinatario}")
    
    return resultado

def test_suscripciones():
    """
    Obtiene y muestra las suscripciones activas en el sistema
    """
    notificador = Notificador()
    
    # Obtener todas las suscripciones activas
    suscripciones = notificador.obtener_suscripciones()
    
    logger.info(f"Se encontraron {len(suscripciones)} suscripciones activas:")
    for i, suscripcion in enumerate(suscripciones, 1):
        logger.info(f"Suscripción {i}:")
        logger.info(f"  - ID: {suscripcion['id']}")
        logger.info(f"  - Nombre: {suscripcion['nombre']}")
        logger.info(f"  - Email: {suscripcion['email']}")
        logger.info(f"  - Frecuencia: {suscripcion['frecuencia']}")
        logger.info(f"  - Nivel de detalle: {suscripcion['nivel_detalle']}")
        logger.info(f"  - Casilla ID: {suscripcion['casilla_id']}")
        logger.info(f"  - Método de envío: {suscripcion.get('metodo_envio', 'email')}")
        logger.info("")
    
    return suscripciones

def test_procesamiento_notificaciones():
    """
    Prueba el procesamiento de notificaciones simulando eventos de procesamiento
    """
    notificador = Notificador()
    
    # Crear eventos de prueba
    eventos = [
        {
            'id': 1,
            'tipo': 'info',
            'mensaje': 'Archivo procesado correctamente',
            'fecha': '2025-04-05 12:30:45',
            'emisor': 'SISTEMA',
            'archivo': 'test1.csv',
            'resultado': 'OK'
        },
        {
            'id': 2,
            'tipo': 'warning',
            'mensaje': 'Formato no óptimo',
            'fecha': '2025-04-05 12:31:22',
            'emisor': 'SISTEMA',
            'archivo': 'test2.csv',
            'resultado': 'PARCIAL'
        },
        {
            'id': 3,
            'tipo': 'error',
            'mensaje': 'Error de validación',
            'fecha': '2025-04-05 12:32:10',
            'emisor': 'PROVEEDOR1',
            'archivo': 'test3.csv',
            'resultado': 'ERROR'
        }
    ]
    
    # Consultaremos las suscripciones para obtener un casilla_id válido
    suscripciones = notificador.obtener_suscripciones()
    
    if not suscripciones:
        logger.warning("No se encontraron suscripciones activas para la prueba")
        return False
    
    suscripcion = suscripciones[0]
    casilla_id = suscripcion['casilla_id']
    
    logger.info(f"Procesando eventos para Casilla ID: {casilla_id}")
    
    # Procesar los eventos para el casilla_id de la suscripción
    resultado = notificador.procesar_eventos(eventos, casilla_id=casilla_id)
    
    logger.info("Resultado del procesamiento:")
    logger.info(f"  - Total eventos: {resultado['total']}")
    logger.info(f"  - Notificaciones enviadas: {resultado['enviados']}")
    logger.info(f"  - Errores: {resultado['error']}")
    
    return resultado

def main():
    """Función principal"""
    if len(sys.argv) > 1:
        destinatario = sys.argv[1]
    else:
        destinatario = "admin@sage.vidahub.ai"  # Email de prueba por defecto
    
    logger.info("=== PRUEBA DE NOTIFICADOR SAGE ===")
    
    # 1. Probar obtención de configuración SMTP
    logger.info("1. Probando obtención de configuración SMTP...")
    smtp_config = test_obtener_configuracion_email()
    
    if not smtp_config.get('username') or not smtp_config.get('password'):
        logger.error("No se obtuvo una configuración SMTP válida. Abortando pruebas.")
        sys.exit(1)
    
    # 2. Probar envío de correo
    logger.info("\n2. Probando envío de correo...")
    test_enviar_notificacion_email(destinatario)
    
    # 3. Probar obtención de suscripciones
    logger.info("\n3. Probando obtención de suscripciones...")
    suscripciones = test_suscripciones()
    
    # 4. Probar procesamiento de notificaciones
    if suscripciones:
        logger.info("\n4. Probando procesamiento de notificaciones...")
        test_procesamiento_notificaciones()
    else:
        logger.warning("No se encontraron suscripciones, omitiendo prueba de procesamiento")
    
    logger.info("\n=== PRUEBAS COMPLETADAS ===")

if __name__ == "__main__":
    main()
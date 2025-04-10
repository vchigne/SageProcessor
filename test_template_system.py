"""
Script de prueba para el sistema de plantillas de email

Este script:
1. Inicializa la base de datos del sistema de plantillas
2. Prueba la obtención de plantillas usando el gestor
3. Prueba el renderizado de plantillas
4. Prueba el adaptador para el Notificador
"""

import os
import sys
import logging
import psycopg2
from datetime import datetime
from pprint import pprint

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Importar módulos del sistema de plantillas
try:
    from sage.templates.email import TemplateManager, TemplateRenderer, NotificadorAdapter
    from sage.templates.email.initialize_db import create_tables, load_default_templates
except ImportError:
    logger.error("No se pudieron importar los módulos del sistema de plantillas")
    sys.exit(1)

def get_db_connection():
    """Establece conexión con la base de datos PostgreSQL"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        logger.error("No se ha configurado DATABASE_URL en el entorno")
        sys.exit(1)
    
    return psycopg2.connect(database_url)

def probar_gestor_plantillas():
    """Prueba la funcionalidad del gestor de plantillas"""
    logger.info("Probando gestor de plantillas...")
    
    manager = TemplateManager()
    
    # Obtener una plantilla predeterminada
    logger.info("Buscando plantilla predeterminada para notificaciones detalladas")
    template = manager.get_template(
        template_type='notificacion',
        subtype='detallado',
        is_default=True
    )
    
    if template:
        logger.info(f"Plantilla encontrada: {template['nombre']}")
        logger.info(f"Asunto: {template['asunto']}")
        logger.info(f"Contenido (primeros 100 caracteres): {template['contenido_html'][:100]}...")
    else:
        logger.warning("No se encontró ninguna plantilla predeterminada")
    
    # Probar obtención de todas las plantillas
    logger.info("Obteniendo todas las plantillas")
    all_templates = manager.get_all_templates()
    logger.info(f"Se encontraron {len(all_templates)} plantillas")
    
    # Mostrar detalles de las plantillas
    for i, tmpl in enumerate(all_templates, 1):
        logger.info(f"{i}. {tmpl['nombre']} (tipo: {tmpl['tipo']}, subtipo: {tmpl['subtipo']})")
    
    return template if template else None

def probar_renderizador(template=None):
    """Prueba la funcionalidad del renderizador de plantillas"""
    logger.info("Probando renderizador de plantillas...")
    
    renderer = TemplateRenderer()
    
    # Crear un contexto de prueba
    context = {
        'fecha': datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
        'portal_nombre': 'Portal de Prueba',
        'casilla_nombre': 'Casilla de Prueba',
        'email_remitente': 'remitente@ejemplo.com',
        'email_casilla': 'casilla@sage.com',
        'asunto_original': 'Prueba de Sistema de Plantillas',
        'evento_resumen': 'Se procesaron 5 archivos',
        'detalle_eventos': """
            <div class="evento">
                <h3>Archivo: test1.csv</h3>
                <p><strong>Estado:</strong> Éxito</p>
                <p><strong>Fecha:</strong> 10/04/2025 15:30:45</p>
                <p><strong>Emisor:</strong> Proveedor de Prueba</p>
                <p><strong>Detalles:</strong> Archivo procesado correctamente</p>
            </div>
            <div class="evento">
                <h3>Archivo: test2.csv</h3>
                <p><strong>Estado:</strong> Fallido</p>
                <p><strong>Fecha:</strong> 10/04/2025 15:32:10</p>
                <p><strong>Emisor:</strong> Proveedor de Prueba</p>
                <p><strong>Detalles:</strong> Error en formato de archivo</p>
            </div>
        """
    }
    
    # Si tenemos una plantilla del paso anterior, la usamos
    if template:
        logger.info("Renderizando plantilla obtenida del gestor")
        rendered_subject = renderer.render_string(template['asunto'], context)
        rendered_content = renderer.render_string(template['contenido_html'], context)
        
        logger.info(f"Asunto renderizado: {rendered_subject}")
        logger.info(f"Contenido renderizado (primeros 200 caracteres): {rendered_content[:200]}...")
    else:
        # Ejemplo simple de renderizado
        logger.info("Renderizando plantilla de ejemplo")
        simple_template = """
        <h1>Notificación de SAGE</h1>
        <p>Fecha: {{fecha}}</p>
        <p>Estimado usuario del portal {{portal_nombre}},</p>
        <p>{{evento_resumen}} en la casilla {{casilla_nombre}}.</p>
        <div class="detalles">
            {{detalle_eventos}}
        </div>
        <p>Saludos cordiales,<br>Equipo SAGE</p>
        """
        
        rendered = renderer.render_string(simple_template, context)
        logger.info(f"Contenido renderizado (primeros 200 caracteres): {rendered[:200]}...")

def probar_adaptador():
    """Prueba la funcionalidad del adaptador para el Notificador"""
    logger.info("Probando adaptador para el Notificador...")
    
    adapter = NotificadorAdapter()
    
    # Crear eventos de prueba
    eventos_prueba = [
        {
            'nombre_archivo': 'test1.csv',
            'estado': 'Éxito',
            'fecha': datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
            'emisor': 'Proveedor A',
            'detalles': 'Archivo procesado correctamente',
            'email_remitente': 'proveedora@ejemplo.com',
            'email_casilla': 'casilla1@sage.com',
            'asunto_original': 'Envío de datos mensuales'
        },
        {
            'nombre_archivo': 'test2.csv',
            'estado': 'Fallido',
            'fecha': datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
            'emisor': 'Proveedor B',
            'detalles': 'Error en formato de archivo',
            'email_remitente': 'proveedorb@ejemplo.com',
            'email_casilla': 'casilla1@sage.com',
            'asunto_original': 'Datos para procesar'
        }
    ]
    
    # Probar generación de contenido con diferentes niveles de detalle
    for nivel in ['detallado', 'resumido_emisor', 'resumido_casilla']:
        logger.info(f"Generando notificación con nivel de detalle: {nivel}")
        
        asunto, contenido = adapter.generar_contenido_notificacion(
            eventos=eventos_prueba,
            nivel_detalle=nivel,
            portal_id=1,  # ID ficticio
            casilla_id=1   # ID ficticio
        )
        
        logger.info(f"Asunto generado: {asunto}")
        logger.info(f"Contenido generado (primeros 200 caracteres): {contenido[:200]}...")

def main():
    """Función principal"""
    logger.info("Iniciando prueba del sistema de plantillas")
    
    # Asegurarse de que la base de datos esté inicializada
    conn = get_db_connection()
    
    try:
        # Probar componentes
        template = probar_gestor_plantillas()
        probar_renderizador(template)
        probar_adaptador()
        
        logger.info("Prueba completada con éxito")
        
    except Exception as e:
        logger.error(f"Error durante la prueba: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    main()
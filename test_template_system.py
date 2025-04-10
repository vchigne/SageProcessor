#!/usr/bin/env python3
"""
Script para probar el sistema de plantillas de email

Este script demuestra el uso básico del sistema de plantillas,
generando una notificación de ejemplo con diferentes contextos.
"""

import os
import sys
import json
import logging
import datetime
from typing import Dict, Any, List

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

try:
    from sage.templates.email.template_manager import TemplateManager
    from sage.templates.email.template_renderer import TemplateRenderer
    from sage.templates.email.initialize_db import create_tables, load_default_templates
except ImportError:
    logger.error("No se pudo importar los módulos del sistema de plantillas")
    logger.error("Asegúrese de que el sistema de plantillas esté instalado correctamente")
    sys.exit(1)

def initialize_database():
    """Inicializa la base de datos si es necesario"""
    try:
        from sage.templates.email.initialize_db import get_db_connection
        conn = get_db_connection()
        create_tables(conn)
        load_default_templates(conn)
        logger.info("Base de datos inicializada correctamente")
    except Exception as e:
        logger.error(f"Error al inicializar la base de datos: {e}")
        sys.exit(1)

def generate_sample_events(num_events: int = 5) -> List[Dict[str, Any]]:
    """Genera eventos de ejemplo para probar las plantillas
    
    Args:
        num_events: Número de eventos a generar
        
    Returns:
        Lista de eventos de ejemplo
    """
    event_types = ['error', 'warning', 'info', 'success']
    senders = ['Procesador Excel', 'Validador YAML', 'Sincronizador DB', 'Analizador CSV']
    messages = [
        'Archivo procesado correctamente',
        'Formato no reconocido en la fila 23',
        'Campo obligatorio ausente: nombre_producto',
        'Error de conexión con la base de datos',
        'Advertencia: valores duplicados encontrados',
        'Sincronización completada: 234 registros actualizados',
        'Validación exitosa de estructura YAML',
        'Datos incompletos en columna precio'
    ]
    
    events = []
    
    for i in range(num_events):
        import random
        event_type = random.choice(event_types)
        sender = random.choice(senders)
        message = random.choice(messages)
        
        # Fecha aleatoria en las últimas 24 horas
        hours_ago = random.randint(0, 23)
        minutes_ago = random.randint(0, 59)
        event_date = datetime.datetime.now() - datetime.timedelta(hours=hours_ago, minutes=minutes_ago)
        
        events.append({
            'tipo': event_type,
            'emisor': sender,
            'mensaje': message,
            'fecha': event_date.strftime('%d/%m/%Y %H:%M')
        })
    
    return events

def test_template_rendering():
    """Prueba el renderizado de diferentes tipos de plantillas"""
    try:
        manager = TemplateManager()
        renderer = TemplateRenderer()
        
        # Generar eventos de ejemplo
        events = generate_sample_events(8)
        
        # Probar diferentes niveles de detalle
        detail_levels = ['detallado', 'resumido_emisor', 'resumido_casilla']
        
        for level in detail_levels:
            logger.info(f"Probando plantilla con nivel de detalle: {level}")
            
            # Obtener la plantilla
            template = manager.get_template('notificacion', level)
            
            if not template:
                logger.warning(f"No se encontró plantilla para nivel {level}")
                continue
            
            # Preparar el contexto
            context = {
                'fecha': datetime.datetime.now().strftime('%d/%m/%Y %H:%M'),
                'portal_nombre': 'SAGE Test',
                'casilla_nombre': 'Casilla de Prueba',
                'eventos': events,
                'evento_resumen': f"{len(events)} eventos de prueba"
            }
            
            # Añadir contenido específico según el nivel de detalle
            if level == 'detallado':
                # Generar contenido HTML para los eventos
                detalle_eventos = ""
                detalle_eventos_texto = ""
                
                for evento in events:
                    tipo = evento.get('tipo', 'info')
                    clase_css = tipo if tipo in ['error', 'warning', 'info', 'success'] else 'info'
                    
                    detalle_eventos += f"""
                    <tr>
                        <td class="{clase_css}">{tipo.upper()}</td>
                        <td>{evento.get('emisor', 'N/A')}</td>
                        <td>{evento.get('mensaje', 'Sin mensaje')}</td>
                        <td>{evento.get('fecha', 'N/A')}</td>
                    </tr>
                    """
                    
                    detalle_eventos_texto += f"""
Tipo: {tipo.upper()}
Emisor: {evento.get('emisor', 'N/A')}
Mensaje: {evento.get('mensaje', 'Sin mensaje')}
Fecha: {evento.get('fecha', 'N/A')}
--------------------------------------------------
"""
                
                context['detalle_eventos'] = detalle_eventos
                context['detalle_eventos_texto'] = detalle_eventos_texto
                
            elif level == 'resumido_emisor':
                # Agrupar eventos por emisor
                por_emisor = {}
                for evento in events:
                    emisor = evento.get('emisor', 'Desconocido')
                    if emisor not in por_emisor:
                        por_emisor[emisor] = {'error': 0, 'warning': 0, 'info': 0, 'success': 0}
                    
                    tipo = evento.get('tipo', 'info')
                    if tipo in por_emisor[emisor]:
                        por_emisor[emisor][tipo] += 1
                
                # Generar contenido HTML para el resumen por emisor
                resumen_emisor = ""
                resumen_emisor_texto = ""
                
                for emisor, conteo in por_emisor.items():
                    resumen_emisor += f"""
                    <tr>
                        <td><strong>{emisor}</strong></td>
                        <td class="error">{conteo['error']}</td>
                        <td class="warning">{conteo['warning']}</td>
                        <td class="info">{conteo['info']}</td>
                        <td class="success">{conteo['success']}</td>
                    </tr>
                    """
                    
                    resumen_emisor_texto += f"""
Emisor: {emisor}
Errores: {conteo['error']}
Advertencias: {conteo['warning']}
Información: {conteo['info']}
Exitosos: {conteo['success']}
--------------------------------------------------
"""
                
                context['resumen_emisor'] = resumen_emisor
                context['resumen_emisor_texto'] = resumen_emisor_texto
                
            elif level == 'resumido_casilla':
                # Contar tipos de eventos
                conteo = {'error': 0, 'warning': 0, 'info': 0, 'success': 0}
                
                for evento in events:
                    tipo = evento.get('tipo', 'info')
                    if tipo in conteo:
                        conteo[tipo] += 1
                
                # Generar contenido HTML para el resumen por casilla
                resumen_casilla = ""
                resumen_casilla_texto = ""
                
                for tipo, cantidad in conteo.items():
                    clase_css = tipo
                    tipo_texto = tipo.capitalize()
                    if tipo == 'error':
                        tipo_texto = 'Errores'
                    elif tipo == 'warning':
                        tipo_texto = 'Advertencias'
                    elif tipo == 'info':
                        tipo_texto = 'Información'
                    elif tipo == 'success':
                        tipo_texto = 'Exitosos'
                    
                    resumen_casilla += f"""
                    <tr>
                        <td class="{clase_css}"><strong>{tipo_texto}</strong></td>
                        <td>{cantidad}</td>
                    </tr>
                    """
                    
                    resumen_casilla_texto += f"""
{tipo_texto}: {cantidad}
"""
                
                context['resumen_casilla'] = resumen_casilla
                context['resumen_casilla_texto'] = resumen_casilla_texto
            
            # Renderizar la plantilla
            subject = renderer.render_subject(template, context)
            html_content, text_content = renderer.render(template, context)
            
            logger.info(f"Asunto: {subject}")
            logger.info(f"Contenido HTML generado: {len(html_content)} caracteres")
            logger.info(f"Contenido texto generado: {len(text_content)} caracteres")
            
            # Guardar resultados para inspección
            output_dir = "test_output"
            os.makedirs(output_dir, exist_ok=True)
            
            with open(f"{output_dir}/template_{level}_html.html", "w") as f:
                f.write(html_content)
            
            with open(f"{output_dir}/template_{level}_text.txt", "w") as f:
                f.write(text_content)
            
            logger.info(f"Resultados guardados en {output_dir}/template_{level}_*.html/txt")
            print("\n")
    
    except Exception as e:
        logger.error(f"Error durante la prueba: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        # Inicializar la base de datos
        initialize_database()
        
        # Probar el renderizado de plantillas
        test_template_rendering()
        
        logger.info("Prueba completada exitosamente")
    except Exception as e:
        logger.error(f"Error durante la prueba: {e}")
        sys.exit(1)
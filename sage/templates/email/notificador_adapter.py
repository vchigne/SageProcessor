"""
Adaptador para integrar el sistema de plantillas con el Notificador de SAGE

Este módulo proporciona la capa de adaptación entre el sistema de plantillas
y el Notificador existente, asegurando compatibilidad con el código actual.
"""

import logging
import os
import psycopg2
from psycopg2.extras import DictCursor
from typing import Dict, Any, List, Optional, Tuple, Union
from datetime import datetime
import json

from sage.templates.email.template_manager import TemplateManager
from sage.templates.email.template_renderer import TemplateRenderer

logger = logging.getLogger(__name__)

class NotificadorAdapter:
    """
    Adaptador para integrar el sistema de plantillas con el Notificador de SAGE
    
    Esta clase proporciona métodos que el Notificador puede llamar directamente,
    manteniendo la interfaz existente pero utilizando el nuevo sistema de plantillas.
    """
    
    def __init__(self, config=None):
        """
        Inicializa el adaptador
        
        Args:
            config (dict, optional): Configuración del adaptador
        """
        self.config = config or {}
        self.template_manager = TemplateManager()
        self.template_renderer = TemplateRenderer()
        self.db_connection = None
    
    def generar_contenido_notificacion(self, eventos=None, nivel_detalle=None, 
                                      portal_id=None, casilla_id=None, suscriptor_id=None,
                                      **kwargs) -> Tuple[str, str]:
        """
        Genera el contenido de una notificación utilizando una plantilla
        
        Args:
            eventos: Lista de eventos a incluir en la notificación
            nivel_detalle: Nivel de detalle ('detallado', 'resumido_emisor', 'resumido_casilla')
            portal_id: ID del portal
            casilla_id: ID de la casilla
            suscriptor_id: ID del suscriptor
            **kwargs: Argumentos adicionales
            
        Returns:
            Tuple[str, str]: (asunto, contenido HTML)
        """
        if not eventos:
            logger.warning("No hay eventos para generar la notificación")
            return ("", "")
            
        if not nivel_detalle:
            nivel_detalle = 'detallado'  # Nivel de detalle por defecto

        # Preparar el tipo de plantilla según el nivel de detalle
        template_type = 'notificacion'
        subtype = nivel_detalle
        
        try:
            # Primero intentamos obtener una plantilla específica para el suscriptor
            template = None
            if suscriptor_id:
                template = self.template_manager.get_template_for_subscriber(
                    subscriber_id=suscriptor_id,
                    template_type=template_type,
                    subtype=subtype
                )
            
            # Si no hay plantilla específica para el suscriptor, usamos la predeterminada
            if not template:
                template = self.template_manager.get_template(
                    template_type=template_type,
                    subtype=subtype,
                    is_default=True
                )
                
            if not template:
                logger.error(f"No se encontró plantilla para: {template_type}, {subtype}")
                return ("", "")
                
            # Preparar el contexto para la plantilla
            context = self._preparar_contexto(
                eventos=eventos, 
                nivel_detalle=nivel_detalle,
                portal_id=portal_id,
                casilla_id=casilla_id,
                **kwargs
            )
            
            # Renderizar plantilla
            asunto = self.template_renderer.render_string(template['asunto'], context)
            contenido_html = self.template_renderer.render_string(template['contenido_html'], context)
            
            return (asunto, contenido_html)
            
        except Exception as e:
            logger.error(f"Error al generar contenido de notificación: {e}")
            return ("", "")
    
    def _preparar_contexto(self, eventos, nivel_detalle, portal_id=None, casilla_id=None, **kwargs) -> Dict[str, Any]:
        """
        Prepara el contexto para renderizar una plantilla de notificación
        
        Args:
            eventos: Lista de eventos
            nivel_detalle: Nivel de detalle
            portal_id: ID del portal
            casilla_id: ID de la casilla
            **kwargs: Argumentos adicionales
            
        Returns:
            Dict[str, Any]: Contexto para la plantilla
        """
        # Contexto básico
        context = {
            'fecha': datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
            'portal_nombre': self._obtener_nombre_portal(portal_id) if portal_id else 'N/A',
            'casilla_nombre': self._obtener_nombre_casilla(casilla_id) if casilla_id else 'N/A',
            'eventos': eventos
        }
        
        # Incluir argumentos adicionales
        context.update(kwargs)
        
        # Preparar contexto específico según el nivel de detalle
        if nivel_detalle == 'detallado':
            self._preparar_contexto_detallado(context, eventos)
        elif nivel_detalle == 'resumido_emisor':
            self._preparar_contexto_resumido_emisor(context, eventos)
        elif nivel_detalle == 'resumido_casilla':
            self._preparar_contexto_resumido_casilla(context, eventos)
            
        return context
    
    def _obtener_nombre_portal(self, portal_id):
        """
        Obtiene el nombre de un portal por su ID
        
        Args:
            portal_id: ID del portal
            
        Returns:
            str: Nombre del portal o None si no se encuentra
        """
        try:
            conn = self._get_db_connection()
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT nombre FROM portales WHERE id = %s
                """, (portal_id,))
                
                result = cursor.fetchone()
                return result[0] if result else 'Portal desconocido'
                
        except Exception as e:
            logger.error(f"Error al obtener nombre de portal: {e}")
            return 'Portal desconocido'
    
    def _obtener_nombre_casilla(self, casilla_id):
        """
        Obtiene el nombre de una casilla por su ID
        
        Args:
            casilla_id: ID de la casilla
            
        Returns:
            str: Nombre de la casilla o None si no se encuentra
        """
        try:
            conn = self._get_db_connection()
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT nombre FROM casillas WHERE id = %s
                """, (casilla_id,))
                
                result = cursor.fetchone()
                return result[0] if result else 'Casilla desconocida'
                
        except Exception as e:
            logger.error(f"Error al obtener nombre de casilla: {e}")
            return 'Casilla desconocida'
    
    def _preparar_contexto_detallado(self, context, eventos):
        """
        Prepara variables específicas para notificaciones detalladas
        
        Args:
            context: Contexto a modificar
            eventos: Lista de eventos
        """
        # Generar contenido detallado para cada evento
        detalle_html = []
        for evento in eventos:
            evento_html = f"""
            <div class="evento">
                <h3>Archivo: {evento.get('nombre_archivo', 'N/A')}</h3>
                <p><strong>Estado:</strong> {evento.get('estado', 'N/A')}</p>
                <p><strong>Fecha:</strong> {evento.get('fecha', 'N/A')}</p>
                <p><strong>Emisor:</strong> {evento.get('emisor', 'N/A')}</p>
                <p><strong>Detalles:</strong> {evento.get('detalles', 'N/A')}</p>
            </div>
            """
            detalle_html.append(evento_html)
            
        # Agregar al contexto
        context['detalle_eventos'] = '\n'.join(detalle_html)
        context['evento_resumen'] = f"Se procesaron {len(eventos)} archivos"
        
        # Extraer información de correo electrónico y asunto si está disponible
        if eventos and len(eventos) > 0:
            context['email_remitente'] = eventos[0].get('email_remitente', 'N/A')
            context['email_casilla'] = eventos[0].get('email_casilla', 'N/A')
            context['asunto_original'] = eventos[0].get('asunto_original', 'N/A')
    
    def _preparar_contexto_resumido_emisor(self, context, eventos):
        """
        Prepara variables específicas para notificaciones resumidas por emisor
        
        Args:
            context: Contexto a modificar
            eventos: Lista de eventos
        """
        # Agrupar eventos por emisor
        emisores = {}
        for evento in eventos:
            emisor = evento.get('emisor', 'Desconocido')
            if emisor not in emisores:
                emisores[emisor] = []
            emisores[emisor].append(evento)
        
        # Generar resumen HTML por emisor
        resumen_html = []
        for emisor, eventos_emisor in emisores.items():
            exitos = sum(1 for e in eventos_emisor if e.get('estado') == 'Éxito')
            fallidos = sum(1 for e in eventos_emisor if e.get('estado') == 'Fallido')
            warnings = sum(1 for e in eventos_emisor if e.get('warnings_detectados', 0) > 0)
            
            emisor_html = f"""
            <div class="emisor">
                <h3>Emisor: {emisor}</h3>
                <p>Total archivos: {len(eventos_emisor)}</p>
                <p>Exitosos: {exitos}</p>
                <p>Fallidos: {fallidos}</p>
                <p>Con advertencias: {warnings}</p>
            </div>
            """
            resumen_html.append(emisor_html)
            
        # Agregar al contexto
        context['resumen_emisor'] = '\n'.join(resumen_html)
        context['evento_resumen'] = f"Se procesaron {len(eventos)} archivos de {len(emisores)} emisores"
        
        # Extraer información de correo electrónico y asunto si está disponible
        if eventos and len(eventos) > 0:
            context['email_remitente'] = eventos[0].get('email_remitente', 'N/A')
            context['email_casilla'] = eventos[0].get('email_casilla', 'N/A')
            context['asunto_original'] = eventos[0].get('asunto_original', 'N/A')
    
    def _preparar_contexto_resumido_casilla(self, context, eventos):
        """
        Prepara variables específicas para notificaciones resumidas por casilla
        
        Args:
            context: Contexto a modificar
            eventos: Lista de eventos
        """
        # Contar estadísticas generales
        total = len(eventos)
        exitos = sum(1 for e in eventos if e.get('estado') == 'Éxito')
        fallidos = sum(1 for e in eventos if e.get('estado') == 'Fallido')
        warnings = sum(1 for e in eventos if e.get('warnings_detectados', 0) > 0)
        otros = total - exitos - fallidos
        
        # Generar resumen HTML
        resumen_html = f"""
        <div class="resumen-casilla">
            <h3>Resumen de Archivos Procesados</h3>
            <p>Total archivos: {total}</p>
            <p>Exitosos: {exitos}</p>
            <p>Fallidos: {fallidos}</p>
            <p>Con advertencias: {warnings}</p>
            <p>Otros estados: {otros}</p>
        </div>
        """
        
        # Agregar al contexto
        context['resumen_casilla'] = resumen_html
        context['evento_resumen'] = f"Se procesaron {total} archivos en la casilla {context['casilla_nombre']}"
        
        # Extraer información de correo electrónico y asunto si está disponible
        if eventos and len(eventos) > 0:
            context['email_remitente'] = eventos[0].get('email_remitente', 'N/A')
            context['email_casilla'] = eventos[0].get('email_casilla', 'N/A')
            context['asunto_original'] = eventos[0].get('asunto_original', 'N/A')
            
    def _get_db_connection(self):
        """
        Obtiene una conexión a la base de datos
        
        Returns:
            connection: Conexión a la base de datos PostgreSQL
        """
        if not self.db_connection or self.db_connection.closed:
            database_url = os.environ.get('DATABASE_URL')
            if not database_url:
                raise ValueError("No se ha configurado DATABASE_URL en el entorno")
                
            self.db_connection = psycopg2.connect(database_url)
            
        return self.db_connection
"""
Adaptador para integrar el sistema de plantillas con el Notificador de SAGE

Este módulo proporciona la capa de adaptación entre el sistema de plantillas
y el Notificador existente, asegurando compatibilidad con el código actual.
"""

import logging
import os
import datetime
from typing import Dict, Any, Tuple, Optional, List, Union

from .template_manager import TemplateManager
from .template_renderer import TemplateRenderer

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
        self.template_manager = TemplateManager(cache_ttl=300)  # 5 minutos de caché
        self.template_renderer = TemplateRenderer()
        self.config = config or {}
    
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
        logger.debug(f"Generando contenido para notificación con nivel {nivel_detalle}")
        
        # Si no hay nivel de detalle, usar 'detallado' por defecto
        if not nivel_detalle:
            nivel_detalle = 'detallado'
        
        # Si no hay eventos, no enviar notificación
        if not eventos or len(eventos) == 0:
            logger.warning("No hay eventos para generar la notificación")
            return None, None
            
        try:
            # Preparar el contexto para la plantilla
            context = self._preparar_contexto(eventos, nivel_detalle, portal_id, casilla_id, **kwargs)
            
            # Obtener la plantilla adecuada
            template = None
            
            # Si hay suscriptor, intentar obtener una plantilla específica para él
            if suscriptor_id:
                template = self.template_manager.get_template_for_subscriber(
                    subscriber_id=suscriptor_id,
                    template_type='notificacion',
                    subtype=nivel_detalle
                )
            
            # Si no hay plantilla específica, obtener la predeterminada
            if not template:
                template = self.template_manager.get_template(
                    template_type='notificacion',
                    subtype=nivel_detalle
                )
            
            # Si no se encontró ninguna plantilla, usar el método tradicional
            if not template:
                logger.warning(f"No se encontró plantilla para notificación {nivel_detalle}")
                return None, None
                
            # Renderizar la plantilla
            subject = self.template_renderer.render_subject(template, context)
            html_content, _ = self.template_renderer.render(template, context)
            
            return subject, html_content
            
        except Exception as e:
            logger.error(f"Error al generar contenido de notificación: {e}")
            return None, None
    
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
            'fecha': datetime.datetime.now().strftime('%d/%m/%Y %H:%M'),
            'portal_nombre': 'SAGE',  # Valor por defecto
            'casilla_nombre': 'Sin nombre',  # Valor por defecto
            'eventos': eventos,
            'evento_resumen': f"{len(eventos)} eventos para revisar",
            'email_remitente': kwargs.get('email_remitente', ''),
            'email_casilla': kwargs.get('email_casilla', ''),
            'asunto_original': kwargs.get('asunto_original', '')
        }
        
        # Obtener nombre del portal y casilla desde la base de datos
        try:
            if portal_id:
                context['portal_nombre'] = self._obtener_nombre_portal(portal_id) or context['portal_nombre']
                
            if casilla_id:
                context['casilla_nombre'] = self._obtener_nombre_casilla(casilla_id) or context['casilla_nombre']
                
        except Exception as e:
            logger.error(f"Error al obtener datos para contexto: {e}")
        
        # Preparar contenido según el nivel de detalle
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
        # En una implementación real, esta información se obtendría de la base de datos
        # Aquí usamos una implementación simple por ahora
        portales = {'1': 'Portal Principal', '2': 'Portal Secundario'}
        return portales.get(str(portal_id))
    
    def _obtener_nombre_casilla(self, casilla_id):
        """
        Obtiene el nombre de una casilla por su ID
        
        Args:
            casilla_id: ID de la casilla
            
        Returns:
            str: Nombre de la casilla o None si no se encuentra
        """
        # En una implementación real, esta información se obtendría de la base de datos
        # Aquí usamos una implementación simple por ahora
        casillas = {
            '1': 'Recepción General', 
            '45': 'Casilla de Procesamiento', 
            '50': 'Validación de Datos',
            '61': 'Casilla de Ventas'
        }
        return casillas.get(str(casilla_id))
    
    def _preparar_contexto_detallado(self, context, eventos):
        """
        Prepara variables específicas para notificaciones detalladas
        
        Args:
            context: Contexto a modificar
            eventos: Lista de eventos
        """
        detalle_eventos_html = ""
        detalle_eventos_texto = ""
        
        for evento in eventos:
            tipo = evento.get('tipo', 'info')
            clase_css = tipo if tipo in ['error', 'warning', 'info', 'success'] else 'info'
            
            detalle_eventos_html += f"""
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
        
        context['detalle_eventos'] = detalle_eventos_html
        context['detalle_eventos_texto'] = detalle_eventos_texto
    
    def _preparar_contexto_resumido_emisor(self, context, eventos):
        """
        Prepara variables específicas para notificaciones resumidas por emisor
        
        Args:
            context: Contexto a modificar
            eventos: Lista de eventos
        """
        # Agrupar eventos por emisor
        por_emisor = {}
        for evento in eventos:
            emisor = evento.get('emisor', 'Desconocido')
            if emisor not in por_emisor:
                por_emisor[emisor] = {'error': 0, 'warning': 0, 'info': 0, 'success': 0}
            
            tipo = evento.get('tipo', 'info')
            if tipo in por_emisor[emisor]:
                por_emisor[emisor][tipo] += 1
        
        # Generar HTML para el resumen
        resumen_emisor_html = ""
        resumen_emisor_texto = ""
        
        for emisor, conteo in por_emisor.items():
            resumen_emisor_html += f"""
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
        
        context['resumen_emisor'] = resumen_emisor_html
        context['resumen_emisor_texto'] = resumen_emisor_texto
    
    def _preparar_contexto_resumido_casilla(self, context, eventos):
        """
        Prepara variables específicas para notificaciones resumidas por casilla
        
        Args:
            context: Contexto a modificar
            eventos: Lista de eventos
        """
        # Contar eventos por tipo
        conteo = {'error': 0, 'warning': 0, 'info': 0, 'success': 0}
        
        for evento in eventos:
            tipo = evento.get('tipo', 'info')
            if tipo in conteo:
                conteo[tipo] += 1
        
        # Generar HTML para el resumen
        resumen_casilla_html = ""
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
            
            resumen_casilla_html += f"""
            <tr>
                <td class="{clase_css}"><strong>{tipo_texto}</strong></td>
                <td>{cantidad}</td>
            </tr>
            """
            
            resumen_casilla_texto += f"""
{tipo_texto}: {cantidad}
"""
        
        context['resumen_casilla'] = resumen_casilla_html
        context['resumen_casilla_texto'] = resumen_casilla_texto
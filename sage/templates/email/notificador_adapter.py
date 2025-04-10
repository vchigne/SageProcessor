"""
Adaptador para integrar el sistema de plantillas en el Notificador existente

Este módulo proporciona una capa de integración entre el Notificador
existente y el nuevo sistema de plantillas, asegurando la compatibilidad
y permitiendo una migración gradual.
"""

import logging
from typing import Dict, Any, List, Tuple, Optional

from sage.templates.email.template_manager import TemplateManager
from sage.templates.email.template_renderer import TemplateRenderer

logger = logging.getLogger(__name__)

class NotificadorAdapter:
    """Adaptador para integrar el sistema de plantillas en el Notificador"""
    
    def __init__(self, db_connection=None):
        """Inicializa el adaptador
        
        Args:
            db_connection: Conexión a base de datos (opcional)
        """
        self.template_manager = TemplateManager(db_connection)
        self.template_renderer = TemplateRenderer()
    
    def generar_contenido_notificacion(self, eventos: List[Dict[str, Any]], 
                                      nivel_detalle: str, 
                                      portal_id: Optional[int] = None,
                                      casilla_id: Optional[int] = None,
                                      suscriptor_id: Optional[int] = None) -> Tuple[str, str]:
        """Genera el contenido de la notificación utilizando el sistema de plantillas
        
        Args:
            eventos: Lista de eventos para incluir en la notificación
            nivel_detalle: Nivel de detalle ('detallado', 'resumido_emisor', 'resumido_casilla')
            portal_id: ID del portal (opcional)
            casilla_id: ID de la casilla (opcional)
            suscriptor_id: ID del suscriptor (opcional, para personalización)
            
        Returns:
            Tuple[str, str]: Tupla con (asunto, contenido_html)
        """
        try:
            # Si tenemos ID de suscriptor, intentamos obtener su plantilla preferida
            if suscriptor_id:
                template = self.template_manager.get_template_for_subscriber(
                    suscriptor_id, 
                    'notificacion', 
                    nivel_detalle
                )
            else:
                # Si no, usamos la plantilla predeterminada
                template = self.template_manager.get_template(
                    'notificacion', 
                    nivel_detalle
                )
            
            # Si no se encontró ninguna plantilla, devolver resultado vacío
            # El sistema actual generará el contenido como lo hacía antes
            if not template:
                logger.warning(f"No se encontró plantilla para nivel_detalle={nivel_detalle}")
                return "", ""
            
            # Preparar el contexto para la plantilla según el nivel de detalle
            context = self._prepare_context(eventos, nivel_detalle, portal_id, casilla_id)
            
            # Renderizar la plantilla con el contexto
            html_content, text_content = self.template_renderer.render(template, context)
            
            # Renderizar el asunto
            subject = self.template_renderer.render_subject(template, context)
            
            # Si el contenido HTML está vacío, el sistema actual generará el contenido
            if not html_content:
                logger.warning(f"Plantilla con ID {template.get('id')} no generó contenido HTML")
                return subject, ""
            
            return subject, html_content
            
        except Exception as e:
            logger.error(f"Error al generar contenido con plantilla: {e}")
            # En caso de error, devolver cadenas vacías para que el sistema
            # actual genere el contenido como lo hacía antes
            return "", ""
    
    def _prepare_context(self, eventos: List[Dict[str, Any]], 
                        nivel_detalle: str,
                        portal_id: Optional[int] = None,
                        casilla_id: Optional[int] = None) -> Dict[str, Any]:
        """Prepara el contexto para la plantilla según el nivel de detalle
        
        Args:
            eventos: Lista de eventos
            nivel_detalle: Nivel de detalle
            portal_id: ID del portal
            casilla_id: ID de la casilla
            
        Returns:
            Dict[str, Any]: Contexto para la plantilla
        """
        import datetime
        
        # Contexto común para todas las plantillas
        context = {
            'fecha': datetime.datetime.now().strftime('%d/%m/%Y %H:%M'),
            'eventos': eventos,
            'portal_id': portal_id,
            'casilla_id': casilla_id,
            'portal_nombre': "SAGE",
            'casilla_nombre': "",
            'evento_resumen': self._generate_event_summary(eventos)
        }
        
        # Obtener información adicional del portal/casilla si está disponible
        if portal_id or casilla_id:
            portal_info, casilla_info = self._get_portal_casilla_info(portal_id, casilla_id)
            if portal_info:
                context['portal_nombre'] = portal_info.get('nombre', "SAGE")
            if casilla_info:
                context['casilla_nombre'] = casilla_info.get('nombre', "")
        
        # Preparar contenido específico según el nivel de detalle
        if nivel_detalle == 'detallado':
            context.update(self._prepare_detailed_context(eventos))
        elif nivel_detalle == 'resumido_emisor':
            context.update(self._prepare_summary_by_sender_context(eventos))
        elif nivel_detalle == 'resumido_casilla':
            context.update(self._prepare_summary_by_mailbox_context(eventos))
        
        return context
    
    def _get_portal_casilla_info(self, portal_id: Optional[int], 
                                casilla_id: Optional[int]) -> Tuple[Optional[Dict[str, Any]], 
                                                                 Optional[Dict[str, Any]]]:
        """Obtiene información del portal y la casilla
        
        Args:
            portal_id: ID del portal
            casilla_id: ID de la casilla
            
        Returns:
            Tuple[Optional[Dict], Optional[Dict]]: Información del portal y casilla
        """
        portal_info = None
        casilla_info = None
        
        try:
            connection = self.template_manager._get_db_connection()
            cursor = connection.cursor()
            
            # Obtener información del portal
            if portal_id:
                cursor.execute("SELECT nombre FROM portales WHERE id = %s", (portal_id,))
                portal_row = cursor.fetchone()
                if portal_row:
                    portal_info = {'nombre': portal_row[0]}
            
            # Obtener información de la casilla
            if casilla_id:
                cursor.execute("SELECT nombre FROM casillas WHERE id = %s", (casilla_id,))
                casilla_row = cursor.fetchone()
                if casilla_row:
                    casilla_info = {'nombre': casilla_row[0]}
            
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error al obtener información del portal/casilla: {e}")
        
        return portal_info, casilla_info
    
    def _generate_event_summary(self, eventos: List[Dict[str, Any]]) -> str:
        """Genera un resumen de los eventos para el asunto del correo
        
        Args:
            eventos: Lista de eventos
            
        Returns:
            str: Resumen de eventos
        """
        # Contar eventos por tipo
        conteo_tipos = {}
        for evento in eventos:
            tipo = evento.get('tipo', 'info')
            conteo_tipos[tipo] = conteo_tipos.get(tipo, 0) + 1
        
        # Generar texto de resumen
        tipos_texto = []
        for tipo, cantidad in conteo_tipos.items():
            if tipo == 'error':
                tipos_texto.append(f"{cantidad} errores")
            elif tipo == 'warning':
                tipos_texto.append(f"{cantidad} advertencias")
            elif tipo == 'info':
                tipos_texto.append(f"{cantidad} informaciones")
            elif tipo == 'success':
                tipos_texto.append(f"{cantidad} exitosos")
        
        return ", ".join(tipos_texto)
    
    def _prepare_detailed_context(self, eventos: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Prepara el contexto para la plantilla detallada
        
        Args:
            eventos: Lista de eventos
            
        Returns:
            Dict[str, Any]: Contexto específico para plantilla detallada
        """
        # Generar contenido HTML para los eventos
        detalle_eventos = ""
        detalle_eventos_texto = ""
        
        for evento in eventos:
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
        
        return {
            'detalle_eventos': detalle_eventos,
            'detalle_eventos_texto': detalle_eventos_texto
        }
    
    def _prepare_summary_by_sender_context(self, eventos: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Prepara el contexto para la plantilla resumida por emisor
        
        Args:
            eventos: Lista de eventos
            
        Returns:
            Dict[str, Any]: Contexto específico para plantilla resumida por emisor
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
        
        return {
            'resumen_emisor': resumen_emisor,
            'resumen_emisor_texto': resumen_emisor_texto
        }
    
    def _prepare_summary_by_mailbox_context(self, eventos: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Prepara el contexto para la plantilla resumida por casilla
        
        Args:
            eventos: Lista de eventos
            
        Returns:
            Dict[str, Any]: Contexto específico para plantilla resumida por casilla
        """
        # Contar tipos de eventos
        conteo = {'error': 0, 'warning': 0, 'info': 0, 'success': 0}
        
        for evento in eventos:
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
        
        return {
            'resumen_casilla': resumen_casilla,
            'resumen_casilla_texto': resumen_casilla_texto
        }
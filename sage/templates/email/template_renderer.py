"""
Renderizador de plantillas de email para SAGE

Este módulo proporciona la funcionalidad para renderizar plantillas de email,
remplazando las variables con valores dinámicos del contexto.
"""

import logging
import re
from typing import Dict, Any, Tuple, Optional, List, Union

logger = logging.getLogger(__name__)

class TemplateRenderer:
    """
    Renderizador de plantillas de email
    
    Esta clase proporciona métodos para:
    - Renderizar plantillas HTML y texto plano
    - Reemplazar variables con valores dinámicos
    - Sanitizar contenido para evitar problemas de seguridad
    """
    
    def __init__(self):
        """Inicializa el renderizador de plantillas"""
        # Patrón para buscar variables en la plantilla: {{variable}} o {{ variable }}
        self._pattern = re.compile(r'{{(\s*[\w\._-]+\s*)}}')
    
    def render_subject(self, template: Dict[str, Any], context: Dict[str, Any]) -> str:
        """
        Renderiza el asunto de una plantilla
        
        Args:
            template: Diccionario con la plantilla
            context: Diccionario con variables para reemplazar
            
        Returns:
            str: Asunto renderizado
        """
        asunto = template.get('asunto', '')
        if not asunto:
            return 'Notificación SAGE'
            
        return self._replace_variables(asunto, context)
    
    def render(self, template: Dict[str, Any], context: Dict[str, Any]) -> Tuple[str, str]:
        """
        Renderiza una plantilla con el contexto proporcionado
        
        Args:
            template: Diccionario con la plantilla
            context: Diccionario con variables para reemplazar
            
        Returns:
            Tuple[str, str]: (contenido HTML, contenido texto plano)
        """
        # Obtener contenido de la plantilla
        html_content = template.get('contenido_html', '')
        text_content = template.get('contenido_texto', '')
        
        # Si no hay contenido HTML pero hay contenido texto, convertir a HTML básico
        if not html_content and text_content:
            html_content = self._text_to_basic_html(text_content)
        
        # Si no hay contenido texto pero hay contenido HTML, extraer texto del HTML
        if not text_content and html_content:
            text_content = self._html_to_basic_text(html_content)
        
        # Renderizar ambos contenidos
        rendered_html = self._replace_variables(html_content, context)
        rendered_text = self._replace_variables(text_content, context)
        
        # Sanitizar contenido HTML
        rendered_html = self._sanitize_html(rendered_html)
        
        return rendered_html, rendered_text
    
    def _replace_variables(self, content: str, context: Dict[str, Any]) -> str:
        """
        Reemplaza variables en el contenido con valores del contexto
        
        Args:
            content: Contenido con variables
            context: Contexto con valores para reemplazar
            
        Returns:
            str: Contenido con variables reemplazadas
        """
        if not content:
            return content
            
        # Función para reemplazar cada coincidencia
        def replace_match(match):
            var_name = match.group(1).strip()
            
            # Obtener valor del contexto, o dejar la variable intacta si no existe
            return str(context.get(var_name, match.group(0)))
            
        # Reemplazar todas las variables
        return self._pattern.sub(replace_match, content)
    
    def _sanitize_html(self, html_content: str) -> str:
        """
        Sanitiza el contenido HTML para evitar problemas de seguridad
        
        Args:
            html_content: Contenido HTML
            
        Returns:
            str: Contenido HTML sanitizado
        """
        # Por ahora, simplemente devolvemos el contenido sin modificar
        # En una implementación real, aquí se aplicarían medidas de seguridad
        # como filtrar scripts, etc.
        return html_content
    
    def _text_to_basic_html(self, text_content: str) -> str:
        """
        Convierte texto plano a HTML básico
        
        Args:
            text_content: Contenido en texto plano
            
        Returns:
            str: Contenido convertido a HTML básico
        """
        if not text_content:
            return ""
            
        # Escapar entidades HTML
        html = text_content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        
        # Convertir saltos de línea a <br>
        html = html.replace("\n", "<br>")
        
        # Envolver en estructura HTML básica
        html = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            </style>
        </head>
        <body>
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                {html}
            </div>
        </body>
        </html>
        """
        
        return html
    
    def _html_to_basic_text(self, html_content: str) -> str:
        """
        Extrae texto plano de contenido HTML
        
        Args:
            html_content: Contenido HTML
            
        Returns:
            str: Contenido convertido a texto plano
        """
        if not html_content:
            return ""
            
        # Implementación simple para extraer texto
        # En una implementación real, se usaría una biblioteca como BeautifulSoup
        
        # Eliminar etiquetas HTML comunes
        text = html_content
        text = re.sub(r'<head>.*?</head>', '', text, flags=re.DOTALL)
        text = re.sub(r'<style>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<script>.*?</script>', '', text, flags=re.DOTALL)
        
        # Reemplazar etiquetas de párrafo y salto de línea con saltos de línea
        text = re.sub(r'<br\s*/?>', '\n', text)
        text = re.sub(r'<p.*?>', '\n\n', text)
        text = re.sub(r'</p>', '', text)
        
        # Eliminar todas las demás etiquetas HTML
        text = re.sub(r'<.*?>', '', text)
        
        # Reemplazar entidades HTML comunes
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        text = text.replace('&apos;', "'")
        
        # Eliminar espacios en blanco múltiples
        text = re.sub(r'\s+', ' ', text)
        
        # Eliminar espacios al inicio y final de líneas
        lines = text.split('\n')
        lines = [line.strip() for line in lines]
        text = '\n'.join(lines)
        
        # Eliminar líneas en blanco múltiples
        text = re.sub(r'\n\s*\n', '\n\n', text)
        
        return text.strip()
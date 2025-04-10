"""
Renderizador de plantillas de email para SAGE

Este módulo proporciona funcionalidades para renderizar plantillas
de email con diferentes formatos y estilos.
"""

import logging
import re
import html
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

class TemplateRenderer:
    """Renderizador de plantillas para diferentes formatos"""
    
    def __init__(self):
        """Inicializa el renderizador de plantillas"""
        # Patrones de reemplazo para variables
        self.var_pattern = re.compile(r'{{([^{}]+?)}}')
        self.var_pattern_spaces = re.compile(r'{{ *([^{}]+?) *}}')
    
    def render(self, template: Dict[str, Any], context: Dict[str, Any]) -> Tuple[str, str]:
        """Renderiza una plantilla con el contexto dado
        
        Args:
            template: Plantilla a renderizar
            context: Diccionario con variables para interpolar
            
        Returns:
            Tuple[str, str]: Contenido HTML y contenido de texto plano
        """
        # Obtener contenidos de la plantilla
        html_content = template.get('contenido_html', '')
        text_content = template.get('contenido_texto', '')
        
        # Si no hay contenido en la plantilla, devolver contenido vacío
        if not html_content and not text_content:
            logger.warning(f"Plantilla {template.get('nombre', 'desconocida')} sin contenido")
            return '', ''
        
        # Renderizar contenido HTML
        if html_content:
            rendered_html = self._render_html(html_content, context)
        else:
            # Si no hay HTML pero hay texto, convertir el texto a HTML básico
            rendered_html = self._text_to_html(text_content, context) if text_content else ''
        
        # Renderizar contenido de texto plano
        if text_content:
            rendered_text = self._render_text(text_content, context)
        else:
            # Si no hay texto pero hay HTML, generar texto a partir del HTML
            rendered_text = self._html_to_text(html_content, context) if html_content else ''
        
        return rendered_html, rendered_text
    
    def render_subject(self, template: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Renderiza el asunto de la plantilla
        
        Args:
            template: Plantilla a renderizar
            context: Diccionario con variables para interpolar
            
        Returns:
            str: Asunto renderizado
        """
        subject = template.get('asunto', '')
        if not subject:
            return ''
            
        return self._interpolate_variables(subject, context)
    
    def _render_html(self, content: str, context: Dict[str, Any]) -> str:
        """Renderiza contenido HTML
        
        Args:
            content: Contenido HTML
            context: Diccionario con variables
            
        Returns:
            str: HTML renderizado
        """
        # Interpolación de variables
        rendered = self._interpolate_variables(content, context)
        
        # Validación básica de HTML
        rendered = self._sanitize_html(rendered)
        
        return rendered
    
    def _render_text(self, content: str, context: Dict[str, Any]) -> str:
        """Renderiza contenido de texto plano
        
        Args:
            content: Contenido de texto
            context: Diccionario con variables
            
        Returns:
            str: Texto renderizado
        """
        # Interpolación de variables
        rendered = self._interpolate_variables(content, context)
        
        return rendered
    
    def _text_to_html(self, text: str, context: Dict[str, Any]) -> str:
        """Convierte texto plano a HTML
        
        Args:
            text: Contenido de texto
            context: Diccionario con variables
            
        Returns:
            str: HTML generado
        """
        # Primero renderizar el texto con las variables
        rendered_text = self._render_text(text, context)
        
        # Convertir a HTML (escapar caracteres especiales y preservar saltos de línea)
        html_content = html.escape(rendered_text)
        html_content = html_content.replace('\n', '<br>')
        
        # Envolver en una estructura HTML básica
        return f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
            </style>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """
    
    def _html_to_text(self, html_content: str, context: Dict[str, Any]) -> str:
        """Convierte HTML a texto plano
        
        Args:
            html_content: Contenido HTML
            context: Diccionario con variables
            
        Returns:
            str: Texto plano
        """
        # Primero renderizar el HTML con las variables
        rendered_html = self._render_html(html_content, context)
        
        # Eliminar etiquetas HTML (implementación básica)
        # Para una conversión más robusta, se recomendaría usar una biblioteca como BeautifulSoup
        text = re.sub(r'<style.*?>.*?</style>', '', rendered_html, flags=re.DOTALL)
        text = re.sub(r'<script.*?>.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<head.*?>.*?</head>', '', text, flags=re.DOTALL)
        
        # Reemplazar etiquetas comunes por equivalentes de texto
        text = re.sub(r'<br\s*/?>|<p.*?>', '\n', text)
        text = re.sub(r'</p>|</div>', '\n', text)
        text = re.sub(r'<li.*?>', '- ', text)
        text = re.sub(r'</li>', '\n', text)
        text = re.sub(r'<.*?>', '', text)
        
        # Decodificar entidades HTML
        text = html.unescape(text)
        
        # Limpiar espacios en blanco excesivos
        text = re.sub(r'\n\s+', '\n', text)
        text = re.sub(r'\s+\n', '\n', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        return text.strip()
    
    def _interpolate_variables(self, content: str, context: Dict[str, Any]) -> str:
        """Reemplaza variables en el contenido con valores del contexto
        
        Args:
            content: Contenido con variables
            context: Diccionario con valores
            
        Returns:
            str: Contenido con variables reemplazadas
        """
        if not content:
            return content
            
        # Primero procesar variables con espacios
        def replace_var_spaces(match):
            var_name = match.group(1).strip()
            return str(context.get(var_name, match.group(0)))
        
        content = self.var_pattern_spaces.sub(replace_var_spaces, content)
        
        # Luego procesar variables sin espacios
        def replace_var(match):
            var_name = match.group(1).strip()
            return str(context.get(var_name, match.group(0)))
        
        content = self.var_pattern.sub(replace_var, content)
        
        return content
    
    def _sanitize_html(self, html_content: str) -> str:
        """Sanitiza el contenido HTML para evitar XSS
        
        Args:
            html_content: Contenido HTML
            
        Returns:
            str: HTML sanitizado
        """
        # Implementación básica de sanitización
        # Para una sanitización completa, se recomendaría usar una biblioteca como bleach
        # Eliminar scripts y eventos inline
        sanitized = re.sub(r'<script.*?>.*?</script>', '', html_content, flags=re.DOTALL)
        sanitized = re.sub(r' on\w+=".*?"', '', sanitized)
        sanitized = re.sub(r' on\w+=\'.*?\'', '', sanitized)
        sanitized = re.sub(r' on\w+=.*?>', ' >', sanitized)
        
        # Eliminar iframes
        sanitized = re.sub(r'<iframe.*?>.*?</iframe>', '', sanitized, flags=re.DOTALL)
        
        # Eliminar atributos javascript: en URLs
        sanitized = re.sub(r'href="javascript:.*?"', 'href="#"', sanitized)
        sanitized = re.sub(r'href=\'javascript:.*?\'', 'href="#"', sanitized)
        
        return sanitized
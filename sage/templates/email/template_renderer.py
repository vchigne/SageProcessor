"""
Sistema de renderizado de plantillas para SAGE

Este módulo proporciona la funcionalidad para renderizar plantillas,
reemplazando variables con valores reales.
"""

import logging
import re
from typing import Dict, Any, Optional, Match

logger = logging.getLogger(__name__)

class TemplateRenderer:
    """
    Renderizador de plantillas
    
    Esta clase proporciona métodos para renderizar plantillas,
    tanto en formato HTML como texto plano.
    """
    
    def __init__(self):
        """Inicializa el renderizador de plantillas"""
        # Patrón para detectar variables en la plantilla
        self.variable_pattern = r'{{(.*?)}}'
    
    def render_string(self, template_string: Optional[str], context: Dict[str, Any]) -> str:
        """
        Renderiza una cadena de texto reemplazando variables con valores del contexto
        
        Args:
            template_string: Cadena de la plantilla con variables {{variable}}
            context: Diccionario con valores para reemplazar las variables
            
        Returns:
            str: Cadena renderizada
        """
        if not template_string:
            logger.warning("Intentando renderizar una plantilla vacía")
            return ""
            
        try:
            # Reemplazar variables con valores del contexto
            def replace_var(match: Match) -> str:
                var_name = match.group(1).strip()
                
                if '.' in var_name:
                    # Manejar acceso a atributos anidados (e.g. user.name)
                    parts = var_name.split('.')
                    value = context
                    for part in parts:
                        if isinstance(value, dict) and part in value:
                            value = value[part]
                        elif hasattr(value, part):
                            value = getattr(value, part)
                        else:
                            return f"<<Variable desconocida: {var_name}>>"
                else:
                    # Acceso directo al contexto
                    value = context.get(var_name, f"<<Variable desconocida: {var_name}>>")
                
                # Convertir a string si no lo es
                if not isinstance(value, (str, int, float, bool)):
                    value = str(value)
                
                return str(value)
                
            # Reemplazar todas las variables en la plantilla
            rendered = re.sub(self.variable_pattern, replace_var, template_string)
            return rendered
            
        except Exception as e:
            logger.error(f"Error al renderizar plantilla: {e}")
            return f"Error en la plantilla: {str(e)}"
    
    def render_template(self, template: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, str]:
        """
        Renderiza una plantilla completa (asunto, html, texto)
        
        Args:
            template: Diccionario con los elementos de la plantilla
            context: Contexto con valores para las variables
            
        Returns:
            Dict[str, str]: Plantilla renderizada
        """
        rendered = {}
        
        try:
            # Renderizar asunto
            if 'asunto' in template:
                rendered['asunto'] = self.render_string(template['asunto'], context)
                
            # Renderizar contenido HTML
            if 'contenido_html' in template:
                rendered['html'] = self.render_string(template['contenido_html'], context)
                
            # Renderizar contenido de texto plano
            if 'contenido_texto' in template:
                rendered['texto'] = self.render_string(template['contenido_texto'], context)
                
            return rendered
            
        except Exception as e:
            logger.error(f"Error al renderizar plantilla completa: {e}")
            return {
                'asunto': 'Error en la plantilla',
                'html': f'<p>Error al procesar la plantilla: {str(e)}</p>',
                'texto': f'Error al procesar la plantilla: {str(e)}'
            }
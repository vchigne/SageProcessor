"""
Paquete de gestión de plantillas de email para SAGE

Este paquete proporciona las funcionalidades necesarias para:
- Gestionar plantillas de email almacenadas en la base de datos
- Renderizar plantillas con variables dinámicas
- Integrar el sistema de plantillas con el Notificador existente
"""

# Exportar clases principales
from sage.templates.email.template_manager import TemplateManager
from sage.templates.email.template_renderer import TemplateRenderer
from sage.templates.email.notificador_adapter import NotificadorAdapter
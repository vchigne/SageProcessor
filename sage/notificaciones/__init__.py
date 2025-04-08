"""
Módulo de notificaciones para SAGE
Gestiona la creación y envío de notificaciones basadas en eventos del sistema
"""

from sage.notificaciones.notificador import Notificador
from sage.notificaciones.cli import NotificacionesCLI

__all__ = ['Notificador', 'NotificacionesCLI']
"""
Interfaz de línea de comandos para el sistema de notificaciones de SAGE
"""

import os
import sys
import json
import argparse
import logging
import datetime
from typing import Dict, List, Any, Optional

from sage.notificaciones.notificador import Notificador

logger = logging.getLogger(__name__)

class NotificacionesCLI:
    """CLI para el sistema de notificaciones de SAGE"""
    
    def __init__(self):
        """Inicializa el CLI de notificaciones"""
        self.notificador = Notificador()
    
    def ejecutar(self, args=None):
        """Ejecuta el CLI con los argumentos proporcionados
        
        Args:
            args: Lista de argumentos (si es None, se usa sys.argv)
            
        Returns:
            Código de resultado (0 si es exitoso, otro valor en caso de error)
        """
        parser = argparse.ArgumentParser(
            description='Sistema de notificaciones SAGE CLI',
            formatter_class=argparse.RawDescriptionHelpFormatter
        )
        
        subparsers = parser.add_subparsers(dest='comando', help='Comandos disponibles')
        
        # Comando 'enviar'
        enviar_parser = subparsers.add_parser('enviar', help='Enviar notificaciones')
        enviar_parser.add_argument('--portal', type=int, required=True, help='ID del portal')
        enviar_parser.add_argument('--casilla', type=int, help='ID de la casilla (opcional)')
        enviar_parser.add_argument('--eventos', type=str, required=True, help='Archivo JSON con eventos o string JSON')
        
        # Comando 'programadas'
        programadas_parser = subparsers.add_parser('programadas', help='Procesar notificaciones programadas')
        
        # Comando 'test'
        test_parser = subparsers.add_parser('test', help='Enviar una notificación de prueba')
        test_parser.add_argument('--email', type=str, required=True, help='Email de destino')
        
        # Parsear argumentos
        ns = parser.parse_args(args)
        
        # Si no se especifica un comando, mostrar ayuda
        if not ns.comando:
            parser.print_help()
            return 1
        
        # Ejecutar el comando correspondiente
        try:
            if ns.comando == 'enviar':
                return self._cmd_enviar(ns)
            elif ns.comando == 'programadas':
                return self._cmd_programadas(ns)
            elif ns.comando == 'test':
                return self._cmd_test(ns)
            else:
                print(f"Comando desconocido: {ns.comando}")
                return 1
        except Exception as e:
            logger.error(f"Error ejecutando comando {ns.comando}: {e}")
            print(f"Error: {e}")
            return 1
    
    def _cmd_enviar(self, args) -> int:
        """Ejecuta el comando 'enviar'"""
        # Cargar eventos desde archivo o string JSON
        eventos = self._cargar_eventos(args.eventos)
        
        if not eventos:
            print("No se encontraron eventos para procesar")
            return 1
        
        # Procesar eventos
        stats = self.notificador.procesar_eventos(eventos, args.portal, args.casilla)
        
        # Mostrar resultados
        print(f"Procesamiento completado:")
        print(f"  Total eventos: {stats['total']}")
        print(f"  Notificaciones enviadas: {stats['enviados']}")
        print(f"  Errores: {stats['error']}")
        
        return 0 if stats['error'] == 0 else 1
    
    def _cmd_programadas(self, args) -> int:
        """Ejecuta el comando 'programadas'"""
        print(f"Procesando notificaciones programadas... ({datetime.datetime.now()})")
        
        # Procesar notificaciones programadas
        stats = self.notificador.procesar_notificaciones_programadas()
        
        # Mostrar resultados
        print(f"Procesamiento completado:")
        print(f"  Total suscripciones procesadas: {stats['total']}")
        print(f"  Notificaciones enviadas: {stats['procesadas']}")
        print(f"  Errores: {stats['error']}")
        
        return 0 if stats['error'] == 0 else 1
    
    def _cmd_test(self, args) -> int:
        """Ejecuta el comando 'test'"""
        print(f"Enviando notificación de prueba a {args.email}...")
        
        # Crear contenido de prueba
        asunto = "SAGE - Notificación de prueba"
        html = """
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
                .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }
                .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Notificación de prueba SAGE</h2>
                <p>Fecha: {}</p>
            </div>
            <p>Esta es una notificación de prueba del sistema SAGE.</p>
            <p>Si ha recibido este mensaje, el sistema de notificaciones está funcionando correctamente.</p>
            <div class="footer">
                <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>
            </div>
        </body>
        </html>
        """.format(datetime.datetime.now().strftime('%d/%m/%Y %H:%M'))
        
        # Enviar notificación
        resultado = self.notificador.enviar_notificacion_email(
            args.email,
            asunto,
            html
        )
        
        if resultado:
            print("Notificación enviada correctamente")
            return 0
        else:
            print("Error al enviar la notificación")
            return 1
    
    def _cargar_eventos(self, eventos_input: str) -> List[Dict[str, Any]]:
        """Carga eventos desde un archivo o string JSON
        
        Args:
            eventos_input: Ruta a un archivo JSON o string JSON con eventos
            
        Returns:
            Lista de eventos
        """
        try:
            # Primero intentar cargar como archivo
            if os.path.isfile(eventos_input):
                with open(eventos_input, 'r', encoding='utf-8') as f:
                    return json.load(f)
            
            # Si no es un archivo, intentar cargar como string JSON
            return json.loads(eventos_input)
        except Exception as e:
            logger.error(f"Error al cargar eventos: {e}")
            print(f"Error al cargar eventos: {e}")
            return []

def main():
    """Punto de entrada principal para el CLI de notificaciones"""
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Ejecutar CLI
    cli = NotificacionesCLI()
    sys.exit(cli.ejecutar())

if __name__ == '__main__':
    main()
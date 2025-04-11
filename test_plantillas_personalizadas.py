"""
Script para probar el sistema de plantillas personalizadas por cliente

Este script demuestra cómo el SAGE Daemon 2 seleccionaría las plantillas
adecuadas para diferentes clientes según la configuración personalizada.
"""
import os
import sys
import logging
import json
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('test_plantillas')

# Importar utilidades de plantillas
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sage.templates.utils import (
    obtener_plantilla, 
    asignar_plantilla_cliente,
    obtener_asignaciones_cliente
)

def mostrar_plantilla(plantilla, cliente_id=None):
    """
    Muestra información detallada de una plantilla
    
    Args:
        plantilla (dict): Información de la plantilla
        cliente_id (int, optional): ID del cliente
    """
    if not plantilla:
        print(f"No se encontró plantilla adecuada")
        return
    
    cliente_texto = f" para cliente ID {cliente_id}" if cliente_id else ""
    
    print(f"\nPlantilla seleccionada{cliente_texto}:")
    print(f"  ID: {plantilla['id']}")
    print(f"  Nombre: {plantilla['nombre']}")
    print(f"  Tipo/Subtipo: {plantilla['tipo']}/{plantilla['subtipo']}")
    print(f"  Canal: {plantilla['canal']}")
    print(f"  Es predeterminada: {'Sí' if plantilla['es_predeterminada'] else 'No'}")
    print(f"  Asunto: {plantilla['asunto']}")
    print(f"  Contenido HTML (primeros 100 caracteres): {plantilla['contenido_html'][:100]}...")
    print("----------------------------------------------------------")

def probar_seleccion_plantillas():
    """
    Prueba la selección de plantillas con y sin personalización por cliente
    """
    # 1. Escenario básico: Obtener plantilla predeterminada de remitente no autorizado
    print("\n\033[1m1. Selección de plantilla predeterminada:\033[0m")
    plantilla = obtener_plantilla('notificacion', 'remitente_no_autorizado')
    mostrar_plantilla(plantilla)
    
    # 2. Escenario con cliente específico que no tiene personalización
    print("\n\033[1m2. Cliente sin personalización (usa la predeterminada):\033[0m")
    cliente_id = 1  # ID de un cliente que no tiene plantilla personalizada
    plantilla = obtener_plantilla('notificacion', 'remitente_no_autorizado', cliente_id=cliente_id)
    mostrar_plantilla(plantilla, cliente_id)
    
    # 3. Escenario con cliente que tiene plantilla personalizada
    # (Esto solo funcionará si previamente se ha configurado una asignación para este cliente)
    print("\n\033[1m3. Cliente con plantilla personalizada:\033[0m")
    cliente_id = 2  # Cambiar por ID de un cliente que tenga plantilla personalizada
    plantilla = obtener_plantilla('notificacion', 'remitente_no_autorizado', cliente_id=cliente_id)
    mostrar_plantilla(plantilla, cliente_id)
    
    # 4. Listar asignaciones de plantillas por cliente
    print("\n\033[1m4. Asignaciones existentes de plantillas por cliente:\033[0m")
    asignaciones = obtener_asignaciones_cliente()
    if not asignaciones:
        print("No hay asignaciones configuradas.")
    else:
        for asign in asignaciones:
            estado = "Activa" if asign['activo'] else "Inactiva"
            print(f"  - Cliente: {asign['cliente_nombre']} → Plantilla: {asign['plantilla_nombre']} ({asign['tipo']}/{asign['subtipo']}) [{estado}]")

def integrar_con_sage_daemon():
    """
    Ejemplo de cómo se integraría con el procesamiento de SAGE Daemon 2
    """
    print("\n\033[1m5. Ejemplo de integración con SAGE Daemon 2:\033[0m")
    
    # Simulación de procesamiento de email en SAGE Daemon 2
    def procesar_email_ejemplo(email_remitente, casilla_id, organizacion_id):
        print(f"Procesando email de {email_remitente} para casilla {casilla_id} (Org ID: {organizacion_id})")
        
        # Determinar si es un remitente autorizado (simulado)
        es_autorizado = False
        
        if not es_autorizado:
            # Obtener plantilla para remitente no autorizado, personalizada si existe
            plantilla = obtener_plantilla(
                'notificacion', 
                'remitente_no_autorizado',
                cliente_id=organizacion_id
            )
            
            if plantilla:
                # Simular reemplazo de variables en la plantilla
                asunto = plantilla['asunto'].replace('{{fecha}}', datetime.now().strftime('%Y-%m-%d'))
                contenido = plantilla['contenido_html'].replace('{{email_remitente}}', email_remitente)
                
                # Simular envío de respuesta
                print(f"Enviando respuesta con plantilla personalizada ID {plantilla['id']}")
                print(f"Asunto: {asunto}")
                print(f"Primeros 100 caracteres del contenido: {contenido[:100]}...")
            else:
                print("Error: No se encontró plantilla adecuada")
    
    # Simular procesamiento para diferentes organizaciones
    procesar_email_ejemplo('test@example.com', 45, 1)  # Organización sin plantilla personalizada
    print()
    procesar_email_ejemplo('test@example.com', 61, 2)  # Organización con plantilla personalizada (si existe)

def main():
    """Función principal"""
    print("\033[1m== TEST DE PLANTILLAS PERSONALIZADAS POR CLIENTE ==\033[0m\n")
    
    probar_seleccion_plantillas()
    print("\n" + "="*60)
    integrar_con_sage_daemon()

if __name__ == "__main__":
    main()
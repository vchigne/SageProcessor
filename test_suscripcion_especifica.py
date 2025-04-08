import sys
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from sage.notificaciones.notificador import Notificador

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("TestSuscripcion")

# Obtener conexión a la base de datos
def obtener_conexion_db():
    """Obtiene una conexión a la base de datos PostgreSQL"""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("No se encontró la variable de entorno DATABASE_URL")
    
    return psycopg2.connect(db_url)

# Probar suscripción específica
def test_suscripcion_especifica(suscripcion_id=16):
    """Prueba una suscripción específica"""
    notificador = Notificador()
    
    # Obtener la suscripción
    conn = obtener_conexion_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("SELECT * FROM suscripciones WHERE id = %s", (suscripcion_id,))
        suscripcion = cursor.fetchone()
        
        if not suscripcion:
            logger.error(f"No se encontró la suscripción con ID {suscripcion_id}")
            return False
        
        logger.info(f"Suscripción encontrada: {suscripcion['nombre']}")
        logger.info(f"Email: {suscripcion['email']}")
        logger.info(f"Casilla ID: {suscripcion['casilla_id']}")
        
        # Crear eventos de prueba para la casilla específica
        eventos = [
            {
                "tipo": "info",
                "mensaje": "Prueba de notificación",
                "fecha": "2023-04-05 10:00:00",
                "emisor": "Sistema SAGE",
                "casilla_id": suscripcion["casilla_id"]
            },
            {
                "tipo": "success",
                "mensaje": "Archivo procesado correctamente",
                "fecha": "2023-04-05 10:15:00",
                "emisor": "Procesador",
                "casilla_id": suscripcion["casilla_id"]
            }
        ]
        
        # Procesar los eventos
        logger.info(f"Procesando eventos para la casilla {suscripcion['casilla_id']}...")
        resultado = notificador.procesar_eventos(eventos, casilla_id=suscripcion["casilla_id"])
        
        logger.info("Resultado del procesamiento:")
        logger.info(f"  - Total eventos: {resultado['total']}")
        logger.info(f"  - Notificaciones enviadas: {resultado['enviados']}")
        logger.info(f"  - Errores: {resultado['error']}")
        
        return resultado
    
    finally:
        cursor.close()
        conn.close()

# Ejecutar la prueba
if __name__ == "__main__":
    suscripcion_id = 16  # ID de nuestra suscripción de prueba
    if len(sys.argv) > 1:
        suscripcion_id = int(sys.argv[1])
    
    test_suscripcion_especifica(suscripcion_id)
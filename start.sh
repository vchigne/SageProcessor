#!/bin/sh

# Script de inicio para contenedor Docker SAGE
# Ejecuta tanto la aplicación Next.js como los daemons de Python

echo "🚀 Iniciando SAGE Platform..."

# Verificar que las variables de entorno necesarias estén configuradas
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL no está configurado"
    exit 1
fi

# Crear directorios necesarios si no existen
mkdir -p /app/executions /app/logs /app/uploads /app/backups /app/tmp

# Función para manejar la terminación del proceso
cleanup() {
    echo "🛑 Deteniendo servicios..."
    kill $SAGE_DAEMON_PID $JANITOR_PID $NEXTJS_PID 2>/dev/null
    wait
    echo "✅ Servicios detenidos correctamente"
    exit 0
}

# Configurar el manejador de señales
trap cleanup SIGTERM SIGINT

# Verificar conexión a la base de datos
echo "🔍 Verificando conexión a la base de datos..."
until python3 -c "
import psycopg2
import os
try:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.close()
    print('✅ Conexión a BD exitosa')
except Exception as e:
    print(f'❌ Error conectando a BD: {e}')
    exit(1)
"; do
    echo "⏳ Esperando que la base de datos esté disponible..."
    sleep 5
done

# Iniciar SAGE Daemon 2 en segundo plano
echo "🤖 Iniciando SAGE Daemon 2..."
python3 run_sage_daemon2.py > /app/logs/sage_daemon.log 2>&1 &
SAGE_DAEMON_PID=$!
echo "✅ SAGE Daemon 2 iniciado (PID: $SAGE_DAEMON_PID)"

# Iniciar Janitor Daemon en segundo plano
echo "🧹 Iniciando Janitor Daemon..."
python3 janitor_daemon.py > /app/logs/janitor_daemon.log 2>&1 &
JANITOR_PID=$!
echo "✅ Janitor Daemon iniciado (PID: $JANITOR_PID)"

# Esperar un momento para que los daemons se inicialicen
sleep 3

# Iniciar Next.js
echo "🌐 Iniciando servidor web Next.js en puerto $PORT..."
node server.js &
NEXTJS_PID=$!
echo "✅ Servidor web iniciado (PID: $NEXTJS_PID)"

# Mostrar estado de los servicios
echo ""
echo "📊 Estado de los servicios:"
echo "   - SAGE Daemon 2: PID $SAGE_DAEMON_PID"
echo "   - Janitor Daemon: PID $JANITOR_PID"
echo "   - Next.js Server: PID $NEXTJS_PID"
echo ""
echo "🎉 SAGE Platform iniciado correctamente"
echo "🌐 Aplicación web disponible en: http://0.0.0.0:$PORT"
echo ""

# Función para monitorear los procesos
monitor_processes() {
    while true; do
        # Verificar si algún proceso ha terminado
        if ! kill -0 $SAGE_DAEMON_PID 2>/dev/null; then
            echo "❌ SAGE Daemon 2 se ha detenido inesperadamente"
            cleanup
        fi
        
        if ! kill -0 $JANITOR_PID 2>/dev/null; then
            echo "❌ Janitor Daemon se ha detenido inesperadamente"
            cleanup
        fi
        
        if ! kill -0 $NEXTJS_PID 2>/dev/null; then
            echo "❌ Next.js Server se ha detenido inesperadamente"
            cleanup
        fi
        
        sleep 30
    done
}

# Iniciar monitoreo en segundo plano
monitor_processes &
MONITOR_PID=$!

# Esperar a que termine cualquiera de los procesos principales
wait $NEXTJS_PID

# Si llegamos aquí, el proceso principal terminó
cleanup
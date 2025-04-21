import http.server
import socketserver
import os

# Definir puerto (puerto 5050 para evitar conflictos con otros servicios)
PORT = 5050

# Cambiar al directorio de trabajo donde está el archivo ZIP y la página HTML
os.chdir('/home/runner/workspace')

# Configurar manejador
handler = http.server.SimpleHTTPRequestHandler

# Crear y arrancar el servidor
print(f"Iniciando servidor de backup en puerto {PORT}...")
with socketserver.TCPServer(("0.0.0.0", PORT), handler) as httpd:
    print(f"Servidor iniciado en http://0.0.0.0:{PORT}")
    print(f"Puedes acceder a la página de descarga en: http://localhost:{PORT}/sage-cloud-backup.html")
    print("Presiona Ctrl+C para detener el servidor")
    httpd.serve_forever()
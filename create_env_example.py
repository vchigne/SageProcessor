import os

# Asegurarse de que el directorio docker existe
os.makedirs('docker', exist_ok=True)

# Contenido del archivo .env.example
env_example_content = """# Configuración de base de datos
POSTGRES_USER=postgres
POSTGRES_PASSWORD=cambiar_esta_contraseña
POSTGRES_DB=sage
DATABASE_URL=postgres://postgres:cambiar_esta_contraseña@db:5432/sage

# Configuración de la aplicación
NODE_ENV=production

# Configuración opcional de correo electrónico
SMTP_SERVER=smtp.example.com
SMTP_PORT=587
SMTP_USER=usuario@example.com
SMTP_PASSWORD=contraseña_smtp
SMTP_FROM=noreply@example.com"""

# Escribir el contenido al archivo
with open('docker/.env.example', 'w') as f:
    f.write(env_example_content)

print(".env.example creado exitosamente en docker/.env.example")
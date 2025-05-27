#!/usr/bin/env python3
"""
Script de configuración para nuevos servidores SAGE
Automatiza la instalación y configuración inicial del sistema
"""

import os
import sys
import subprocess
import psycopg2
import argparse
from pathlib import Path

def run_command(command, description=""):
    """Ejecuta un comando del sistema y maneja errores"""
    print(f"🔄 {description}")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} - Completado")
            return True
        else:
            print(f"❌ Error en {description}: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error ejecutando comando: {e}")
        return False

def check_dependencies():
    """Verifica que las dependencias estén instaladas"""
    print("🔍 Verificando dependencias del sistema...")
    
    dependencies = ['python3', 'node', 'npm', 'postgresql']
    missing = []
    
    for dep in dependencies:
        if not run_command(f"which {dep}", f"Verificando {dep}"):
            missing.append(dep)
    
    if missing:
        print(f"❌ Dependencias faltantes: {', '.join(missing)}")
        print("Por favor instala las dependencias faltantes antes de continuar.")
        return False
    
    print("✅ Todas las dependencias están instaladas")
    return True

def setup_database(db_host, db_port, db_name, db_user, db_password):
    """Configura la base de datos PostgreSQL"""
    print("🗄️ Configurando base de datos PostgreSQL...")
    
    try:
        # Intentar conectar a la base de datos
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            database=db_name,
            user=db_user,
            password=db_password
        )
        
        print("✅ Conexión a la base de datos establecida")
        
        # Ejecutar el script de inicialización
        script_path = Path(__file__).parent / "init_database.sql"
        if script_path.exists():
            with open(script_path, 'r', encoding='utf-8') as f:
                sql_script = f.read()
            
            cursor = conn.cursor()
            cursor.execute(sql_script)
            conn.commit()
            cursor.close()
            
            print("✅ Script de inicialización de base de datos ejecutado correctamente")
        else:
            print("❌ No se encontró el archivo init_database.sql")
            return False
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error configurando base de datos: {e}")
        return False

def install_node_dependencies():
    """Instala las dependencias de Node.js"""
    print("📦 Instalando dependencias de Node.js...")
    
    if not os.path.exists("package.json"):
        print("❌ No se encontró package.json en el directorio actual")
        return False
    
    commands = [
        "npm install",
        "npm run build"
    ]
    
    for cmd in commands:
        if not run_command(cmd, f"Ejecutando: {cmd}"):
            return False
    
    return True

def install_python_dependencies():
    """Instala las dependencias de Python"""
    print("🐍 Instalando dependencias de Python...")
    
    if os.path.exists("requirements.txt"):
        return run_command("pip3 install -r requirements.txt", "Instalando desde requirements.txt")
    elif os.path.exists("pyproject.toml"):
        return run_command("pip3 install .", "Instalando desde pyproject.toml")
    else:
        print("❌ No se encontró requirements.txt o pyproject.toml")
        return False

def create_env_file(db_host, db_port, db_name, db_user, db_password):
    """Crea el archivo de variables de entorno"""
    print("⚙️ Creando archivo de configuración de entorno...")
    
    env_content = f"""# Configuración de Base de Datos
DATABASE_URL=postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}
PGHOST={db_host}
PGPORT={db_port}
PGDATABASE={db_name}
PGUSER={db_user}
PGPASSWORD={db_password}

# Configuración de la aplicación
NODE_ENV=production
PORT=3000

# Configuración de archivos
MAX_FILE_SIZE=100MB
UPLOAD_TEMP_DIR=/tmp/sage_uploads

# Configuración de logs
LOG_LEVEL=info
LOG_DIR=/var/log/sage
"""
    
    try:
        with open('.env', 'w') as f:
            f.write(env_content)
        print("✅ Archivo .env creado correctamente")
        return True
    except Exception as e:
        print(f"❌ Error creando archivo .env: {e}")
        return False

def setup_directories():
    """Crea los directorios necesarios"""
    print("📁 Creando directorios del sistema...")
    
    directories = [
        'executions',
        'logs',
        'uploads',
        'backups',
        'tmp'
    ]
    
    for directory in directories:
        try:
            os.makedirs(directory, exist_ok=True)
            print(f"✅ Directorio {directory} creado")
        except Exception as e:
            print(f"❌ Error creando directorio {directory}: {e}")
            return False
    
    return True

def main():
    parser = argparse.ArgumentParser(description="Configuración de servidor SAGE")
    parser.add_argument("--db-host", default="localhost", help="Host de PostgreSQL")
    parser.add_argument("--db-port", default="5432", help="Puerto de PostgreSQL")
    parser.add_argument("--db-name", required=True, help="Nombre de la base de datos")
    parser.add_argument("--db-user", required=True, help="Usuario de PostgreSQL")
    parser.add_argument("--db-password", required=True, help="Contraseña de PostgreSQL")
    parser.add_argument("--skip-deps", action="store_true", help="Omitir instalación de dependencias")
    
    args = parser.parse_args()
    
    print("🚀 Iniciando configuración del servidor SAGE")
    print("=" * 50)
    
    # Verificar dependencias del sistema
    if not args.skip_deps and not check_dependencies():
        sys.exit(1)
    
    # Crear directorios necesarios
    if not setup_directories():
        sys.exit(1)
    
    # Configurar base de datos
    if not setup_database(args.db_host, args.db_port, args.db_name, args.db_user, args.db_password):
        sys.exit(1)
    
    # Crear archivo de entorno
    if not create_env_file(args.db_host, args.db_port, args.db_name, args.db_user, args.db_password):
        sys.exit(1)
    
    # Instalar dependencias de Python
    if not args.skip_deps and not install_python_dependencies():
        print("⚠️ Error instalando dependencias de Python, continúa manualmente")
    
    # Instalar dependencias de Node.js
    if not args.skip_deps and not install_node_dependencies():
        print("⚠️ Error instalando dependencias de Node.js, continúa manualmente")
    
    print("=" * 50)
    print("🎉 Configuración completada exitosamente!")
    print("")
    print("Próximos pasos:")
    print("1. Revisa el archivo .env y ajusta las configuraciones necesarias")
    print("2. Configura los proveedores de nube en el panel de administración")
    print("3. Configura las notificaciones por email")
    print("4. Inicia el servidor con: npm start o python run_server.py")
    print("")
    print("Para verificar que todo funciona correctamente:")
    print("- Accede a http://localhost:3000")
    print("- Revisa los logs del sistema")
    print("- Prueba cargar un archivo de ejemplo")

if __name__ == "__main__":
    main()
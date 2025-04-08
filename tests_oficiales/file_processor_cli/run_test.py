#!/usr/bin/env python3
"""
Script para ejecutar el procesador de archivos con archivos de prueba.
Este script es solo para verificar el funcionamiento actual sin modificar nada.
"""
import os
import sys
import tempfile
from datetime import datetime
import time
import threading
import re

# Añadir el directorio raíz al path para importar módulos de sage
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

# Suprimir la salida de procesamiento de índices
import builtins

original_print = builtins.print
def filtered_print(*args, **kwargs):
    # Ignorar completamente si solo es un número o contiene solo números y comas
    if not args:
        return
        
    if len(args) == 1:
        arg = args[0]
        
        # Si es solo un número, ignorar
        if isinstance(arg, (int, float)):
            return
            
        # Si es un string que solo contiene números, comas y espacios, ignorar
        if isinstance(arg, str):
            # Eliminar espacios y comas para comprobar si solo quedan dígitos
            stripped = arg.replace(',', '').replace(' ', '').replace('\n', '')
            if stripped.isdigit():
                return
                
            # Si empieza con coma+espacio seguido de un número, ignorar
            if arg.startswith(', ') and re.match(r',\s+\d+', arg):
                return
    
    # Si llega aquí, imprimir normalmente
    original_print(*args, **kwargs)

builtins.print = filtered_print

# Variable global para controlar el indicador de progreso
processing = False

def html_to_text(html_content):
    """Convierte el contenido HTML del log a texto plano legible"""
    # Eliminar etiquetas HTML comunes
    text = re.sub(r'<div[^>]*>', '', html_content)
    text = re.sub(r'</div>', '', text)
    text = re.sub(r'<span[^>]*>', '', text)
    text = re.sub(r'</span>', '', text)
    text = re.sub(r'<p[^>]*>', '', text)
    text = re.sub(r'</p>', '\n', text)
    
    # Convertir saltos de línea HTML
    text = re.sub(r'<br\s*/?>', '\n', text)
    
    # Extraer información útil de los bloques de mensaje
    timestamps = re.findall(r'<span class="timestamp">(.*?)</span>', html_content)
    severities = re.findall(r'<span class="severity">(.*?)</span>', html_content)
    messages = re.findall(r'<div class="message-content">(.*?)</div>', html_content, re.DOTALL)
    
    # Combinar la información en un formato legible
    result = []
    for i in range(min(len(timestamps), len(severities), len(messages))):
        # Limpiar el mensaje (eliminar etiquetas HTML)
        msg = re.sub(r'<[^>]+>', '', messages[i]).strip()
        severity_upper = severities[i].upper()
        
        # Añadir prefijos según la severidad
        if severity_upper == 'ERROR':
            prefix = '❌ ERROR'
        elif severity_upper == 'WARNING':
            prefix = '⚠️ ADVERTENCIA'
        else:
            prefix = 'ℹ️ INFO'
            
        result.append(f"[{timestamps[i]}] {prefix}: {msg}")
    
    if result:
        return '\n'.join(result)
    else:
        # Si no pudimos extraer los mensajes del formato estructurado,
        # devolver el contenido con etiquetas HTML eliminadas
        text = re.sub(r'<[^>]+>', ' ', html_content)
        # Eliminar múltiples espacios en blanco
        text = re.sub(r'\s+', ' ', text).strip()
        return text

def show_progress():
    """Muestra un indicador de progreso mientras se está procesando"""
    global processing
    processing = True
    spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    i = 0
    start_time = time.time()
    
    while processing:
        elapsed = time.time() - start_time
        mins, secs = divmod(int(elapsed), 60)
        hours, mins = divmod(mins, 60)
        
        if hours > 0:
            time_str = f"{hours}h {mins}m {secs}s"
        elif mins > 0:
            time_str = f"{mins}m {secs}s"
        else:
            time_str = f"{secs}s"
            
        sys.stdout.write(f"\r{spinner[i]} Procesando... (Tiempo transcurrido: {time_str}) ")
        sys.stdout.flush()
        time.sleep(0.1)
        i = (i + 1) % len(spinner)
    
    # Limpiar la línea cuando termine
    sys.stdout.write("\r" + " " * 80 + "\r")
    sys.stdout.flush()

from sage.file_processor import FileProcessor
from sage.logger import SageLogger
from sage.yaml_validator import YAMLValidator

def main():
    """Función principal que ejecuta el procesador de archivos."""
    # Rutas a los archivos
    yaml_file = os.path.abspath(os.path.join(os.path.dirname(__file__), 
                               'yaml/CanalTradicionalArchivosDistribuidora.yaml'))
    zip_file = os.path.abspath(os.path.join(os.path.dirname(__file__), 
                              'data/zip/output.zip'))
    
    # Crear directorio de salida si no existe
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), f'output/actual/procesamiento_{timestamp}'))
    os.makedirs(log_dir, exist_ok=True)
    
    print(f"Iniciando procesamiento con:")
    print(f"  - Archivo YAML: {yaml_file}")
    print(f"  - Archivo ZIP: {zip_file}")
    print(f"  - Directorio de salida: {log_dir}")
    
    # Usar el validador YAML para cargar la configuración
    yaml_validator = YAMLValidator()
    try:
        # Cargar y validar la configuración YAML
        config = yaml_validator.load_and_validate(yaml_file)
        print("✅ Configuración YAML cargada y validada correctamente")
    except Exception as e:
        print(f"❌ Error al cargar o validar el archivo YAML: {str(e)}")
        return 1
    
    # Crear el logger
    logger = SageLogger(log_dir)
    
    # Crear el procesador
    processor = FileProcessor(config, logger)
    
    # Crear un archivo de resultados para capturar la salida
    results_file = os.path.abspath(os.path.join(os.path.dirname(__file__), 'results.txt'))
    
    # Procesar el archivo ZIP
    package_name = "paquete_bi_clorox"  # Nombre del paquete definido en el YAML
    
    print(f"Procesando el archivo ZIP con el paquete '{package_name}'...")
    print(f"(Este proceso puede tardar varios minutos para archivos grandes)")
    start_time = time.time()
    
    # Iniciar el indicador de progreso en un hilo aparte
    global processing
    progress_thread = threading.Thread(target=show_progress)
    progress_thread.daemon = True
    progress_thread.start()
    
    try:
        # Redirigir stdout a null temporalmente para suprimir salida de índices
        original_stdout = sys.stdout
        null_stdout = open(os.devnull, 'w')
        
        try:
            # Silenciar la salida durante el procesamiento para evitar los índices
            sys.stdout = null_stdout
            
            # Ejecutar el procesamiento
            error_count, warning_count = processor.process_zip_file(zip_file, package_name)
        finally:
            # Restaurar stdout
            sys.stdout = original_stdout
            null_stdout.close()
        
        # Detener el indicador de progreso
        processing = False
        progress_thread.join()
        
        elapsed_time = time.time() - start_time
        print(f"✅ Procesamiento completado en {elapsed_time:.2f} segundos.")
        print(f"📊 Resultado: {error_count} errores y {warning_count} advertencias.")
        log_file = os.path.join(log_dir, 'output.log')
        print(f"📄 Consulta el archivo de registro: {log_file}")
        
        # Capturar toda la salida para guardarla en results.txt
        # Redirigimos temporalmente la salida a una variable
        from io import StringIO
        output_capture = StringIO()
        original_stdout = sys.stdout
        sys.stdout = output_capture
        
        # Mostrar un resumen del resultado
        if error_count == 0 and warning_count == 0:
            print("🎉 ¡El procesamiento ha sido exitoso sin errores ni advertencias!")
        elif error_count == 0:
            print(f"⚠️ El procesamiento ha terminado con {warning_count} advertencias.")
        else:
            print(f"❌ El procesamiento ha encontrado {error_count} errores.")
        
        # Listar todos los archivos generados
        print("\n📂 Archivos generados durante el procesamiento:")
        output_files = [f for f in os.listdir(log_dir) if os.path.isfile(os.path.join(log_dir, f))]
        for file in sorted(output_files):
            file_path = os.path.join(log_dir, file)
            size_kb = os.path.getsize(file_path) / 1024
            print(f"  - {file} ({size_kb:.1f} KB)")

        # Verificar si hay resúmenes
        summary_files = [f for f in output_files if "resumen" in f.lower() or "summary" in f.lower()]
        if summary_files:
            print("\n📈 Resúmenes encontrados:")
            for summary_file in summary_files:
                print(f"\n📄 Contenido de {summary_file}:")
                try:
                    with open(os.path.join(log_dir, summary_file), 'r', encoding='utf-8') as f:
                        content = f.read()
                        print(content[:1500] + "..." if len(content) > 1500 else content)
                except Exception as e:
                    print(f"  No se pudo leer el archivo de resumen: {str(e)}")
        
        # Extraer información del archivo de log principal y convertirlo a texto legible
        if os.path.exists(log_file):
            print("\n📋 Información del registro principal:")
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                    # Convertir el HTML a texto plano
                    readable_content = html_to_text(html_content)
                    
                    # Mostrar solo las líneas más relevantes (limitar a errores y advertencias, o últimas líneas)
                    lines = readable_content.split('\n')
                    error_lines = [line for line in lines if 'ERROR' in line.upper()]
                    warning_lines = [line for line in lines if 'ADVERTENCIA' in line or 'WARNING' in line.upper()]
                    
                    if error_lines:
                        print(f"\n🔴 Errores encontrados ({len(error_lines)}):")
                        for i, line in enumerate(error_lines[:10]):  # Mostrar hasta 10 errores
                            print(f"  {line}")
                        if len(error_lines) > 10:
                            print(f"  ... y {len(error_lines) - 10} errores más")
                    
                    if warning_lines:
                        print(f"\n🟠 Advertencias encontradas ({len(warning_lines)}):")
                        for i, line in enumerate(warning_lines[:5]):  # Mostrar hasta 5 advertencias
                            print(f"  {line}")
                        if len(warning_lines) > 5:
                            print(f"  ... y {len(warning_lines) - 5} advertencias más")
                    
                    if not error_lines and not warning_lines:
                        # Si no hay errores ni advertencias, mostrar las últimas líneas del log
                        print("\n📋 Últimas 10 líneas del registro:")
                        for line in lines[-10:]:
                            print(f"  {line}")
            except Exception as e:
                print(f"  No se pudo leer o procesar el archivo de log: {str(e)}")
        
        # Restaurar la salida estándar
        sys.stdout = original_stdout
        
        # Obtener la salida capturada y guardarla en results.txt
        results_content = output_capture.getvalue()
        with open(results_file, 'w', encoding='utf-8') as f:
            # Añadir encabezado con timestamp
            f.write(f"# Resultados del procesamiento de archivos SAGE\n")
            f.write(f"# Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"# Archivo YAML: {yaml_file}\n")
            f.write(f"# Archivo ZIP: {zip_file}\n")
            f.write(f"# Tiempo de procesamiento: {elapsed_time:.2f} segundos\n")
            f.write(f"# Errores: {error_count}, Advertencias: {warning_count}\n")
            f.write("="*80 + "\n\n")
            f.write(results_content)
        
        print(f"\n📝 Se ha guardado un resumen detallado en: {results_file}")
                
    except Exception as e:
        # Detener el indicador de progreso en caso de error
        processing = False
        if progress_thread.is_alive():
            progress_thread.join()
            
        elapsed_time = time.time() - start_time
        print(f"❌ Error al procesar el archivo después de {elapsed_time:.2f} segundos: {str(e)}")
        
        # En caso de error, también lo guardamos en results.txt
        with open(results_file, 'w', encoding='utf-8') as f:
            f.write(f"# ERROR en el procesamiento de archivos SAGE\n")
            f.write(f"# Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"# Archivo YAML: {yaml_file}\n")
            f.write(f"# Archivo ZIP: {zip_file}\n")
            f.write(f"# Tiempo antes del error: {elapsed_time:.2f} segundos\n")
            f.write("="*80 + "\n\n")
            f.write(f"ERROR: {str(e)}\n")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
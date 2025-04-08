#!/usr/bin/env python3
"""
Script simplificado para validar archivos con SAGE y generar un reporte detallado

Este script utiliza el procesador de archivos de SAGE con las mejoras implementadas:
- Generación de un archivo results.txt con estadísticas y detalles de errores
- Validación de columnas (detecta y reporta discrepancias en números de columnas)
- Detección de BOM en archivos CSV
- Manejo de archivos faltantes en paquetes ZIP
- Continuación de la validación aunque haya errores

Uso: python validar_con_reporte.py <archivo_yaml> <archivo_zip_o_csv>
"""
import os
import sys
import yaml
from datetime import datetime

# Importar desde el paquete SAGE
try:
    from sage.models import SageConfig
    from sage.file_processor import FileProcessor
    from sage.logger import SageLogger
except ImportError:
    print("Error: No se pudo importar el paquete SAGE.")
    print("Asegúrate de estar ejecutando este script desde el directorio raíz del proyecto.")
    sys.exit(1)

def validar_archivo(yaml_path, file_path):
    """
    Valida un archivo (ZIP o CSV) utilizando SAGE
    
    Args:
        yaml_path: Ruta al archivo YAML de configuración
        file_path: Ruta al archivo a validar (ZIP o CSV)
    
    Returns:
        bool: True si la validación fue exitosa, False en caso contrario
    """
    try:
        # Crear directorio para logs con timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_dir = f"logs/validacion_{timestamp}"
        os.makedirs(log_dir, exist_ok=True)
        
        print(f"\n🚀 Iniciando validación SAGE:")
        print(f"  📄 Configuración: {yaml_path}")
        print(f"  📦 Archivo: {file_path}")
        print(f"  📁 Logs en: {log_dir}")
        
        # Cargar la configuración YAML
        with open(yaml_path, 'r', encoding='utf-8') as f:
            yaml_data = yaml.safe_load(f)
        
        # Convertir YAML a SageConfig
        config = SageConfig(yaml_data)
        
        # Inicializar logger y processor
        logger = SageLogger(log_dir)
        processor = FileProcessor(config, logger)
        
        # Determinar el nombre del paquete o catálogo
        if file_path.lower().endswith('.zip'):
            # Si es un ZIP, usar el primer paquete de la configuración
            if not config.packages:
                print("Error: No hay paquetes definidos en la configuración YAML")
                return False
            
            name = list(config.packages.keys())[0]
        else:
            # Si es un archivo individual, usar el primer catálogo
            if not config.catalogs:
                print("Error: No hay catálogos definidos en la configuración YAML")
                return False
            
            name = list(config.catalogs.keys())[0]
        
        # Procesar el archivo
        print(f"\n⏳ Procesando archivo...")
        errors, warnings = processor.process_file(file_path, name)
        
        # Calcular total de registros procesados basado en estadísticas
        total_records = sum(stats['records'] for stats in logger.file_stats.values()) if logger.file_stats else 0
        
        # Generar resumen con results.txt
        logger.summary(total_records, errors, warnings)
        
        # Mostrar resultados
        success_rate = ((total_records - errors) / total_records * 100) if total_records > 0 else 0
        
        print(f"\n✅ Validación completada:")
        print(f"  📊 Registros procesados: {total_records}")
        print(f"  ❌ Errores encontrados: {errors}")
        print(f"  ⚠️ Advertencias: {warnings}")
        print(f"  📈 Tasa de éxito: {success_rate:.1f}%")
        
        print(f"\n📋 Reportes generados:")
        print(f"  📄 Log HTML: {os.path.join(log_dir, 'output.log')}")
        print(f"  📝 Resumen TXT: {os.path.join(log_dir, 'results.txt')}")
        
        if errors > 0:
            print(f"\n⚠️ Se encontraron {errors} errores. Consulta los reportes para más detalles.")
            return False
        else:
            print(f"\n🎉 Validación exitosa sin errores.")
            return True
        
    except Exception as e:
        print(f"\n❌ Error durante la validación: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Función principal"""
    if len(sys.argv) != 3:
        print(f"Uso: {sys.argv[0]} <archivo_yaml> <archivo_zip_o_csv>")
        return 1
    
    yaml_path = sys.argv[1]
    file_path = sys.argv[2]
    
    # Verificar que los archivos existan
    if not os.path.exists(yaml_path):
        print(f"Error: El archivo YAML no existe: {yaml_path}")
        return 1
    
    if not os.path.exists(file_path):
        print(f"Error: El archivo a validar no existe: {file_path}")
        return 1
    
    # Realizar la validación
    success = validar_archivo(yaml_path, file_path)
    
    # Código de salida: 0 si éxito, 1 si hubo errores
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
#!/usr/bin/env python3
"""
Script para añadir exportación JSON al logger de SAGE

Este script añade un método para exportar logs completos a un archivo JSON
que incluye errores, advertencias, mensajes y estadísticas.
"""
import os
import sys
import importlib
import json
from datetime import datetime
from types import MethodType

def patch_sage_logger():
    """
    Aplica un parche al SageLogger para añadir la funcionalidad de exportación JSON
    """
    try:
        # Importar SageLogger
        from sage.logger import SageLogger
        
        # Definir el método de exportación a JSON
        def export_json(self, filepath=None):
            """
            Exporta todos los logs y estadísticas a un archivo JSON
            
            Args:
                filepath: Ruta completa donde guardar el archivo JSON.
                          Si es None, se usa 'details.json' en el directorio de logs.
            
            Returns:
                str: Ruta al archivo JSON generado
            """
            if filepath is None:
                filepath = os.path.join(self.log_dir, 'details.json')
            
            # Crear estructura de datos para el JSON
            data = {
                "general_info": {
                    "timestamp": datetime.now().isoformat(),
                    "start_time": self.start_time.isoformat() if hasattr(self, 'start_time') else None,
                    "end_time": datetime.now().isoformat(),
                    "execution_time_seconds": getattr(self, 'execution_time', 0),
                    "config_file": getattr(self, 'config_file', None),
                },
                "summary": {
                    "total_records": getattr(self, 'total_records', 0),
                    "total_errors": getattr(self, 'total_errors', 0),
                    "total_warnings": getattr(self, 'total_warnings', 0),
                    "success_rate": getattr(self, 'success_rate', 100),
                },
                "file_stats": getattr(self, 'file_stats', {}),
                "format_errors": getattr(self, 'format_errors', []),
                "missing_files": getattr(self, 'missing_files', []),
                "skipped_rules": getattr(self, 'skipped_rules', []),
                "logs": []
            }
            
            # Añadir todos los logs (errores, advertencias, mensajes)
            if hasattr(self, 'log_entries'):
                for entry in self.log_entries:
                    log_entry = {
                        "timestamp": entry.get('timestamp', ''),
                        "level": entry.get('level', 'INFO'),
                        "message": entry.get('message', ''),
                        "details": entry.get('details', ''),
                        "file": entry.get('file', ''),
                    }
                    
                    # Añadir campos opcionales solo si existen
                    if 'line' in entry:
                        log_entry["line"] = entry['line']
                    if 'rule' in entry:
                        log_entry["rule"] = entry['rule']
                    if 'validation' in entry:
                        log_entry["validation"] = entry['validation']
                    if 'record' in entry:
                        log_entry["record"] = entry['record']
                    if 'column' in entry:
                        log_entry["column"] = entry['column']
                    if 'value' in entry:
                        log_entry["value"] = entry['value']
                        
                    data['logs'].append(log_entry)
            
            # Exportar a JSON
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print(f"JSON exportado a: {filepath}")
            return filepath
        
        # Añadir el método al SageLogger
        SageLogger.export_json = MethodType(export_json, None)
        
        # Modificar el método summary para llamar a export_json
        original_summary = SageLogger.summary
        
        def new_summary(self, total_records, errors, warnings, config_file=None):
            """Versión modificada de summary que también exporta a JSON"""
            # Guardar los totales como atributos del logger
            self.total_records = total_records
            self.total_errors = errors
            self.total_warnings = warnings
            self.success_rate = ((total_records - errors) / total_records * 100) if total_records > 0 else 100
            self.config_file = config_file
            
            # Llamar al método original
            result = original_summary(self, total_records, errors, warnings, config_file)
            
            # Exportar a JSON
            self.export_json()
            
            return result
        
        # Reemplazar el método summary
        SageLogger.summary = MethodType(new_summary, None)
        
        print("✅ SageLogger parcheado con éxito para exportar a JSON")
        return True
        
    except ImportError as e:
        print(f"❌ Error al importar SageLogger: {str(e)}")
        print("Asegúrate de estar ejecutando este script desde el directorio raíz del proyecto")
        return False
    except Exception as e:
        print(f"❌ Error al aplicar el parche: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Función principal"""
    print("📋 Aplicando parche para exportar logs a JSON...")
    success = patch_sage_logger()
    
    if success:
        print("\n✨ La funcionalidad de exportación a JSON ha sido añadida al SageLogger")
        print("  Ahora el método logger.summary() generará automáticamente:")
        print("  - output.log (HTML)")
        print("  - results.txt (texto plano)")
        print("  - details.json (JSON estructurado)")
        print("\n📝 También puedes llamar a logger.export_json() directamente")
        print("  para generar el archivo JSON en cualquier momento")
    else:
        print("\n❌ No se pudo aplicar el parche")
        print("  Verifica que estás ejecutando el script desde el directorio raíz")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
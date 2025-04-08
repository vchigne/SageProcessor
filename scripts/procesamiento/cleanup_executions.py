
#!/usr/bin/env python3
"""Script para limpiar directorios de ejecuciones antiguos en SAGE"""
import os
import shutil
from datetime import datetime

def cleanup_executions():
    """Elimina directorios de ejecuciones que no sean de hoy"""
    executions_dir = os.path.join(os.getcwd(), "executions")
    
    if not os.path.exists(executions_dir):
        print("El directorio de ejecuciones no existe.")
        return
    
    today = datetime.now().date()
    count_removed = 0
    count_kept = 0
    
    print(f"🧹 Limpiando directorios en: {executions_dir}")
    
    for item in os.listdir(executions_dir):
        item_path = os.path.join(executions_dir, item)
        
        # Verificar si es un directorio
        if os.path.isdir(item_path):
            # Obtener fecha de modificación
            mod_time = os.path.getmtime(item_path)
            mod_date = datetime.fromtimestamp(mod_time).date()
            
            # Si no es de hoy, borrar
            if mod_date != today:
                try:
                    shutil.rmtree(item_path)
                    count_removed += 1
                    print(f"  🗑️  Eliminado: {item}")
                except Exception as e:
                    print(f"  ❌ Error al eliminar {item}: {e}")
            else:
                count_kept += 1
    
    print(f"\n✅ Limpieza completada:")
    print(f"  📊 Directorios eliminados: {count_removed}")
    print(f"  📊 Directorios conservados (de hoy): {count_kept}")

if __name__ == "__main__":
    cleanup_executions()

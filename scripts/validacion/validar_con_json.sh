#!/bin/bash
# Script para validar archivos con SAGE y generar reportes detallados incluyendo JSON
# Uso: ./validar_con_json.sh archivo.yaml archivo.zip

# Verificar argumentos
if [ $# -ne 2 ]; then
    echo "Uso: $0 <archivo_yaml> <archivo_zip_o_csv>"
    exit 1
fi

YAML_FILE=$1
DATA_FILE=$2

# Verificar que los archivos existan
if [ ! -f "$YAML_FILE" ]; then
    echo "Error: El archivo YAML no existe: $YAML_FILE"
    exit 1
fi

if [ ! -f "$DATA_FILE" ]; then
    echo "Error: El archivo a validar no existe: $DATA_FILE"
    exit 1
fi

# Aplicar parche para exportación JSON
echo "🔧 Aplicando parche para exportación JSON..."
python sage_json_export.py

if [ $? -ne 0 ]; then
    echo "❌ Error al aplicar el parche para exportación JSON"
    echo "Continuando sin exportación JSON..."
fi

# Ejecutar el script de validación con reporte
echo -e "\n🚀 Iniciando validación con reportes detallados..."
python validar_con_reporte.py "$YAML_FILE" "$DATA_FILE"

# Guardar el código de salida
EXIT_CODE=$?

# Mostrar mensaje final según el resultado
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "\n✅ Validación exitosa completada."
    echo "Los reportes se han generado correctamente:"
    echo "  - Log HTML (output.log)"
    echo "  - Resumen TXT (results.txt)"
    echo "  - Detalles JSON (details.json)"
else
    echo -e "\n⚠️ La validación encontró errores."
    echo "Consulta los archivos de log para más detalles:"
    echo "  - Log HTML (output.log)"
    echo "  - Resumen TXT (results.txt)"
    echo "  - Detalles JSON (details.json)"
fi

exit $EXIT_CODE
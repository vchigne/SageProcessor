#!/bin/bash
# Script para mover archivos temporales y de prueba a un directorio trashcan
# IMPORTANTE: Este script permite una "limpieza segura" moviendo archivos en lugar de eliminarlos

# Colores para mensajes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Crear directorio trashcan si no existe
TRASHCAN="./trashcan"
mkdir -p $TRASHCAN
mkdir -p $TRASHCAN/directorios
mkdir -p $TRASHCAN/archivos
mkdir -p $TRASHCAN/scripts

echo -e "${BLUE}=== Script de organización de archivos temporales ===${NC}"
echo -e "${GREEN}Este script moverá archivos temporales y de prueba al directorio '$TRASHCAN'${NC}"
echo -e "${GREEN}Los archivos no serán eliminados, podrás recuperarlos si son necesarios${NC}"
echo

# Mostrar espacio actual
echo -e "${YELLOW}Espacio en disco antes de la operación:${NC}"
df -h .

echo -e "\n${BLUE}=== FASE 1: Mover directorios grandes (aproximadamente 1.4GB) ===${NC}"
echo "Los siguientes directorios serán movidos:"
echo " - executions/ (682MB)"
echo " - temp_extract_no_bom/ (109MB)"
echo " - temp_extract/ (52MB)"
echo " - tests/executions/ (54MB)"
echo " - test_csv/ (412MB)"

echo -e "${GREEN}Procesando directorios grandes...${NC}"
# Mover directorios grandes
[ -d "executions" ] && mv executions $TRASHCAN/directorios/
[ -d "temp_extract_no_bom" ] && mv temp_extract_no_bom $TRASHCAN/directorios/
[ -d "temp_extract" ] && mv temp_extract $TRASHCAN/directorios/
[ -d "tests/executions" ] && mkdir -p $TRASHCAN/directorios/tests && mv tests/executions $TRASHCAN/directorios/tests/
[ -d "test_csv" ] && mv test_csv $TRASHCAN/directorios/
echo -e "${GREEN}Fase 1 completada.${NC}"

echo -e "\n${BLUE}=== FASE 2: Mover archivos ZIP grandes (aproximadamente 279MB) ===${NC}"
echo "Los siguientes archivos serán movidos:"
echo " - temp_extra_columns.zip (112MB)"
echo " - temp_missing_columns.zip (109MB)"
echo " - temp_missing_file.zip (58MB)"

echo -e "${GREEN}Procesando archivos ZIP grandes...${NC}"
# Mover archivos ZIP grandes
[ -f "temp_extra_columns.zip" ] && mv temp_extra_columns.zip $TRASHCAN/archivos/
[ -f "temp_missing_columns.zip" ] && mv temp_missing_columns.zip $TRASHCAN/archivos/
[ -f "temp_missing_file.zip" ] && mv temp_missing_file.zip $TRASHCAN/archivos/
[ -f "output_no_bom.zip" ] && mv output_no_bom.zip $TRASHCAN/archivos/
echo -e "${GREEN}Fase 2 completada.${NC}"

echo -e "\n${BLUE}=== FASE 3: Mover directorios de prueba medianos y pequeños ===${NC}"
echo "Procesando directorios de prueba..."

# Lista de directorios de prueba
TEST_DIRS=(
  "test_cli"
  "test_YAML_Studio"
  "test_data"
  "test_multi_tipo_error"
  "test_multi_error"
  "test_results_log"
  "test_faltante"
  "debug_output"
  "test_bom"
  "test_columnas_error"
  "test_columnas_extra"
  "test_pequeno"
  "test_execution_dir"
  "pruebas"
)

# Mover directorios de prueba
for dir in "${TEST_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "Moviendo $dir ..."
    mv "$dir" $TRASHCAN/directorios/
  fi
done
echo -e "${GREEN}Fase 3 completada.${NC}"

echo -e "\n${BLUE}=== FASE 4: Mover archivos de prueba ===${NC}"
echo "Procesando archivos de prueba..."

# Crear directorios para organizar archivos de prueba
mkdir -p $TRASHCAN/archivos/python
mkdir -p $TRASHCAN/archivos/datos
mkdir -p $TRASHCAN/archivos/configs
mkdir -p $TRASHCAN/archivos/logs

# Mover archivos Python de prueba y depuración
echo "Moviendo archivos Python de prueba..."
find . -maxdepth 1 -name "test_*.py" -type f -exec mv {} $TRASHCAN/archivos/python/ \;
find . -maxdepth 1 -name "debug_*.py" -type f -exec mv {} $TRASHCAN/archivos/python/ \;

# Mover archivos CSV, YAML y ZIP de prueba
echo "Moviendo archivos de datos de prueba..."
find . -maxdepth 1 -name "test_*.csv" -o -name "test_*.zip" -o -name "temp_*.csv" -type f -exec mv {} $TRASHCAN/archivos/datos/ \;
find . -maxdepth 1 -name "data.csv" -type f -exec mv {} $TRASHCAN/archivos/datos/ \;
find . -maxdepth 1 -name "test_*.yaml" -o -name "example*.yaml" -o -name "invalid_*.yaml" -o -name "temp_*.yaml" -o -name "output_*.yaml" -type f -exec mv {} $TRASHCAN/archivos/configs/ \;

# Mover archivos de texto y logs
echo "Moviendo archivos de logs y texto..."
find . -maxdepth 1 -name "test_prompt*.txt" -o -name "*.log" -o -name "output_*.txt" -type f -exec mv {} $TRASHCAN/archivos/logs/ \;

echo -e "${GREEN}Fase 4 completada.${NC}"

echo -e "\n${BLUE}=== FASE 5: Organizar scripts útiles ===${NC}"
echo "Esta fase organizará scripts útiles en subdirectorios manteniendo acceso a ellos"

# Organizar scripts por categorías
mkdir -p scripts/analisis scripts/procesamiento scripts/validacion

# Lista de scripts por categoría
ANALISIS_SCRIPTS=("analizar_archivos.py" "analizar_yaml.py")
PROCESAMIENTO_SCRIPTS=(
  "generate_test_prompt.py"
  "eliminar_bom.py"
  "procesar_clorox.py"
  "procesar_clorox_bom.py"
  "procesar_clorox_simple.py"
  "sage_bom.py"
  "sage_column_validator.py"
  "sage_con_bom.py"
  "sage_fixed.py"
  "sage_json_export.py"
  "sage_names_patch.py"
  "sage_robust.py"
  "sage_simple_validator.py"
  "sage_strict.py"
  "ejecutar_processor.py"
  "check_sage_file_processor.py"
  "cleanup_executions.py"
  "trace_sage.py"
  "show_bom_detection.py"
  "show_prompt.py"
  "show_yaml_example.py"
  "show_yaml_example_improved.py"
)
VALIDACION_SCRIPTS=("validar_con_sage.py" "validar_con_reporte.py" "validar.sh" "validar_con_json.sh" "validar_con_reporte.sh")

# Mover scripts de análisis
echo "Organizando scripts de análisis..."
for script in "${ANALISIS_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    cp "$script" scripts/analisis/
    mv "$script" $TRASHCAN/scripts/
  fi
done

# Mover scripts de procesamiento
echo "Organizando scripts de procesamiento..."
for script in "${PROCESAMIENTO_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    cp "$script" scripts/procesamiento/
    mv "$script" $TRASHCAN/scripts/
  fi
done

# Mover scripts de validación
echo "Organizando scripts de validación..."
for script in "${VALIDACION_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    cp "$script" scripts/validacion/
    mv "$script" $TRASHCAN/scripts/
  fi
done

echo -e "${GREEN}Fase 5 completada.${NC}"
echo -e "${GREEN}Scripts organizados y copiados, las versiones originales están en $TRASHCAN/scripts/${NC}"
ls -la scripts/*/

echo -e "\n${BLUE}=== RESUMEN FINAL ===${NC}"
df -h .
echo -e "${YELLOW}Los archivos han sido movidos a $TRASHCAN${NC}"
echo -e "${YELLOW}Puedes revisar su contenido con: ls -la $TRASHCAN/*/${NC}"
echo -e "${GREEN}Para recuperar un archivo/directorio específico: mv $TRASHCAN/[tipo]/[archivo_o_directorio] .${NC}"
echo -e "${RED}Para eliminar todo permanentemente cuando estés seguro: rm -rf $TRASHCAN${NC}"

# Fin del script
echo -e "\n${BLUE}Proceso de organización completado con éxito!${NC}"
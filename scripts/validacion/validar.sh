#!/bin/bash
# Script para validar archivos YAML y ZIP de SAGE

# Colores ANSI
BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
RESET="\033[0m"

# Validar argumentos
if [ $# -lt 2 ]; then
    echo -e "${RED}${BOLD}Error: Se requieren al menos dos argumentos.${RESET}"
    echo "Uso: $0 <archivo_yaml> <archivo_zip>"
    exit 1
fi

YAML_PATH=$1
ZIP_PATH=$2

# Verificar que los archivos existen
if [ ! -f "$YAML_PATH" ]; then
    echo -e "${RED}${BOLD}Error: El archivo YAML no existe: $YAML_PATH${RESET}"
    exit 1
fi

if [ ! -f "$ZIP_PATH" ]; then
    echo -e "${RED}${BOLD}Error: El archivo ZIP no existe: $ZIP_PATH${RESET}"
    exit 1
fi

# Ejecutar la validación
echo -e "${BLUE}${BOLD}Validando archivos SAGE...${RESET}"
echo -e "${BLUE}YAML: $YAML_PATH${RESET}"
echo -e "${BLUE}ZIP: $ZIP_PATH${RESET}"
echo ""

# Ejecutar el script de validación
python validar_con_sage.py "$YAML_PATH" "$ZIP_PATH"
RESULT=$?

# Mostrar resultado
echo ""
if [ $RESULT -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ Validación exitosa.${RESET}"
else
    echo -e "${RED}${BOLD}✘ Validación fallida.${RESET}"
fi

exit $RESULT
#!/usr/bin/env python3
"""
Script para ejecutar todos los tests oficiales de SAGE.

Este script ejecuta la suite completa de tests o un subconjunto específico
según los argumentos proporcionados.

Uso:
    python tests_oficiales/run_all_tests.py [opciones]

Opciones:
    --component COMPONENT    Ejecutar tests solo para un componente específico
                            (file_processor, yaml_studio, sage_daemon)
    --verbose               Mostrar salida detallada
    --coverage              Generar informe de cobertura
    --report                Generar informe HTML de resultados
"""
import os
import sys
import argparse
import subprocess

def parse_args():
    """Parsea los argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description="Ejecuta los tests oficiales de SAGE")
    parser.add_argument("--component", choices=["file_processor", "yaml_studio", "sage_daemon"],
                      help="Ejecutar tests solo para un componente específico")
    parser.add_argument("--verbose", action="store_true", 
                      help="Mostrar salida detallada")
    parser.add_argument("--coverage", action="store_true",
                      help="Generar informe de cobertura")
    parser.add_argument("--report", action="store_true",
                      help="Generar informe HTML de resultados")
    return parser.parse_args()

def run_tests(args):
    """Ejecuta los tests según los argumentos proporcionados"""
    # Directorio base de tests
    tests_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Construir comando de pytest
    cmd = ["python", "-m", "pytest"]
    
    # Agregar opciones según argumentos
    if args.verbose:
        cmd.append("-v")
    
    if args.coverage:
        cmd.extend(["--cov=sage", "--cov=sage_daemon", "--cov-report=term"])
    
    if args.report:
        cmd.extend(["--html=test-report.html", "--self-contained-html"])
    
    # Determinar qué tests ejecutar
    if args.component == "file_processor":
        cmd.append(os.path.join(tests_dir, "file_processor_cli"))
    elif args.component == "yaml_studio":
        cmd.append(os.path.join(tests_dir, "yaml_studio_cli"))
    elif args.component == "sage_daemon":
        cmd.append(os.path.join(tests_dir, "sage_daemon_cli"))
    else:
        # Si no se especifica componente, ejecutar todos los tests
        cmd.append(tests_dir)
    
    # Ejecutar el comando
    print(f"Ejecutando: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    
    return result.returncode

if __name__ == "__main__":
    args = parse_args()
    sys.exit(run_tests(args))
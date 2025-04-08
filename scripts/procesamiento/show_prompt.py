#!/usr/bin/env python3
"""
Script para mostrar el prompt generado
"""
import os

def main():
    """Función principal para mostrar el prompt generado"""
    prompt_file = 'tmp/prompt.txt'
    if os.path.exists(prompt_file):
        with open(prompt_file, 'r', encoding='utf-8') as f:
            prompt = f.read()
            
            print("\n=== PROMPT GENERADO (inicio) ===")
            print(prompt[:2000])
            print("\n=== PROMPT GENERADO (final) ===")
            print(prompt[-2000:])
            
            # Buscar secciones importantes
            print("\n=== SECCIONES IMPORTANTES DEL PROMPT ===")
            if "=== INSTRUCCIONES DEL USUARIO ===" in prompt:
                start_idx = prompt.find("=== INSTRUCCIONES DEL USUARIO ===")
                end_idx = prompt.find("===", start_idx + 30)
                if end_idx == -1:
                    end_idx = len(prompt)
                instrucciones = prompt[start_idx:end_idx].strip()
                print(instrucciones)
            
            # Buscar la sección de ejemplos
            if "=== EJEMPLOS DE DATOS ===" in prompt:
                start_idx = prompt.find("=== EJEMPLOS DE DATOS ===")
                end_idx = prompt.find("===", start_idx + 30)
                if end_idx == -1:
                    end_idx = len(prompt)
                ejemplos = prompt[start_idx:min(start_idx+1000, end_idx)].strip()
                print(ejemplos + "...[truncado]")
    else:
        print(f"No se encontró el archivo de prompt: {prompt_file}")

if __name__ == "__main__":
    main()
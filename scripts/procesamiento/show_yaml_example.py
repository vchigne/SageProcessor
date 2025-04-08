"""
Script para mostrar un ejemplo del YAML generado con soporte BOM
"""

import os
import yaml

def main():
    """Función principal para mostrar un ejemplo de YAML"""
    print("=== Ejemplo de YAML generado con soporte BOM ===")
    
    # Crear un YAML de ejemplo similar al que generaría el sistema
    yaml_dict = {
        "sage_yaml": {
            "name": "ConfiguracionCloroxBOM",
            "description": "Configuración para archivos CSV con BOM y delimitador pipe",
            "version": "1.0.0",
            "author": "YAML Studio"
        },
        "catalogs": {
            "clientes": {
                "name": "Catálogo de Clientes",
                "description": "Información de clientes según las especificaciones",
                "filename": "clientes.csv",
                "file_format": {
                    "type": "CSV",
                    "delimiter": "|",
                    "header": False  # Se detectó que no tiene cabecera
                },
                "fields": [
                    {
                        "name": "COLUMNA_1",
                        "type": "entero",
                        "description": "CódigoProveedor: Código asignado por VidaSoftware al corporativo",
                        "required": True,
                        "unique": False
                    },
                    {
                        "name": "COLUMNA_2",
                        "type": "entero",
                        "description": "CodigoDistribuidor: Código asignado por CLOROX S.A.",
                        "required": True,
                        "unique": False
                    },
                    {
                        "name": "COLUMNA_3",
                        "type": "texto",
                        "description": "CodigoCliente: Código asignado por el ERP",
                        "required": True,
                        "unique": True,
                        "validation_rules": [
                            {
                                "name": "ValidarCodigo",
                                "description": "El código de cliente no debe contener espacios en blanco",
                                "rule": "~df['COLUMNA_3'].astype(str).str.contains(' ')",
                                "severity": "error"
                            }
                        ]
                    },
                    # ... otros campos
                ]
            },
            "productos": {
                "name": "Catálogo de Productos",
                "description": "Información de productos según las especificaciones",
                "filename": "productos.csv",
                "file_format": {
                    "type": "CSV",
                    "delimiter": "|",
                    "header": False  # Se detectó que no tiene cabecera
                },
                "fields": [
                    # ... campos para productos
                ]
            }
            # ... otros catálogos
        },
        "packages": {
            "paquete_principal": {
                "name": "Paquete Principal",
                "description": "Agrupación de todos los catálogos en un ZIP",
                "file_format": {
                    "type": "ZIP"  # Es un paquete ZIP con múltiples catálogos
                },
                "catalogs": [
                    "clientes",
                    "productos",
                    # ... otros catálogos
                ]
            }
        }
    }
    
    # Convertir a YAML y mostrar
    yaml_str = yaml.dump(yaml_dict, sort_keys=False, default_flow_style=False)
    print(yaml_str)
    
    # Guardar en un archivo para referencia
    with open("example_bom_support.yaml", "w", encoding="utf-8") as f:
        f.write(yaml_str)
    
    print("\n=== Mejoras implementadas para soporte BOM ===")
    print("1. Detección automática de BOM en archivos CSV")
    print("2. Uso de la codificación 'utf-8-sig' para manejar correctamente archivos con BOM")
    print("3. Detección precisa del delimitador (pipe '|' en este caso)")
    print("4. Nombres de columna COLUMNA_N para archivos sin cabecera")
    print("5. Validaciones específicas según las instrucciones del usuario")
    print("6. Estructura completa con sage_yaml, catalogs y packages")
    print("\nEjemplo guardado en 'example_bom_support.yaml'")

if __name__ == "__main__":
    main()
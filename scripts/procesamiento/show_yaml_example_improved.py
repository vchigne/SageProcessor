"""
Script para mostrar un ejemplo del YAML generado con soporte BOM mejorado
"""
import yaml

def main():
    """Función principal para mostrar un ejemplo de YAML con soporte BOM completo"""
    # Crear estructura del YAML con soporte para BOM pero sin encoding
    yaml_data = {
        'sage_yaml': {
            'name': 'ConfiguracionCloroxMejorada',
            'description': 'Configuración para archivos CSV con detección automática de BOM',
            'version': '1.0.0',
            'author': 'YAML Studio'
        },
        'catalogs': {
            'clientes': {
                'name': 'Catálogo de Clientes',
                'description': 'Información de clientes según las especificaciones',
                'filename': 'clientes.csv',
                'file_format': {
                    'type': 'CSV',
                    'delimiter': '|',
                    'header': False
                },
                'fields': [
                    {
                        'name': 'COLUMNA_1',
                        'type': 'entero',
                        'description': 'CódigoProveedor: Código asignado por VidaSoftware al corporativo',
                        'required': True,
                        'unique': False
                    },
                    {
                        'name': 'COLUMNA_2',
                        'type': 'entero',
                        'description': 'CodigoDistribuidor: Código asignado por CLOROX S.A.',
                        'required': True,
                        'unique': False
                    },
                    {
                        'name': 'COLUMNA_3',
                        'type': 'texto',
                        'description': 'CodigoCliente: Código asignado por el ERP',
                        'required': True,
                        'unique': True,
                        'validation_rules': [
                            {
                                'name': 'ValidarCodigo',
                                'description': 'El código de cliente no debe contener espacios en blanco',
                                'rule': "~df['COLUMNA_3'].astype(str).str.contains(' ')",
                                'severity': 'error'
                            }
                        ]
                    }
                ]
            },
            'productos': {
                'name': 'Catálogo de Productos',
                'description': 'Información de productos según las especificaciones',
                'filename': 'productos.csv',
                'file_format': {
                    'type': 'CSV',
                    'delimiter': '|',
                    'header': False
                },
                'fields': []
            }
        },
        'packages': {
            'paquete_principal': {
                'name': 'Paquete Principal',
                'description': 'Agrupación de todos los catálogos en un ZIP',
                'file_format': {
                    'type': 'ZIP'
                },
                'catalogs': ['clientes', 'productos']
            }
        }
    }
    
    # Convertir a YAML
    yaml_str = yaml.dump(yaml_data, default_flow_style=False, sort_keys=False)
    
    # Mostrar el YAML
    print("=== YAML con soporte BOM mejorado (detección automática) ===")
    print(yaml_str)
    
    # Explicar las mejoras
    print("\n=== Mejoras en el soporte BOM ===")
    print("1. No se incluye la propiedad 'encoding' en el YAML")
    print("2. La detección de BOM es automática al procesar cada archivo")
    print("3. Se aplica 'utf-8-sig' solo cuando es necesario")
    print("4. Solución más limpia y robusta")
    print("5. Compatible con archivos existentes sin cambios en el formato YAML")
    
    # Guardar el YAML en un archivo para uso futuro
    with open('example_bom_support_improved.yaml', 'w', encoding='utf-8') as f:
        f.write(yaml_str)
    
    print(f"\nYAML guardado en 'example_bom_support_improved.yaml'")

if __name__ == "__main__":
    main()
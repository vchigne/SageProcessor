# Tests para YAML Studio CLI

Este directorio contiene tests específicos para el YAML Studio CLI (`sage.yaml_studio_cli`), que se encarga de generar y validar configuraciones YAML.

## Estructura de Directorios

```
yaml_studio_cli/
├── data/          # Datos de entrada para los tests
│   ├── csv/       # Archivos CSV de muestra
│   ├── excel/     # Archivos Excel de muestra
│   └── mixed/     # Conjuntos de datos mixtos
│
├── output/        # Resultados esperados y generados
│   ├── expected/  # YAMLs esperados para comparación
│   └── actual/    # YAMLs generados por la herramienta
│
└── yaml/          # Configuraciones YAML para tests
    ├── valid/     # YAMLs válidos para verificación
    └── templates/ # Plantillas YAML para generación
```

## Casos de Prueba

Los tests en este directorio cubren los siguientes escenarios:

1. **Análisis de estructura**: Detección automática de estructura de archivos
2. **Generación de YAML**: Creación de configuraciones YAML a partir de archivos
3. **Validación de YAML**: Verificación de configuraciones contra especificaciones
4. **Análisis de cabeceras**: Detección de cabeceras y tipos de datos
5. **Casos especiales**: BOM, caracteres especiales, delimitadores irregulares

## Cómo Ejecutar

Para ejecutar todos los tests del YAML Studio:

```bash
python -m pytest tests_oficiales/yaml_studio_cli
```

Para ejecutar un test específico:

```bash
python -m pytest tests_oficiales/yaml_studio_cli/test_yaml_generation.py::test_generate_from_csv
```

## Convenciones de Nomenclatura

- Los archivos de test deben seguir el patrón `test_[funcionalidad].py`
- Los datos de prueba deben reflejar claramente su estructura y propósito
- Las configuraciones esperadas deben tener el mismo nombre que los datos, con sufijo `_expected`
# Directorio Oficial de Tests de SAGE

Este es el **ÚNICO** directorio oficial de tests para el sistema SAGE. No se deben crear ni mantener otros directorios de tests fuera de esta estructura.

## Estructura

```
tests_oficiales/
├── file_processor_cli/    # Tests para el procesador de archivos CLI
│   ├── data/              # Archivos de datos para tests
│   ├── output/            # Resultados esperados y generados
│   └── yaml/              # Configuraciones YAML para tests
│
├── yaml_studio_cli/       # Tests para YAML Studio CLI
│   ├── data/              # Archivos de datos para tests 
│   ├── output/            # Resultados esperados y generados
│   └── yaml/              # Configuraciones YAML para tests
│
└── sage_daemon_cli/       # Tests para SAGE Daemon CLI
    ├── data/              # Archivos de datos para tests
    ├── output/            # Resultados esperados y generados
    └── yaml/              # Configuraciones YAML para tests
```

## Propósito

Esta estructura estandarizada facilita:

1. La organización clara de los tests por componente funcional
2. La separación de datos de entrada, configuración y resultados esperados
3. La automatización y ejecución consistente de suites de pruebas

## Reglas

1. **Todo test debe estar en este directorio**: No se permite crear tests en otros directorios
2. **Estructura consistente**: Mantener la organización de subdirectorios para cada CLI
3. **Datos de prueba organizados**: Cada tipo de datos en su subdirectorio correspondiente
4. **Control de versiones**: Todos los tests y datos de prueba deben estar bajo control de versiones

## Ejecución de Tests

Se recomienda ejecutar los tests desde la raíz del proyecto utilizando los comandos específicos para cada componente (documentados en los README.md de cada subdirectorio).

```bash
# Por ejemplo, para ejecutar todos los tests del file processor
python -m pytest tests_oficiales/file_processor_cli

# Para ejecutar tests específicos
python -m pytest tests_oficiales/yaml_studio_cli/test_yaml_generation.py
```

## Documentación

Cada subdirectorio contiene un README específico con detalles sobre los tests de ese componente, ejemplos y casos de uso.
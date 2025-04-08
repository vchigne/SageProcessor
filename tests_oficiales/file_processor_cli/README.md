# Tests del Procesador de Archivos SAGE

Este directorio contiene los tests oficiales para el componente de procesamiento de archivos de SAGE.

## Estructura del directorio

```
file_processor_cli/
├── data/              # Datos de prueba
│   └── zip/           # Archivos ZIP para pruebas
│       └── output.zip # Archivo ZIP de prueba
├── output/            # Resultados de las pruebas
│   └── actual/        # Resultados actuales
│   └── expected/      # Resultados esperados
├── yaml/              # Configuraciones YAML para pruebas
│   └── CanalTradicionalArchivosDistribuidora.yaml
├── run_test.py        # Script principal para ejecutar las pruebas
└── README.md          # Este archivo
```

## Funcionamiento

El script `run_test.py` ejecuta el procesador de archivos con una configuración YAML específica y un archivo ZIP. Muestra un indicador de progreso durante el procesamiento y muestra un resumen de los resultados al finalizar.

### Características del script de prueba:

- **Visualización de progreso**: Muestra un indicador de progreso animado con tiempo transcurrido mientras el procesamiento está en curso.
- **Resumen detallado**: Muestra errores, advertencias y archivos generados.
- **Filtrado de salida**: Suprime la salida de índices que normalmente genera el procesador.
- **Visualización de logs**: Muestra las últimas líneas del log y los resúmenes generados.

## Ejecución

Para ejecutar el test, desde la carpeta `tests_oficiales/file_processor_cli`, ejecuta:

```bash
python run_test.py
```

## Resultados

Después de ejecutar el test, los resultados se guardan en `output/actual/procesamiento_TIMESTAMP/`, donde:

- `output.log`: Contiene el registro principal del procesamiento.
- Otros archivos: Pueden incluir resúmenes y otros archivos generados por el procesador.

## Personalización

Para probar con diferentes archivos YAML o ZIP, modifica las variables `yaml_file` y `zip_file` en el script `run_test.py`.
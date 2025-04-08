# Guía de Migración a Tests Oficiales

Esta guía explica cómo migrar tests existentes desde otras ubicaciones hacia la estructura oficial de tests.

## Objetivo

El objetivo de esta migración es consolidar **todos** los tests del proyecto en un único lugar estructurado, siguiendo prácticas consistentes y facilitando la automatización.

## Estructura Estándar

Todos los tests deben seguir esta estructura:

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

## Pasos para la Migración

1. **Identificar tests existentes**:
   - Directorios `tests/`
   - Directorios `sage_daemon/tests/`
   - Archivos de test en directorios `ejemplos/`
   - Archivos de test en directorios `trashcan/`

2. **Categorizar tests por componente**:
   - File Processor: Tests relacionados con validación de archivos
   - YAML Studio: Tests relacionados con generación/validación de YAML
   - Sage Daemon: Tests relacionados con monitoreo y procesamiento automático

3. **Mover archivos a la nueva estructura**:
   - Copiar tests al directorio correspondiente
   - Adaptar imports y rutas para que funcionen con la nueva estructura
   - Usar fixtures definidos en conftest.py en lugar de rutas hardcodeadas

4. **Verificar funcionamiento**:
   - Ejecutar los tests migrados para asegurar que funcionan correctamente
   - Corregir errores de ruta o configuración

5. **Eliminar tests duplicados**:
   - Una vez que todos los tests estén migrados, eliminar los archivos originales

## Ejemplo Práctico

### Test original en `sage_daemon/tests/test_monitors.py`:

```python
"""Pruebas unitarias para los monitores de SAGE Daemon"""
import os
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
from sage_daemon.monitors import EmailMonitor

def test_email_monitor():
    # Código de test...
```

### Test migrado a `tests_oficiales/sage_daemon_cli/test_monitors.py`:

```python
"""Pruebas unitarias para los monitores de SAGE Daemon"""
import os
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
from sage_daemon.monitors import EmailMonitor

def test_email_monitor(test_data_dir):
    # Usar fixture para la ruta en lugar de hardcodear
    test_file = os.path.join(test_data_dir, 'email', 'sample_email.eml')
    # Resto del código de test...
```

## Notas Importantes

1. **Punto único de verdad**: Después de la migración, los tests oficiales son la única fuente de verdad.
2. **No crear nuevos tests fuera de esta estructura**: Todos los nuevos tests deben crearse directamente en la estructura oficial.
3. **Mantener la consistencia**: Seguir las convenciones de nombres y organización para facilitar el mantenimiento.
4. **Documentar propósito**: Agregar docstrings claros que expliquen qué se está probando y cómo.
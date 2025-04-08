"""
Configuración global de pytest para los tests oficiales de SAGE.
Este archivo define fixtures y configuraciones compartidas por todos los tests.
"""
import os
import sys
import pytest
from pathlib import Path

# Asegurar que el directorio raíz del proyecto esté en el path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Fixtures compartidos

@pytest.fixture
def tests_dir():
    """Devuelve la ruta al directorio principal de tests"""
    return os.path.dirname(os.path.abspath(__file__))

@pytest.fixture
def file_processor_tests_dir(tests_dir):
    """Devuelve la ruta al directorio de tests de file processor"""
    return os.path.join(tests_dir, 'file_processor_cli')

@pytest.fixture
def yaml_studio_tests_dir(tests_dir):
    """Devuelve la ruta al directorio de tests de yaml studio"""
    return os.path.join(tests_dir, 'yaml_studio_cli')

@pytest.fixture
def sage_daemon_tests_dir(tests_dir):
    """Devuelve la ruta al directorio de tests de sage daemon"""
    return os.path.join(tests_dir, 'sage_daemon_cli')

@pytest.fixture
def test_data_dir(request):
    """Devuelve la ruta al directorio de datos según el módulo de test actual"""
    module_path = request.module.__file__
    if 'file_processor_cli' in module_path:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'file_processor_cli', 'data')
    elif 'yaml_studio_cli' in module_path:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'yaml_studio_cli', 'data')
    elif 'sage_daemon_cli' in module_path:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sage_daemon_cli', 'data')
    else:
        raise ValueError(f"No se puede determinar el directorio de datos para {module_path}")

@pytest.fixture
def test_output_dir(request):
    """Devuelve la ruta al directorio de salida según el módulo de test actual"""
    module_path = request.module.__file__
    if 'file_processor_cli' in module_path:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'file_processor_cli', 'output')
    elif 'yaml_studio_cli' in module_path:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'yaml_studio_cli', 'output')
    elif 'sage_daemon_cli' in module_path:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sage_daemon_cli', 'output')
    else:
        raise ValueError(f"No se puede determinar el directorio de salida para {module_path}")

@pytest.fixture
def test_yaml_dir(request):
    """Devuelve la ruta al directorio de yaml según el módulo de test actual"""
    module_path = request.module.__file__
    if 'file_processor_cli' in module_path:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'file_processor_cli', 'yaml')
    elif 'yaml_studio_cli' in module_path:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'yaml_studio_cli', 'yaml')
    elif 'sage_daemon_cli' in module_path:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sage_daemon_cli', 'yaml')
    else:
        raise ValueError(f"No se puede determinar el directorio de yaml para {module_path}")
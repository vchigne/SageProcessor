"""Unit tests for SAGE Daemon"""
import os
import pytest
from unittest.mock import Mock, patch, MagicMock, ANY
from datetime import datetime
from sage_daemon.daemon import SageDaemon
from sage.models import SageConfig, Catalog, FileFormat, Field, ValidationRule, Package, Severity

@pytest.fixture
def mock_db():
    with patch('psycopg2.connect') as mock_connect:
        mock_cursor = MagicMock()
        mock_connect.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = mock_cursor
        yield mock_cursor

@pytest.fixture
def daemon():
    return SageDaemon('postgresql://test:test@localhost/test', check_interval=1)

@pytest.fixture
def temp_csv(tmp_path):
    """Create a temporary CSV file for testing"""
    test_file = tmp_path / "test.csv"
    test_file.write_text("test_field\nvalor1\nvalor2\n")
    return test_file

class TestSageDaemon:
    def test_get_active_databoxes_empty(self, mock_db, daemon):
        mock_db.fetchall.return_value = []
        databoxes = daemon.get_active_databoxes()
        assert len(databoxes) == 0

    def test_get_active_databoxes_with_data(self, mock_db, daemon):
        mock_db.description = [('id',), ('nombre_yaml',), ('instalacion_id',),
                            ('metodo_envio_id',), ('tipo_envio',), ('configuracion',)]
        mock_db.fetchall.return_value = [
            (1, 'test.yaml', 1, 1, 'email', {'host': 'test.com'})
        ]

        databoxes = daemon.get_active_databoxes()
        assert len(databoxes) == 1
        assert databoxes[0]['id'] == 1
        assert databoxes[0]['tipo_envio'] == 'email'

    def test_validate_sender_authorized(self, mock_db, daemon):
        mock_db.fetchone.return_value = (1,)
        is_valid = daemon.validate_sender(1, 1)
        assert is_valid is True

    def test_validate_sender_unauthorized(self, mock_db, daemon):
        mock_db.fetchone.return_value = (0,)
        is_valid = daemon.validate_sender(1, 1)
        assert is_valid is False

    def test_validate_sender_error(self, mock_db, daemon):
        mock_db.execute.side_effect = Exception("DB Error")
        is_valid = daemon.validate_sender(1, 1)
        assert is_valid is False

    def test_process_file_success(self, daemon, temp_csv):
        # Preparar mocks
        mock_logger = MagicMock()
        mock_processor = MagicMock()

        # Configurar retorno del processor
        mock_processor.process_file.return_value = ([], [])  # Sin errores ni warnings

        # Configurar la ruta del archivo temporal
        file_info = {
            'path': str(temp_csv),
            'nombre': temp_csv.name,
            'emisor_id': 1
        }

        # Crear una configuración SAGE válida
        sage_config = SageConfig(
            name="Test Config",
            description="Test description",
            version="1.0.0",
            author="Test Author",
            comments="Test comments",
            catalogs={
                "test_catalog": Catalog(
                    name="Test Catalog",
                    description="Test catalog description",
                    filename="test.csv",
                    path=str(temp_csv.parent),
                    file_format=FileFormat(type="CSV", delimiter=",", header=True),
                    fields=[
                        Field(
                            name="test_field",
                            type="texto",
                            required=True,
                            unique=False,
                            validation_rules=[]
                        )
                    ],
                    row_validation=[],
                    catalog_validation=[]
                )
            },
            packages={
                "test_catalog": Package(
                    name="Test Package",
                    description="Test package description",
                    file_format=FileFormat(type="CSV"),
                    catalogs=["test_catalog"],
                    package_validation=[]
                )
            }
        )

        databox = {
            'sage_config': sage_config,
            'package_name': 'test_catalog'
        }

        # Asegurar que el directorio de ejecución existe
        os.makedirs('executions', exist_ok=True)

        # Aplicar los patches en el módulo donde se usan las clases
        with patch('sage_daemon.daemon.SageLogger', return_value=mock_logger) as mock_logger_class:
            with patch('sage_daemon.daemon.FileProcessor', return_value=mock_processor) as mock_processor_class:
                # Ejecutar el método bajo prueba
                execution_uuid = daemon.process_file(file_info, databox)

                # Verificaciones
                assert execution_uuid is not None
                mock_logger_class.assert_called_once_with(ANY)  # Verificar que se creó el logger
                mock_processor_class.assert_called_once_with(sage_config, mock_logger)  # Verificar que se creó el processor
                mock_processor.process_file.assert_called_once_with(  # Verificar que se procesó el archivo
                    file_path=str(temp_csv),
                    package_name='test_catalog'
                )

    @patch('sage_daemon.daemon.SageLogger')
    @patch('sage_daemon.daemon.FileProcessor')
    def test_process_file_error(self, mock_processor_class, mock_logger_class, daemon):
        mock_processor = MagicMock()
        mock_processor_class.return_value = mock_processor
        mock_processor.process_file.side_effect = Exception("Processing Error")

        file_info = {
            'path': '/tmp/test.csv',
            'nombre': 'test.csv',
            'emisor_id': 1
        }
        databox = {
            'sage_config': {'test': 'config'},
            'package_name': 'test_package'
        }

        execution_uuid = daemon.process_file(file_info, databox)
        assert execution_uuid is None

    def test_register_processing_success(self, mock_db, daemon):
        file_info = {
            'emisor_id': 1,
            'nombre': 'test.csv'
        }

        daemon.register_processing('test-uuid', 1, file_info)
        mock_db.execute.assert_called_once()

    def test_register_processing_error(self, mock_db, daemon):
        mock_db.execute.side_effect = Exception("DB Error")
        file_info = {
            'emisor_id': 1,
            'nombre': 'test.csv'
        }

        # No debería lanzar excepción
        daemon.register_processing('test-uuid', 1, file_info)

    @patch('time.sleep')
    def test_run_empty_databoxes(self, mock_sleep, mock_db, daemon):
        mock_db.fetchall.return_value = []

        # Simular una ejecución y luego KeyboardInterrupt
        mock_sleep.side_effect = KeyboardInterrupt()

        with pytest.raises(KeyboardInterrupt):
            daemon.run()

        # Verificar que intentó obtener casillas activas
        assert mock_db.execute.called

    @patch('time.sleep')
    def test_run_with_databoxes(self, mock_sleep, mock_db, daemon):
        # Primera llamada retorna una casilla, segunda llamada simula interrupción
        mock_db.description = [('id',), ('nombre_yaml',), ('instalacion_id',),
                            ('metodo_envio_id',), ('tipo_envio',), ('configuracion',)]
        mock_db.fetchall.return_value = [
            (1, 'test.yaml', 1, 1, 'email', {'host': 'test.com'})
        ]

        # Simular procesamiento y luego KeyboardInterrupt
        mock_sleep.side_effect = KeyboardInterrupt()

        with patch.object(daemon, 'process_databox') as mock_process:
            with pytest.raises(KeyboardInterrupt):
                daemon.run()

            # Verificar que intentó procesar la casilla
            mock_process.assert_called_once()
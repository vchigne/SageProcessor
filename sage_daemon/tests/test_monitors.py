"""Unit tests for monitor classes"""
import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from sage_daemon.monitors import EmailMonitor, SFTPMonitor, FilesystemMonitor

@pytest.fixture
def email_config():
    return {
        'configuracion': {
            'host': 'imap.test.com',
            'usuario': 'test@test.com',
            'password': 'test123'
        }
    }

@pytest.fixture
def sftp_config():
    return {
        'configuracion': {
            'host': 'sftp.test.com',
            'port': 22,
            'usuario': 'test',
            'password': 'test123',
            'path': '/test'
        }
    }

@pytest.fixture
def filesystem_config():
    return {
        'configuracion': {
            'path': '/tmp/test',
            'pattern': '*.csv'
        }
    }

class TestEmailMonitor:
    def test_validate_config(self):
        monitor = EmailMonitor()

        # Config válida
        valid_config = {
            'configuracion': {
                'host': 'test.com',
                'usuario': 'test',
                'password': 'test'
            }
        }
        assert monitor._validate_config(valid_config, ['host', 'usuario', 'password'])

        # Config inválida
        invalid_config = {
            'configuracion': {
                'host': 'test.com',
                'usuario': '',  # Valor vacío
                'password': 'test'
            }
        }
        assert not monitor._validate_config(invalid_config, ['host', 'usuario', 'password'])

    @patch('imaplib.IMAP4_SSL')
    def test_check_new_files_no_messages(self, mock_imap):
        monitor = EmailMonitor()
        mock_conn = MagicMock()
        mock_conn.search.return_value = ('OK', [b''])
        mock_imap.return_value = mock_conn

        files = monitor.check_new_files({
            'configuracion': {
                'host': 'test.com',
                'usuario': 'test',
                'password': 'test'
            }
        })

        assert len(files) == 0
        mock_conn.select.assert_called_once_with('INBOX')
        mock_conn.search.assert_called_once_with(None, '(UNSEEN)')

    @patch('imaplib.IMAP4_SSL')
    def test_check_new_files_with_attachment(self, mock_imap):
        monitor = EmailMonitor()
        mock_conn = MagicMock()

        # Simular mensaje con adjunto
        email_msg = MagicMock()
        email_msg.get.return_value = 'sender@test.com'

        # Crear un mock para la parte del adjunto
        attachment_part = MagicMock()
        attachment_part.get_content_maintype.return_value = 'application'
        attachment_part.get_filename.return_value = 'test.csv'
        attachment_part.get_payload.return_value = b'test,data\n1,2\n'
        attachment_part.get.return_value = 'attachment'

        # Crear un mock para la parte multipart
        multipart = MagicMock()
        multipart.get_content_maintype.return_value = 'multipart'

        # Configurar el walk() para devolver las partes en orden
        email_msg.walk.return_value = [multipart, attachment_part]

        # Mock de búsqueda y recuperación
        mock_conn.search.return_value = ('OK', [b'1'])
        mock_conn.fetch.return_value = ('OK', [(b'1', b'EMAIL_DATA')])
        mock_imap.return_value = mock_conn

        with patch('email.message_from_bytes', return_value=email_msg):
            with patch('os.makedirs', return_value=None):
                with patch('builtins.open', MagicMock()):
                    files = monitor.check_new_files({
                        'configuracion': {
                            'host': 'test.com',
                            'usuario': 'test',
                            'password': 'test'
                        }
                    })

        assert len(files) == 1
        assert files[0]['nombre'] == 'test.csv'
        assert 'path' in files[0]
        assert files[0]['emisor_id'] == 1  # Default placeholder
        assert 'metadata' in files[0]

class TestSFTPMonitor:
    @patch('paramiko.Transport')
    def test_check_new_files_no_files(self, mock_transport):
        monitor = SFTPMonitor()
        mock_sftp = MagicMock()
        mock_sftp.listdir.return_value = []

        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance

        with patch('paramiko.SFTPClient.from_transport', return_value=mock_sftp):
            files = monitor.check_new_files({
                'configuracion': {
                    'host': 'test.com',
                    'port': 22,
                    'usuario': 'test',
                    'password': 'test',
                    'path': '/test'
                }
            })

        assert len(files) == 0
        mock_sftp.listdir.assert_called_once_with('/test')

    @patch('paramiko.Transport')
    def test_check_new_files_with_files(self, mock_transport):
        monitor = SFTPMonitor()
        mock_sftp = MagicMock()
        mock_sftp.listdir.return_value = ['test.csv']

        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance

        with patch('paramiko.SFTPClient.from_transport', return_value=mock_sftp):
            with patch.object(monitor, '_is_processed', return_value=False):
                files = monitor.check_new_files({
                    'configuracion': {
                        'host': 'test.com',
                        'port': 22,
                        'usuario': 'test',
                        'password': 'test',
                        'path': '/test'
                    }
                })

        assert len(files) == 1
        assert files[0]['nombre'] == 'test.csv'
        assert 'path' in files[0]
        mock_sftp.get.assert_called_once()

class TestFilesystemMonitor:
    def test_check_new_files_no_directory(self, tmp_path):
        monitor = FilesystemMonitor()
        non_existent_path = str(tmp_path / 'non_existent')

        files = monitor.check_new_files({
            'configuracion': {
                'path': non_existent_path
            }
        })

        assert len(files) == 0

    def test_check_new_files_with_files(self, tmp_path):
        monitor = FilesystemMonitor()
        test_dir = tmp_path / 'test'
        test_dir.mkdir()

        # Crear archivo de prueba
        test_file = test_dir / 'test.csv'
        test_file.write_text('test,data\n1,2\n')

        with patch.object(monitor, '_is_processed', return_value=False):
            files = monitor.check_new_files({
                'configuracion': {
                    'path': str(test_dir),
                    'pattern': '*.csv'
                }
            })

        assert len(files) == 1
        assert files[0]['nombre'] == 'test.csv'
        assert files[0]['path'] == str(test_file)
        assert 'metadata' in files[0]
#!/usr/bin/env python
"""
Pruebas para el monitor de correo electrónico del SAGE Daemon
"""
import os
import sys
import unittest
import logging
from unittest import mock
from pathlib import Path
from datetime import datetime

# Agregar directorio raíz al path para poder importar los módulos
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from sage_daemon.monitors import EmailMonitor

class TestEmailMonitor(unittest.TestCase):
    """Pruebas para el monitor de correo electrónico"""
    
    def setUp(self):
        """Configuración inicial para las pruebas"""
        # Configurar logging
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Crear instancia del monitor
        self.monitor = EmailMonitor()
        
        # Configuración de prueba para el monitor
        self.test_config = {
            'id': 999,  # ID ficticio para pruebas
            'nombre': 'Casilla de prueba',
            'tipo_envio': 'email',
            'configuracion': {
                'host': 'imap.example.com',
                'port': 993,
                'protocolo': 'imap',
                'ssl': True,
                'usuario': 'test@example.com',
                'password': 'password'
            }
        }
        
        # Crear directorio temporal para las pruebas
        self.temp_dir = f"/tmp/sage_daemon_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        os.makedirs(self.temp_dir, exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, 'email'), exist_ok=True)
    
    def tearDown(self):
        """Limpieza después de las pruebas"""
        # No eliminamos temp_dir por ahora para poder revisar los archivos generados
        pass
    
    @mock.patch('imaplib.IMAP4_SSL')
    def test_check_new_files_no_messages(self, mock_imap):
        """Prueba la función check_new_files cuando no hay mensajes nuevos"""
        # Configurar el mock para simular que no hay mensajes
        mock_imap_instance = mock_imap.return_value
        mock_imap_instance.search.return_value = ('OK', [b''])
        
        # Ejecutar la función
        result = self.monitor.check_new_files(self.test_config)
        
        # Verificar que se llamó a los métodos correctos
        mock_imap_instance.login.assert_called_once()
        mock_imap_instance.select.assert_called_once_with('INBOX')
        mock_imap_instance.search.assert_called_once_with(None, '(UNSEEN)')
        
        # Verificar que el resultado es una lista vacía
        self.assertEqual(result, [])
    
    @mock.patch('psycopg2.connect')
    @mock.patch('imaplib.IMAP4_SSL')
    def test_get_emisor_by_email(self, mock_imap, mock_connect):
        """Prueba la función _get_emisor_id_by_email"""
        # Configurar mock de la conexión a la base de datos
        mock_conn = mock.MagicMock()
        mock_cursor = mock.MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        
        # Configurar el cursor para devolver un ID de emisor
        mock_cursor.fetchone.return_value = (123,)
        
        # Configurar variables de entorno para la conexión a la BD
        os.environ['DATABASE_URL'] = 'postgresql://user:pass@localhost/testdb'
        
        # Ejecutar la función
        emisor_id = self.monitor._get_emisor_id_by_email('test@example.com', 999)
        
        # Verificar que se llamó a los métodos correctos
        mock_cursor.execute.assert_called_once()
        mock_cursor.fetchone.assert_called_once()
        
        # Verificar que el resultado es el esperado
        self.assertEqual(emisor_id, 123)
    
    @mock.patch('email.message_from_bytes')
    @mock.patch('psycopg2.connect')
    @mock.patch('imaplib.IMAP4_SSL')
    def test_check_new_files_with_messages(self, mock_imap, mock_connect, mock_email):
        """Prueba la función check_new_files cuando hay mensajes nuevos"""
        # Configurar mock para la conexión IMAP
        mock_imap_instance = mock_imap.return_value
        mock_imap_instance.search.return_value = ('OK', [b'1 2'])
        mock_imap_instance.fetch.return_value = ('OK', [(b'1', b'EMAIL_BODY')])
        
        # Configurar mock para el procesamiento de email
        mock_email_message = mock.MagicMock()
        mock_email_message.get.side_effect = lambda key, default: 'Sender <sender@example.com>' if key == 'From' else default
        mock_email_message.walk.return_value = [
            mock.MagicMock(get_content_maintype=lambda: 'multipart'),
            mock.MagicMock(
                get_content_maintype=lambda: 'application',
                get=lambda key: 'attachment' if key == 'Content-Disposition' else None,
                get_filename=lambda: 'test_file.zip',
                get_payload=lambda decode: b'FILE_CONTENT'
            )
        ]
        mock_email.return_value = mock_email_message
        
        # Configurar mock para la BD
        mock_conn = mock.MagicMock()
        mock_cursor = mock.MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (456,)
        
        # Configurar variables de entorno
        os.environ['DATABASE_URL'] = 'postgresql://user:pass@localhost/testdb'
        
        # Modificar la configuración para usar nuestro directorio temporal
        self.test_config['temp_dir'] = self.temp_dir
        
        # Ejecutar la función
        with mock.patch('os.makedirs') as mock_makedirs:
            with mock.patch('builtins.open', mock.mock_open()) as mock_file:
                result = self.monitor.check_new_files(self.test_config)
        
        # Verificar que se llamó a los métodos correctos
        mock_imap_instance.login.assert_called_once()
        mock_imap_instance.select.assert_called_once_with('INBOX')
        mock_imap_instance.search.assert_called_once()
        mock_imap_instance.fetch.assert_called()
        mock_imap_instance.store.assert_called()
        
        # Verificar que se creó el directorio temporal
        mock_makedirs.assert_called()
        
        # Verificar que se guardó el archivo
        mock_file.assert_called()
        
        # Verificar el resultado
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['emisor_id'], 456)
        self.assertEqual(result[0]['nombre'], 'test_file.zip')

if __name__ == '__main__':
    unittest.main()
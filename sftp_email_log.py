#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para centralizar el log de procesamiento de SFTP y Email en SAGE Daemon 2

Este script proporciona una clase LogManager que maneja los registros
de actividad tanto para procesamiento SFTP como Email, creando un archivo
de log centralizado y enviando notificaciones por correo electrónico.
"""

import os
import sys
import json
import logging
import smtplib
import tempfile
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication

class LogManager:
    """
    Gestor centralizado de logs para SFTP y Email en SAGE Daemon 2
    """
    
    def __init__(self, config=None):
        """
        Inicializa el gestor de logs
        
        Args:
            config (dict, optional): Configuración del gestor de logs
        """
        self.logger = logging.getLogger("SAGE_LogManager")
        self.config = config or {}
        self.log_file = self.config.get('log_file', 'sage_daemon2_activity.log')
        
        # Configurar logger específico para actividades
        self.activity_logger = self._setup_activity_logger()
        
        # Estadísticas de actividad
        self.stats = {
            'sftp': {
                'files_processed': 0,
                'files_succeeded': 0,
                'files_failed': 0,
                'last_processed_file': None,
                'last_processed_time': None,
                'casillas': {}
            },
            'email': {
                'emails_received': 0,
                'emails_processed': 0,
                'emails_with_attachments': 0,
                'unauthorized_senders': 0,
                'last_processed_email': None,
                'last_processed_time': None,
                'casillas': {}
            }
        }
    
    def _setup_activity_logger(self):
        """
        Configura el logger específico para actividades
        
        Returns:
            logging.Logger: Logger configurado
        """
        activity_logger = logging.getLogger("SAGE_Activity")
        activity_logger.setLevel(logging.INFO)
        
        # Evitar duplicación de handlers
        if not activity_logger.handlers:
            # Handler para archivo
            file_handler = logging.FileHandler(self.log_file)
            file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            file_handler.setFormatter(file_formatter)
            activity_logger.addHandler(file_handler)
            
            # Opcional: Handler para consola
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setFormatter(file_formatter)
            activity_logger.addHandler(console_handler)
        
        return activity_logger
    
    def log_sftp_activity(self, activity_type, file_name=None, casilla_id=None, status=None, details=None):
        """
        Registra actividad SFTP
        
        Args:
            activity_type (str): Tipo de actividad ('start', 'process', 'success', 'error')
            file_name (str, optional): Nombre del archivo
            casilla_id (int, optional): ID de la casilla
            status (str, optional): Estado del proceso
            details (dict, optional): Detalles adicionales
        """
        # Preparar datos de registro
        log_data = {
            'timestamp': datetime.now().isoformat(),
            'type': 'sftp',
            'activity': activity_type,
            'file_name': file_name,
            'casilla_id': casilla_id,
            'status': status,
            'details': details or {}
        }
        
        # Actualizar estadísticas
        if activity_type == 'process':
            self.stats['sftp']['files_processed'] += 1
            if casilla_id is not None:
                casilla_key = str(casilla_id)
                if casilla_key not in self.stats['sftp']['casillas']:
                    self.stats['sftp']['casillas'][casilla_key] = {
                        'files_processed': 0,
                        'files_succeeded': 0,
                        'files_failed': 0
                    }
                self.stats['sftp']['casillas'][casilla_key]['files_processed'] += 1
        
        if activity_type == 'success':
            self.stats['sftp']['files_succeeded'] += 1
            if casilla_id is not None:
                casilla_key = str(casilla_id)
                if casilla_key in self.stats['sftp']['casillas']:
                    self.stats['sftp']['casillas'][casilla_key]['files_succeeded'] += 1
        
        if activity_type == 'error':
            self.stats['sftp']['files_failed'] += 1
            if casilla_id is not None:
                casilla_key = str(casilla_id)
                if casilla_key in self.stats['sftp']['casillas']:
                    self.stats['sftp']['casillas'][casilla_key]['files_failed'] += 1
        
        if file_name:
            self.stats['sftp']['last_processed_file'] = file_name
            self.stats['sftp']['last_processed_time'] = datetime.now().isoformat()
        
        # Registrar actividad
        log_message = f"SFTP {activity_type.upper()}"
        if file_name:
            log_message += f" - Archivo: {file_name}"
        if casilla_id:
            log_message += f" - Casilla: {casilla_id}"
        if status:
            log_message += f" - Estado: {status}"
        
        self.activity_logger.info(log_message)
        
        # Guardar detalles en archivo JSON separado si es necesario
        if details and self.config.get('save_details', False):
            details_dir = self.config.get('details_dir', 'logs/details')
            os.makedirs(details_dir, exist_ok=True)
            
            details_file = os.path.join(
                details_dir, 
                f"sftp_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file_name or 'unknown'}.json"
            )
            
            with open(details_file, 'w', encoding='utf-8') as f:
                json.dump(log_data, f, indent=2)
    
    def log_email_activity(self, activity_type, email_address=None, casilla_id=None, has_attachments=False, status=None, details=None):
        """
        Registra actividad de correo electrónico
        
        Args:
            activity_type (str): Tipo de actividad ('receive', 'process', 'authorized', 'unauthorized', 'success', 'error')
            email_address (str, optional): Dirección de correo electrónico
            casilla_id (int, optional): ID de la casilla
            has_attachments (bool, optional): Si el correo tiene adjuntos
            status (str, optional): Estado del proceso
            details (dict, optional): Detalles adicionales
        """
        # Preparar datos de registro
        log_data = {
            'timestamp': datetime.now().isoformat(),
            'type': 'email',
            'activity': activity_type,
            'email_address': email_address,
            'casilla_id': casilla_id,
            'has_attachments': has_attachments,
            'status': status,
            'details': details or {}
        }
        
        # Actualizar estadísticas
        if activity_type == 'receive':
            self.stats['email']['emails_received'] += 1
        
        if activity_type == 'process':
            self.stats['email']['emails_processed'] += 1
            if casilla_id is not None:
                casilla_key = str(casilla_id)
                if casilla_key not in self.stats['email']['casillas']:
                    self.stats['email']['casillas'][casilla_key] = {
                        'emails_processed': 0,
                        'unauthorized_senders': 0,
                        'emails_with_attachments': 0
                    }
                self.stats['email']['casillas'][casilla_key]['emails_processed'] += 1
        
        if activity_type == 'unauthorized':
            self.stats['email']['unauthorized_senders'] += 1
            if casilla_id is not None:
                casilla_key = str(casilla_id)
                if casilla_key in self.stats['email']['casillas']:
                    self.stats['email']['casillas'][casilla_key]['unauthorized_senders'] += 1
        
        if has_attachments:
            self.stats['email']['emails_with_attachments'] += 1
            if casilla_id is not None:
                casilla_key = str(casilla_id)
                if casilla_key in self.stats['email']['casillas']:
                    self.stats['email']['casillas'][casilla_key]['emails_with_attachments'] += 1
        
        if email_address:
            self.stats['email']['last_processed_email'] = email_address
            self.stats['email']['last_processed_time'] = datetime.now().isoformat()
        
        # Registrar actividad
        log_message = f"EMAIL {activity_type.upper()}"
        if email_address:
            log_message += f" - Email: {email_address}"
        if casilla_id:
            log_message += f" - Casilla: {casilla_id}"
        if has_attachments:
            log_message += " - Con adjuntos"
        if status:
            log_message += f" - Estado: {status}"
        
        self.activity_logger.info(log_message)
        
        # Guardar detalles en archivo JSON separado si es necesario
        if details and self.config.get('save_details', False):
            details_dir = self.config.get('details_dir', 'logs/details')
            os.makedirs(details_dir, exist_ok=True)
            
            # Sanitizar dirección de correo para el nombre de archivo
            safe_email = email_address.replace('@', '_at_').replace('.', '_dot_') if email_address else 'unknown'
            
            details_file = os.path.join(
                details_dir, 
                f"email_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{safe_email}.json"
            )
            
            with open(details_file, 'w', encoding='utf-8') as f:
                json.dump(log_data, f, indent=2)
    
    def generate_activity_report(self, report_type='all', start_date=None, end_date=None):
        """
        Genera un informe de actividad
        
        Args:
            report_type (str, optional): Tipo de informe ('all', 'sftp', 'email')
            start_date (datetime, optional): Fecha de inicio
            end_date (datetime, optional): Fecha de fin
            
        Returns:
            dict: Informe de actividad
        """
        # Si no se especifican fechas, usar todo el período disponible
        if not start_date:
            start_date = datetime.min
        if not end_date:
            end_date = datetime.max
        
        # Filtrar registros por fecha si es necesario
        # Aquí se podría implementar filtrado por fechas en el futuro
        
        # Generar informe según el tipo solicitado
        if report_type == 'all':
            return self.stats
        elif report_type == 'sftp':
            return {'sftp': self.stats['sftp']}
        elif report_type == 'email':
            return {'email': self.stats['email']}
        else:
            return {}
    
    def send_report_email(self, to_address, smtp_config, report_type='all'):
        """
        Envía un informe por correo electrónico
        
        Args:
            to_address (str): Dirección de correo electrónico del destinatario
            smtp_config (dict): Configuración SMTP
            report_type (str, optional): Tipo de informe ('all', 'sftp', 'email')
            
        Returns:
            bool: True si el envío fue exitoso, False en caso contrario
        """
        try:
            # Generar informe
            report_data = self.generate_activity_report(report_type)
            
            # Crear mensaje
            msg = MIMEMultipart()
            msg['Subject'] = f'SAGE Daemon 2 - Informe de Actividad ({datetime.now().strftime("%Y-%m-%d")})'
            msg['From'] = smtp_config.get('usuario', 'sage-daemon@example.com')
            msg['To'] = to_address
            
            # Crear contenido HTML
            html_content = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; }}
                    table {{ border-collapse: collapse; width: 100%; }}
                    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                    th {{ background-color: #f2f2f2; }}
                    .header {{ background-color: #4CAF50; color: white; padding: 10px; }}
                    .section {{ margin-top: 20px; }}
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>SAGE Daemon 2 - Informe de Actividad</h2>
                    <p>Generado el {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
                </div>
            """
            
            # Añadir sección SFTP si corresponde
            if report_type in ['all', 'sftp']:
                sftp_stats = report_data.get('sftp', {})
                html_content += f"""
                <div class="section">
                    <h3>Actividad SFTP</h3>
                    <table>
                        <tr>
                            <th>Métrica</th>
                            <th>Valor</th>
                        </tr>
                        <tr>
                            <td>Archivos procesados</td>
                            <td>{sftp_stats.get('files_processed', 0)}</td>
                        </tr>
                        <tr>
                            <td>Archivos exitosos</td>
                            <td>{sftp_stats.get('files_succeeded', 0)}</td>
                        </tr>
                        <tr>
                            <td>Archivos fallidos</td>
                            <td>{sftp_stats.get('files_failed', 0)}</td>
                        </tr>
                        <tr>
                            <td>Último archivo procesado</td>
                            <td>{sftp_stats.get('last_processed_file', 'N/A')}</td>
                        </tr>
                        <tr>
                            <td>Última hora de proceso</td>
                            <td>{sftp_stats.get('last_processed_time', 'N/A')}</td>
                        </tr>
                    </table>
                """
                
                # Añadir estadísticas por casilla
                casillas = sftp_stats.get('casillas', {})
                if casillas:
                    html_content += f"""
                    <h4>Estadísticas por Casilla</h4>
                    <table>
                        <tr>
                            <th>Casilla ID</th>
                            <th>Archivos Procesados</th>
                            <th>Exitosos</th>
                            <th>Fallidos</th>
                        </tr>
                    """
                    
                    for casilla_id, casilla_stats in casillas.items():
                        html_content += f"""
                        <tr>
                            <td>{casilla_id}</td>
                            <td>{casilla_stats.get('files_processed', 0)}</td>
                            <td>{casilla_stats.get('files_succeeded', 0)}</td>
                            <td>{casilla_stats.get('files_failed', 0)}</td>
                        </tr>
                        """
                    
                    html_content += """
                    </table>
                    """
                
                html_content += """
                </div>
                """
            
            # Añadir sección EMAIL si corresponde
            if report_type in ['all', 'email']:
                email_stats = report_data.get('email', {})
                html_content += f"""
                <div class="section">
                    <h3>Actividad Email</h3>
                    <table>
                        <tr>
                            <th>Métrica</th>
                            <th>Valor</th>
                        </tr>
                        <tr>
                            <td>Emails recibidos</td>
                            <td>{email_stats.get('emails_received', 0)}</td>
                        </tr>
                        <tr>
                            <td>Emails procesados</td>
                            <td>{email_stats.get('emails_processed', 0)}</td>
                        </tr>
                        <tr>
                            <td>Emails con adjuntos</td>
                            <td>{email_stats.get('emails_with_attachments', 0)}</td>
                        </tr>
                        <tr>
                            <td>Remitentes no autorizados</td>
                            <td>{email_stats.get('unauthorized_senders', 0)}</td>
                        </tr>
                        <tr>
                            <td>Último email procesado</td>
                            <td>{email_stats.get('last_processed_email', 'N/A')}</td>
                        </tr>
                        <tr>
                            <td>Última hora de proceso</td>
                            <td>{email_stats.get('last_processed_time', 'N/A')}</td>
                        </tr>
                    </table>
                """
                
                # Añadir estadísticas por casilla
                casillas = email_stats.get('casillas', {})
                if casillas:
                    html_content += f"""
                    <h4>Estadísticas por Casilla</h4>
                    <table>
                        <tr>
                            <th>Casilla ID</th>
                            <th>Emails Procesados</th>
                            <th>No Autorizados</th>
                            <th>Con Adjuntos</th>
                        </tr>
                    """
                    
                    for casilla_id, casilla_stats in casillas.items():
                        html_content += f"""
                        <tr>
                            <td>{casilla_id}</td>
                            <td>{casilla_stats.get('emails_processed', 0)}</td>
                            <td>{casilla_stats.get('unauthorized_senders', 0)}</td>
                            <td>{casilla_stats.get('emails_with_attachments', 0)}</td>
                        </tr>
                        """
                    
                    html_content += """
                    </table>
                    """
                
                html_content += """
                </div>
                """
            
            html_content += """
            </body>
            </html>
            """
            
            # Añadir contenido HTML al mensaje
            msg.attach(MIMEText(html_content, 'html'))
            
            # Añadir archivo JSON con el informe completo
            json_report = json.dumps(report_data, indent=2)
            attachment = MIMEApplication(json_report.encode('utf-8'))
            attachment['Content-Disposition'] = f'attachment; filename="sage_activity_report_{datetime.now().strftime("%Y%m%d")}.json"'
            msg.attach(attachment)
            
            # Enviar correo
            server = smtplib.SMTP(smtp_config.get('servidor_salida'), smtp_config.get('puerto_salida', 587))
            
            if smtp_config.get('usar_tls_salida', True):
                server.starttls()
            
            server.login(smtp_config.get('usuario'), smtp_config.get('password'))
            server.send_message(msg)
            server.quit()
            
            self.logger.info(f"Informe de actividad enviado a {to_address}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error al enviar informe de actividad por correo: {str(e)}")
            return False

# Ejemplo de uso
if __name__ == "__main__":
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler("log_manager_test.log"),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Configuración del gestor de logs
    log_config = {
        'log_file': 'sage_daemon2_activity.log',
        'save_details': True,
        'details_dir': 'logs/details'
    }
    
    # Crear gestor de logs
    log_manager = LogManager(log_config)
    
    # Registrar algunas actividades de prueba
    log_manager.log_sftp_activity(
        activity_type='start',
        file_name=None,
        casilla_id=45,
        status='Starting SFTP monitoring'
    )
    
    log_manager.log_sftp_activity(
        activity_type='process',
        file_name='test_data.csv',
        casilla_id=45,
        status='Processing file'
    )
    
    log_manager.log_sftp_activity(
        activity_type='success',
        file_name='test_data.csv',
        casilla_id=45,
        status='File processed successfully',
        details={
            'execution_dir': 'executions/20250404_123456_test_data.csv',
            'errors': 0,
            'warnings': 2,
            'lines_processed': 100
        }
    )
    
    log_manager.log_email_activity(
        activity_type='receive',
        email_address='sender@example.com',
        casilla_id=45,
        has_attachments=True,
        status='Email received'
    )
    
    log_manager.log_email_activity(
        activity_type='authorized',
        email_address='sender@example.com',
        casilla_id=45,
        has_attachments=True,
        status='Sender authorized'
    )
    
    log_manager.log_email_activity(
        activity_type='process',
        email_address='sender@example.com',
        casilla_id=45,
        has_attachments=True,
        status='Processing attachment',
        details={
            'attachment_name': 'data.csv',
            'attachment_size': 1024
        }
    )
    
    # Generar informe de actividad
    report = log_manager.generate_activity_report()
    print(json.dumps(report, indent=2))
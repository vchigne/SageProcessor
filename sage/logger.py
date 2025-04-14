"""Logging functionality for SAGE"""
import os
import json
import traceback
from datetime import datetime
import uuid
from typing import Optional, Dict, List, Any
from urllib.parse import urlparse
from rich.console import Console
from rich.theme import Theme
from rich.text import Text
from rich.traceback import Traceback

class SageLogger:
    ICONS = {
        "error": "❌",
        "warning": "⚠️",
        "message": "ℹ️",
        "success": "✅",
        "validation": "🔍",
        "file": "📄",
        "process": "⚙️",
        "time": "🕒",
        "details": "📋",
        "summary": "📊",
        "code": "💻",
        "line": "📍",
        "value": "📝",
        "rule": "📏"
    }

    def __init__(self, log_dir: str, casilla_id: Optional[int] = None, emisor_id: Optional[int] = None, metodo_envio: Optional[str] = None):
        self.log_dir = log_dir
        self.report_html = os.path.join(log_dir, "report.html")  # HTML para navegador (renombrado de output.log)
        self.output_log = os.path.join(log_dir, "output.log")    # Log de sistema en texto plano
        self.error_log = os.path.join(log_dir, "error.log")
        self.results_file = os.path.join(log_dir, "results.txt")
        self.report_json = os.path.join(log_dir, "report.json")
        self.casilla_id = casilla_id
        self.emisor_id = emisor_id
        self.metodo_envio = metodo_envio
        self.start_time = datetime.now()
        self.file_stats = {}  # Para almacenar estadísticas por archivo {filename: {records, errors, warnings}}
        self.format_errors = []  # Para almacenar errores de formato específicos
        self.missing_files = []  # Para almacenar archivos faltantes
        self.field_rules_skipped = {}  # {field_name: {rule_name: error_count}}
        self.row_rules_skipped = {}  # {catalog_name: {rule_name: error_count}}
        self.catalog_rules_skipped = {}  # {catalog_name: {rule_name: error_count}}

        # Estructuras de datos para el reporte JSON
        self.events = []  # Lista de todos los eventos (errores, advertencias, mensajes)
        self.validation_failures = []  # Lista detallada de fallos en validaciones

        # Inicializar el log de sistema (texto plano)
        with open(self.output_log, "w", encoding="utf-8") as f:
            f.write(f"=== SAGE Log Inicio: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
            f.write(f"Directorio: {self.log_dir}\n")
            if self.casilla_id:
                f.write(f"Casilla ID: {self.casilla_id}\n")
            if self.emisor_id:
                f.write(f"Emisor ID: {self.emisor_id}\n")
            if self.metodo_envio:
                f.write(f"Método de envío: {self.metodo_envio}\n")
            f.write("=" * 60 + "\n\n")
        self.console = Console(theme=Theme({
            "error": "red",
            "warning": "yellow",
            "message": "blue",
            "success": "green",
            "validation": "cyan",
            "path": "bright_black",
            "detail": "dim"
        }))

        # Initialize log file with HTML structure
        self._initialize_log_file()

    def __del__(self):
        """Ensure HTML structure is closed when logger is destroyed"""
        self._close_log_file()

    def _initialize_log_file(self):
        """Initialize the log file with HTML structure"""
        html_header = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            margin: 0;
            padding: 1rem;
            font-family: system-ui, -apple-system, sans-serif;
            background: #f9fafb;
        }
        .log-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .message-block {
            margin: 1em 0;
            padding: 1.25em;
            border-radius: 8px;
            border: 1px solid var(--message-border);
            background: var(--message-bg);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .message-header {
            display: flex;
            align-items: center;
            gap: 0.75em;
            margin-bottom: 0.75em;
            padding-bottom: 0.75em;
            border-bottom: 1px solid var(--message-border);
        }
        .timestamp {
            color: var(--message-text);
            opacity: 0.7;
            font-size: 0.9em;
        }
        .severity {
            background: var(--message-accent);
            color: white;
            padding: 0.25em 0.75em;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
        }
        .message-content {
            color: var(--message-text);
            line-height: 1.5;
        }
        .details-block {
            margin-top: 1em;
            padding: 1em;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 6px;
        }
        .detail-row {
            display: flex;
            align-items: center;
            gap: 0.5em;
            margin: 0.5em 0;
        }
        .detail-icon {
            font-size: 1.1em;
            min-width: 1.5em;
        }
        .detail-label {
            font-weight: 500;
            margin-right: 0.5em;
        }
        .detail-value {
            font-family: ui-monospace, monospace;
            padding: 0.2em 0.4em;
            background: rgba(255, 255, 255, 0.7);
            border-radius: 4px;
        }
        .summary-block {
            margin: 2em 0;
            padding: 1.5em;
            border-radius: 8px;
            border: 1px solid #E5E7EB;
            background: white;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .summary-title {
            color: #111827;
            font-size: 1.25em;
            font-weight: 600;
            margin: 0 0 1em 0;
            display: flex;
            align-items: center;
            gap: 0.5em;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1em;
            margin-bottom: 1.5em;
        }
        .stat-card {
            padding: 1em;
            background: white;
            border-radius: 6px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            text-align: center;
        }
        .stat-value {
            font-size: 1.5em;
            font-weight: 600;
            color: #111827;
            margin: 0.2em 0;
        }
        .success-rate {
            font-size: 2em;
            font-weight: 700;
            text-align: center;
            padding: 1em;
            background: white;
            border-radius: 8px;
            margin-top: 1em;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
    </style>
</head>
<body>
<div class="log-container">
"""
        with open(self.report_html, "w", encoding="utf-8") as f:
            f.write(html_header)

    def _close_log_file(self):
        """Close the HTML structure in the log file"""
        try:
            with open(self.report_html, "a", encoding="utf-8") as f:
                f.write("\n</div>\n</body>\n</html>")
        except:
            pass  # Ignore errors when closing file during cleanup

        # También cerrar el log de texto
        try:
            elapsed_time = datetime.now() - self.start_time
            with open(self.output_log, "a", encoding="utf-8") as f:
                f.write(f"\n=== SAGE Log Fin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===\n")
                f.write(f"Tiempo transcurrido: {elapsed_time}\n")
                f.write("=" * 60 + "\n")
        except:
            pass

    def _get_severity_colors(self, severity: str) -> dict:
        """Get color scheme based on severity"""
        colors = {
            "error": {
                "bg": "#FEF2F2",
                "border": "#FCA5A5",
                "text": "#991B1B",
                "accent": "#DC2626"
            },
            "warning": {
                "bg": "#FFFBEB",
                "border": "#FCD34D",
                "text": "#92400E",
                "accent": "#D97706"
            },
            "success": {
                "bg": "#F0FDF4",
                "border": "#86EFAC",
                "text": "#166534",
                "accent": "#22C55E"
            },
            "message": {
                "bg": "#EFF6FF",
                "border": "#93C5FD",
                "text": "#1E40AF",
                "accent": "#3B82F6"
            }
        }
        return colors.get(severity, colors["message"])

    def _format_message_block(self, message: str, severity: str, timestamp: str, **kwargs) -> str:
        """Format a message block with proper styling"""
        icon = self.ICONS.get(severity, "")
        colors = self._get_severity_colors(severity)

        # Start with the message block
        message_html = f"""
        <div class="message-block" style="--message-bg: {colors['bg']}; --message-border: {colors['border']}; --message-text: {colors['text']}; --message-accent: {colors['accent']};">
            <div class="message-header">
                <span class="icon" style="font-size: 1.2em;">{icon}</span>
                <span class="timestamp">{timestamp}</span>
                <span class="severity">{severity}</span>
            </div>
            <div class="message-content">
                <p style="margin: 0;">{message}</p>
        """

        # Add details if present
        if kwargs:
            message_html += '<div class="details-block">'
            for key, value in kwargs.items():
                if value is not None:
                    icon = self.ICONS.get(key, "📎")
                    if key == 'file':
                        value = self._format_file_path(str(value))
                    elif key == 'rule':
                        value = self._format_rule(str(value))
                    message_html += f"""
                        <div class="detail-row">
                            <span class="detail-icon">{icon}</span>
                            <span class="detail-label">{key.title()}:</span>
                            <span class="detail-value">{value}</span>
                        </div>
                    """
            message_html += '</div>'

        message_html += '</div></div>\n'
        return message_html

    def log(self, message: str, severity: str, **kwargs):
        """Log a message with severity and details"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        timestamp_iso = datetime.now().isoformat()

        # Format message and any file paths in kwargs
        formatted_message = self._format_message(message)
        if 'file' in kwargs:
            kwargs['file'] = self._format_file_path(kwargs['file'])

        # Write to report HTML
        with open(self.report_html, "a", encoding="utf-8") as f:
            message_block = self._format_message_block(formatted_message, severity, timestamp, **kwargs)
            f.write(message_block)

        # También escribir al log de texto plano
        with open(self.output_log, "a", encoding="utf-8") as f:
            f.write(f"{timestamp} [{severity.upper()}] {message}\n")
            if kwargs:
                for key, value in kwargs.items():
                    if value is not None:
                        f.write(f"  {key}: {value}\n")
                f.write("\n")

        # Print to console with rich formatting
        icon = self.ICONS.get(severity, "")
        self.console.print(f"\n{timestamp} {icon} {severity.upper()}")
        self.console.print(formatted_message)

        if kwargs:
            for key, value in kwargs.items():
                if value is not None:
                    self.console.print(f"  {key}: {value}")

        # Capturar el evento para el reporte JSON
        event_data = {
            "timestamp": timestamp_iso,
            "severity": severity,
            "message": message,  # Guardamos el mensaje original sin formato
            "details": {k: v for k, v in kwargs.items() if v is not None}
        }
        self.events.append(event_data)

        # Si es un error de validación o formato, capturarlo específicamente
        if severity in ["error", "warning"] and any(k in kwargs for k in ["rule", "field", "row", "column"]):
            validation_data = {
                "timestamp": timestamp_iso,
                "severity": severity,
                "message": message,
                "type": "validation_error",
                **{k: v for k, v in kwargs.items() if v is not None and k in ["file", "line", "column", "field", "rule", "value", "expected", "found", "row"]}
            }
            self.validation_failures.append(validation_data)

    def _log_execution_to_db(self, total_records: int, errors: int, warnings: int) -> None:
            try:
                import os
                from psycopg2 import pool

                # Extract execution details
                yaml_path = os.path.join(self.log_dir, "input.yaml")
                data_path = os.path.join(self.log_dir, "data")

                # Get database URL from environment
                database_url = os.environ['DATABASE_URL']

                # Create connection pool
                connection_pool = pool.SimpleConnectionPool(1, 3, database_url)

                # Inicializar variables
                conn = None
                cur = None

                try:
                    conn = connection_pool.getconn()
                    cur = conn.cursor()

                    # Determine estado
                    if errors > 0:
                        estado = 'Fallido'
                    elif warnings > 0:
                        estado = 'Parcial'
                    else:
                        estado = 'Éxito'

                    # Para todas las ejecuciones, validar siempre los IDs contra la BD
                    # para respetar las restricciones de clave foránea
                    validated_casilla_id = None
                    validated_emisor_id = None
                    id_warnings = 0  # Contador de advertencias para IDs inválidos

                    # Validar casilla_id si fue proporcionado
                    if self.casilla_id is not None:
                        cur.execute("SELECT id FROM casillas WHERE id = %s", (self.casilla_id,))
                        if cur.fetchone():
                            validated_casilla_id = self.casilla_id
                        else:
                            # Registrar advertencia si el ID no existe
                            self.warning(f"Casilla con ID {self.casilla_id} no encontrada en la base de datos")
                            id_warnings += 1

                    # Validar emisor_id si fue proporcionado
                    if self.emisor_id is not None:
                        cur.execute("SELECT id FROM emisores WHERE id = %s", (self.emisor_id,))
                        if cur.fetchone():
                            validated_emisor_id = self.emisor_id
                        else:
                            # Registrar advertencia si el ID no existe
                            self.warning(f"Emisor con ID {self.emisor_id} no encontrado en la base de datos")
                            id_warnings += 1

                    # Actualizar estado si hay advertencias de IDs
                    if id_warnings > 0 and estado == 'Éxito':
                        estado = 'Parcial'  # Cambiar a "Parcial" si hay problemas con los IDs

                    # Insert execution record con IDs (validados o no, según el estado)
                    cur.execute("""
                        INSERT INTO ejecuciones_yaml 
                            (nombre_yaml, archivo_datos, estado, 
                             errores_detectados, warnings_detectados, ruta_directorio,
                             casilla_id, emisor_id, metodo_envio)
                        VALUES 
                            (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            os.path.basename(yaml_path),
                            os.path.basename(data_path),
                            estado,
                            errors,
                            warnings,
                            self.log_dir,
                            validated_casilla_id,
                            validated_emisor_id,
                            self.metodo_envio
                        ))

                    conn.commit()

                finally:
                    # Cerrar cursor y devolver conexión solo si fueron creados
                    if cur is not None:
                        try:
                            cur.close()
                        except Exception:
                            pass

                    if conn is not None:
                        try:
                            connection_pool.putconn(conn)
                        except Exception:
                            pass

                    if connection_pool is not None:
                        try:
                            connection_pool.closeall()
                        except Exception:
                            pass

            except Exception as e:
                self.warning(f"No se pudo registrar la ejecución: {str(e)}")

    def summary(self, total_records: int, errors: int, warnings: int):
        """Print a summary of the validation results, generate results.txt and log to database"""
        # Guardar los totales como atributos del logger para que estén disponibles para el reporte por email
        self.total_records = total_records
        self.total_errors = errors
        self.total_warnings = warnings

        # Calcular registros con error (no puede ser mayor que total_records)
        records_with_errors = min(errors, total_records)
        # La tasa de éxito es el porcentaje de registros sin errores
        success_rate = ((total_records - records_with_errors) / total_records * 100) if total_records > 0 else 0
        # Asegurar que la tasa esté entre 0% y 100%
        success_rate = max(0, min(100, success_rate))

        # Color based on success rate
        if success_rate < 60:
            accent_color = "#DC2626"  # Red
        elif success_rate < 80:
            accent_color = "#D97706"  # Yellow
        else:
            accent_color = "#059669"  # Green

        summary_html = f"""
        <div class="summary-block">
            <h3 class="summary-title">
                <span>{self.ICONS['summary']}</span>
                <span>Resumen Final</span>
            </h3>

            <div class="stats-grid">
                <div class="stat-card">
                    <span style="font-size: 1.1em;">📝</span>
                    <div class="stat-value">{total_records}</div>
                    <div>Registros Totales</div>
                </div>
                <div class="stat-card">
                    <span style="font-size: 1.1em;">❌</span>
                    <div class="stat-value">{errors}</div>
                    <div>Errores</div>
                </div>
                <div class="stat-card">
                    <span style="font-size: 1.1em;">⚠️</span>
                    <div class="stat-value">{warnings}</div>
                    <div>Advertencias</div>
                </div>
            </div>

            <div class="success-rate" style="color: {accent_color}">
                <span style="font-size: 0.6em;">✨ Tasa de Éxito</span><br>
                {success_rate:.1f}%
            </div>
        </div>
        """

        with open(self.report_html, "a", encoding="utf-8") as f:
            f.write(summary_html)

        # También escribir la información del resumen al log de texto
        with open(self.output_log, "a", encoding="utf-8") as f:
            f.write(f"\n=== RESUMEN FINAL ===\n")
            f.write(f"Registros totales: {total_records}\n")
            f.write(f"Errores: {errors}\n")
            f.write(f"Advertencias: {warnings}\n")
            f.write(f"Tasa de éxito: {success_rate:.1f}%\n")
            f.write("=" * 30 + "\n")

        # Log execution to database before closing HTML
        self._log_execution_to_db(total_records, errors, warnings)

        # Generar el archivo HTML para email que será adjuntado a los correos
        self.generate_email_html()

        self._close_log_file()  # Close HTML structure after summary

        # Also print to console
        self.console.print("\n🎯 Resumen Final")
        self.console.print(f"  📝 Registros Totales: {total_records}")
        self.console.print(f"  ❌ Errores: {errors}")
        self.console.print(f"  ⚠️ Advertencias: {warnings}")
        if total_records > 0:
            self.console.print(f"  ✨ Tasa de Éxito: {success_rate:.1f}%")

        # Generar el archivo results.txt y report.json
        self.generate_results_txt(total_records, errors, warnings)
        self.generate_report_json(total_records, errors, warnings)

    def error(self, message: str, exception: Optional[Exception] = None, **kwargs):
        """Log an error message with context and optional exception details"""
        if exception:
            kwargs['exception'] = exception
        self.log(message, "error", **kwargs)

    def warning(self, message: str, **kwargs):
        """Log a warning message with context"""
        self.log(message, "warning", **kwargs)

    def message(self, message: str, **kwargs):
        """Log an informational message with context"""
        self.log(message, "message", **kwargs)

    def success(self, message: str, **kwargs):
        """Log a success message with context"""
        self.log(message, "success", **kwargs)

    def validation(self, message: str, **kwargs):
        """Log a validation-specific message with context"""
        self.log(message, "validation", **kwargs)

    def _write_error_log(self, message: str, exc: Exception, **kwargs) -> None:
        """Write complete error details to error log file"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(self.error_log, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*80}\n")
            f.write(f"Error at {timestamp}\n")
            f.write(f"Message: {message}\n")
            f.write(f"Type: {type(exc).__name__}\n")
            f.write(f"Details: {str(exc)}\n\n")
            if kwargs:
                f.write("Context:\n")
                for key, value in kwargs.items():
                    f.write(f"  {key}: {value}\n")
                f.write("\n")
            f.write("Traceback:\n")
            f.write(''.join(traceback.format_exception(type(exc), exc, exc.__traceback__)))
            f.write(f"\n{'='*80}\n")

    def _format_file_path(self, path: str) -> str:
        """Format file path for display"""
        return os.path.basename(path)

    def _format_rule(self, rule: str) -> str:
        """Format validation rule into readable text"""
        rule = str(rule)

        if '.match(' in rule:
            pattern = rule[rule.find("'")+1:rule.rfind("'")]
            return self._format_regex_rule(pattern)

        replacements = {
            "df['": "",
            "']": "",
            "notnull()": "no debe estar vacío",
            ">= 0": "debe ser mayor o igual a cero",
            "> 0": "debe ser mayor que cero",
            "==": "debe ser igual a",
            "!=": "no debe ser igual a",
            "<=": "debe ser menor o igual a",
            "<": "debe ser menor que",
            ">": "debe ser mayor que"
        }

        for old, new in replacements.items():
            rule = rule.replace(old, new)

        return rule

    def _format_regex_rule(self, pattern: str) -> str:
        """Format regex pattern into human-readable description"""
        if pattern.startswith('^'):
            pattern = pattern[1:]
        if pattern.endswith('$'):
            pattern = pattern[:-1]

        if pattern == 'P[0-9]{4}':
            return "El código debe empezar con P seguido de 4 dígitos"
        if '[0-9]{' in pattern:
            count = pattern[pattern.find('{')+1:pattern.find('}')]
            return f"El valor debe tener {count} dígitos"
        if '[0-9]' in pattern:
            return "El valor debe contener dígitos"

        return f"El valor debe coincidir con el patrón: {pattern}"

    def _format_message(self, message: str) -> str:
        """Format log message with translations"""
        translations = {
            "Error processing file": "Error procesando archivo",
            "SAGE error:": "Error de SAGE:",
            "Error evaluating rule": "Error evaluando regla",
            "not supported between instances of": "no es compatible entre tipos",
            "Field must be unique": "El campo debe ser único",
            "Field validation failed:": "Validación fallida:",
            "Field": "Campo",
            "must be unique": "debe ser único",
            "File is not a zip file": "no es un archivo ZIP válido",
            "Please ensure the file has the correct format": "Asegúrate de que el archivo tenga el formato correcto",
            "and is not corrupted": "y no esté dañado"
        }

        # Apply translations
        for eng, esp in translations.items():
            message = message.replace(eng, esp)

        # Extract and format file paths
        words = message.split()
        for i, word in enumerate(words):
            if os.path.exists(word):
                words[i] = self._format_file_path(word)

        return " ".join(words)

    def register_file_stats(self, filename: str, records: int, errors: int, warnings: int):
        """Registra estadísticas de un archivo procesado"""
        self.file_stats[filename] = {
            'records': records,
            'errors': errors,
            'warnings': warnings
        }

    def register_format_error(self, message: str, file: str = None, expected: str = None, found: str = None):
        """Registra un error de formato específico (como discrepancia de columnas)"""
        error_info = {
            'message': message,
            'file': file
        }
        if expected is not None:
            error_info['expected'] = expected
        if found is not None:
            error_info['found'] = found

        self.format_errors.append(error_info)

    def register_missing_file(self, filename: str, package: str = None):
        """Registra un archivo faltante en el paquete ZIP"""
        self.missing_files.append({
            'filename': filename,
            'package': package
        })

    def generate_email_html(self):
        """
        Genera un HTML simplificado y compatible con lectores de correo electrónico.

        Este método crea un archivo HTML especialmente diseñado para ser incluido 
        en correos electrónicos, utilizando estilos en línea y una estructura 
        simplificada para máxima compatibilidad con clientes de correo.

        Returns:
            str: Ruta al archivo HTML generado
        """
        email_html_path = os.path.join(self.log_dir, "email_report.html")

        # Iniciar con estilos simples en línea que sean compatibles con la mayoría de clientes de correo
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Resultados de Procesamiento SAGE</title>
        </head>
        <body style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 15px;">
            <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #0066cc;">
                <h2 style="color: #0066cc; margin-bottom: 5px;">Resultados de Procesamiento SAGE</h2>
            </div>
        """

        # Añadir un resumen con los totales
        success_rate = ((self.total_records - self.total_errors) / self.total_records * 100) if hasattr(self, 'total_records') and self.total_records > 0 else 0
        html += f"""
            <div style="background-color: #f0f5ff; border: 1px solid #ccdcff; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
                <h3 style="color: #0066cc; margin-top: 0;">Resumen del Procesamiento</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd; width: 200px;"><b>Registros Procesados:</b></td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;">{getattr(self, 'total_records', 0):,}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><b>Errores Detectados:</b></td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd; color: {'#cc0000' if getattr(self, 'total_errors', 0) > 0 else '#333'}">{getattr(self, 'total_errors', 0):,}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><b>Advertencias:</b></td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd; color: {'#ff9900' if getattr(self, 'total_warnings', 0) > 0 else '#333'}">{getattr(self, 'total_warnings', 0):,}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px;"><b>Tasa de Éxito:</b></td>
                        <td style="padding: 8px; font-weight: bold; color: {'#009900' if success_rate > 95 else '#ff9900' if success_rate > 80 else '#cc0000'};">{success_rate:.2f}%</td>
                    </tr>
                </table>
            </div>
        """

        # Añadir errores detectados (limitados a 20 para no sobrecargar el correo)
        errors_list = [e for e in self.events if e.get('severity') == 'error'][:20]
        if errors_list:
            html += f"""
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #cc0000; border-bottom: 1px solid #ffcccc; padding-bottom: 5px;">Errores Detectados ({len(errors_list)} mostrados de {getattr(self, 'total_errors', 0)} totales)</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="background-color: #f8f8f8;">
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Archivo</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Línea</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Descripción</th>
                        </tr>
            """

            for idx, error in enumerate(errors_list):
                bg_color = "#ffffff" if idx % 2 == 0 else "#f8f8f8"
                file_name = error.get('details', {}).get('file', 'N/A')
                line_num = error.get('details', {}).get('line', 'N/A')
                html += f"""
                        <tr style="background-color: {bg_color};">
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{file_name}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{line_num}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{error.get('message', 'Sin descripción')}</td>
                        </tr>
                """
            html += """
                    </table>
                </div>
            """
        else:
            html += """
                <div style="margin-bottom: 20px; padding: 15px; background-color: #e6ffe6; border: 1px solid #ccffcc; border-radius: 5px;">
                    <p style="margin: 0; color: #009900;"><b>✓ No se detectaron errores en el procesamiento.</b></p>
                </div>
            """

        # Agregar nota final y cierre de HTML
        html += """
            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                <p>Este es un mensaje automático generado por el sistema SAGE. Para ver el informe completo, consulte los archivos adjuntos.</p>
            </div>
        </body>
        </html>
        """

        # Escribir el HTML al archivo
        with open(email_html_path, 'w', encoding='utf-8') as f:
            f.write(html)

        return email_html_path

    def generate_report_json(self, total_records: int, errors: int, warnings: int):
        """
        Genera un archivo report.json con información detallada de la ejecución

        Este archivo contiene una versión estructurada y detallada de todos los eventos,
        errores y advertencias capturados durante la ejecución del procesamiento.
        Incluye información adicional sobre validaciones, errores de formato y archivos
        faltantes en un formato que facilita su procesamiento automático.
        """
        end_time = datetime.now()
        duration = end_time - self.start_time

        # Formatear la duración como HH:MM:SS
        hours, remainder = divmod(duration.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        duration_str = f"{hours:02}:{minutes:02}:{seconds:02}"

        # Calculamos la tasa de éxito
        success_rate = ((total_records - errors) / total_records * 100) if total_records > 0 else 0

        # Determinamos el estado global
        if errors > 0:
            status = 'Fallido'
        elif warnings > 0:
            status = 'Parcial'
        else:
            status = 'Éxito'

        # Creamos la estructura principal del informe
        report = {
            "execution_info": {
                "start_time": self.start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration": duration_str,
                "log_directory": self.log_dir,
                "casilla_id": self.casilla_id,
                "emisor_id": self.emisor_id,
                "metodo_envio": self.metodo_envio
            },
            "summary": {
                "total_records": total_records,
                "errors": errors,
                "warnings": warnings,
                "success_rate": round(success_rate, 2),
                "status": status
            },
            "files": {
                "statistics": self.file_stats,
                "missing_files": self.missing_files,
                "format_errors": self.format_errors
            },
            "validation": {
                "failures": self.validation_failures,
                "skipped_rules": {
                    "field_rules": self.field_rules_skipped,
                    "row_rules": self.row_rules_skipped,
                    "catalog_rules": self.catalog_rules_skipped
                }
            },
            "events": self.events
        }

        # Procesamos eventos para garantizar serialización
        processed_events = []
        for event in self.events:
            # Crear una copia del evento para no modificar el original
            processed_event = {}
            for key, value in event.items():
                if key == 'exception' and hasattr(value, 'to_dict'):
                    # Si es una excepción con método to_dict, usarlo
                    processed_event[key] = value.to_dict()
                elif isinstance(value, (str, int, float, bool)) or value is None:
                    # Tipos básicos van directamente
                    processed_event[key] = value
                else:
                    # Cualquier otro objeto, convertir a string
                    processed_event[key] = str(value)
            processed_events.append(processed_event)

        # Reemplazar eventos originales con versión procesada
        report["events"] = processed_events

        # Escribimos el informe en formato JSON
        try:
            with open(self.report_json, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
        except TypeError as e:
            # Si hay error de serialización, crear un informe mínimo
            self.error(f"Error al serializar el reporte JSON: {str(e)}")

            # Versión simplificada que seguro funciona
            simplified_report = {
                "execution_uuid": self.execution_uuid,
                "errors": errors,
                "warnings": warnings
            }

            with open(self.report_json, "w", encoding="utf-8") as f:
                json.dump(simplified_report, f, ensure_ascii=False, indent=2)

    def generate_results_txt(self, total_records: int, errors: int, warnings: int):
        """Genera un archivo results.txt con un resumen estructurado de la ejecución"""
        end_time = datetime.now()
        duration = end_time - self.start_time

        # Formatear la duración como HH:MM:SS
        hours, remainder = divmod(duration.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        duration_str = f"{hours:02}:{minutes:02}:{seconds:02}"

        success_rate = ((total_records - errors) / total_records * 100) if total_records > 0 else 0

        with open(self.results_file, "w", encoding="utf-8") as f:
            f.write("======================================================================\n")
            f.write("                        RESUMEN DE EJECUCIÓN SAGE                     \n")
            f.write("======================================================================\n\n")

            # Información general
            f.write("INFORMACIÓN GENERAL\n")
            f.write("------------------\n")
            f.write(f"Fecha y hora de inicio: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Fecha y hora de fin: {end_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Duración: {duration_str}\n")
            f.write(f"Directorio de logs: {self.log_dir}\n\n")

            # Resumen global
            f.write("RESUMEN GLOBAL\n")
            f.write("-------------\n")
            f.write(f"Registros totales procesados: {total_records}\n")
            f.write(f"Total de errores: {errors}\n")
            f.write(f"Total de advertencias: {warnings}\n")
            f.write(f"Tasa de éxito: {success_rate:.1f}%\n\n")

            # Estadísticas por archivo
            if self.file_stats:
                f.write("ESTADÍSTICAS POR ARCHIVO\n")
                f.write("----------------------\n")
                for filename, stats in self.file_stats.items():
                    file_success_rate = ((stats['records'] - stats['errors']) / stats['records'] * 100) if stats['records'] > 0 else 0
                    f.write(f"Archivo: {filename}\n")
                    f.write(f"  Registros: {stats['records']}\n")
                    f.write(f"  Errores: {stats['errors']}\n")
                    f.write(f"  Advertencias: {stats['warnings']}\n")
                    f.write(f"  Tasa de éxito: {file_success_rate:.1f}%\n\n")

            # Errores de formato
            if self.format_errors:
                f.write("ERRORES DE FORMATO\n")
                f.write("-----------------\n")
                for i, error in enumerate(self.format_errors, 1):
                    f.write(f"{i}. {error['message']}\n")
                    if 'file' in error and error['file']:
                        f.write(f"   Archivo: {error['file']}\n")
                    if 'expected' in error:
                        f.write(f"   Esperado: {error['expected']}\n")
                    if 'found' in error:
                        f.write(f"   Encontrado: {error['found']}\n")
                    f.write("\n")

            # Archivos faltantes
            if self.missing_files:
                f.write("ARCHIVOS FALTANTES\n")
                f.write("-----------------\n")
                for i, missing in enumerate(self.missing_files, 1):
                    f.write(f"{i}. Archivo: {missing['filename']}\n")
                    if 'package' in missing and missing['package']:
                        f.write(f"   Paquete: {missing['package']}\n")
                    f.write("\n")

            # Optimización de rendimiento
            if hasattr(self, 'field_rules_skipped') or hasattr(self, 'row_rules_skipped') or hasattr(self, 'catalog_rules_skipped'):
                f.write("OPTIMIZACIÓN DE RENDIMIENTO\n")
                f.write("-------------------------\n")
                f.write("Algunas reglas fueron omitidas parcialmente para archivos grandes para mejorar el rendimiento.\n\n")

                if hasattr(self, 'field_rules_skipped') and self.field_rules_skipped:
                    f.write("Reglas de campo omitidas parcialmente:\n")
                    for field_name, rules in self.field_rules_skipped.items():
                        for rule_name, count in rules.items():
                            f.write(f"  - Campo: {field_name}, Regla: {rule_name}, Errores: {count}\n")
                    f.write("\n")

                if hasattr(self, 'row_rules_skipped') and self.row_rules_skipped:
                    f.write("Reglas de fila omitidas parcialmente:\n")
                    for catalog_name, rules in self.row_rules_skipped.items():
                        for rule_name, count in rules.items():
                            f.write(f"  - Catálogo: {catalog_name}, Regla: {rule_name}, Errores: {count}\n")
                    f.write("\n")

                if hasattr(self, 'catalog_rules_skipped') and self.catalog_rules_skipped:
                    f.write("Reglas de catálogo omitidas parcialmente:\n")
                    for catalog_name, rules in self.catalog_rules_skipped.items():
                        for rule_name, count in rules.items():
                            f.write(f"  - Catálogo: {catalog_name}, Regla: {rule_name}, Errores: {count}\n")
                    f.write("\n")

                f.write("NOTA: El conteo total de errores es preciso, pero no todos fueron detallados en el log.\n")
                f.write("Para ver todos los errores, ejecute la validación con archivos más pequeños.\n\n")

            f.write("======================================================================\n")

    def _prepare_json_serializable(self, obj):
        """
        Recursivamente prepara un objeto para serialización JSON, manejando tipos de excepción personalizados.

        Args:
            obj: El objeto a hacer serializable para JSON

        Returns:
            Una versión JSON serializable del objeto
        """
        # Si es None, retornamos None
        if obj is None:
            return None

        # Si es un tipo básico (str, int, float, bool), retornamos directamente
        if isinstance(obj, (str, int, float, bool)):
            return obj

        # Si es una lista o tupla, aplicamos recursividad a cada elemento
        if isinstance(obj, (list, tuple)):
            return [self._prepare_json_serializable(item) for item in obj]

        # Si es un diccionario, aplicamos recursividad a cada valor
        if isinstance(obj, dict):
            return {k: self._prepare_json_serializable(v) for k, v in obj.items()}

        # Si es una excepción personalizada que tiene método to_dict, usamos ese
        if hasattr(obj, 'to_dict') and callable(obj.to_dict):
            return obj.to_dict()

        # Si es un objeto de fecha/hora, lo convertimos a string ISO
        if hasattr(obj, 'isoformat') and callable(obj.isoformat):
            return obj.isoformat()

        # Para cualquier otro objeto, lo convertimos a string
        try:
            return str(obj)
        except:
            return f"<Objeto no serializable: {type(obj).__name__}>"
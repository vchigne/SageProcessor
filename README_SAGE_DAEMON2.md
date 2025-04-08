# SAGE Daemon 2 - Monitor de Email y Procesamiento de Archivos

## Descripción

SAGE Daemon 2 es un sistema de monitoreo y procesamiento de correos electrónicos que:

1. Verifica periódicamente cuentas de correo configuradas en la base de datos
2. Procesa los correos entrantes según reglas establecidas
3. Envía respuestas automáticas basadas en el remitente y contenido

## Características Principales

- **Monitoreo de múltiples cuentas**: Verifica todas las casillas configuradas en la base de datos
- **Autorización de remitentes**: Valida si el remitente está autorizado para enviar archivos a cada casilla
- **Procesamiento de adjuntos**: Extrae y procesa archivos adjuntos según configuración YAML
- **Respuestas automáticas**: Envía respuestas personalizadas según el caso:
  - Remitente no autorizado
  - Falta de adjuntos
  - Resultados de procesamiento

## Estructura de la Base de Datos Utilizada

El sistema utiliza las siguientes tablas:

1. **email_configuration**: Configuración de conexión a servidores de correo
2. **casilla**: Información de casillas y configuración YAML de procesamiento
3. **emisores_por_casilla**: Remitentes autorizados para cada casilla

## Ejecución

Hay dos modos de ejecución:

1. **Modo continuo**: Monitorea constantemente en intervalos de 1 minuto
   ```bash
   python3 run_sage_daemon2.py
   ```

2. **Modo único**: Ejecuta una sola verificación y termina
   ```bash
   python3 run_sage_daemon2_once.py
   ```

## Logs

El sistema genera logs detallados en:
- **sage_daemon2_log.txt**: Registro completo de operaciones

## Flujo de Trabajo

1. **Verificación de email**:
   - Conecta a servidores IMAP
   - Busca mensajes no leídos
   - Determina la dirección de respuesta adecuada

2. **Verificación de autorización**:
   - Consulta la lista de remitentes autorizados en la base de datos
   - Verifica si el remitente está en la lista

3. **Procesamiento de adjuntos**:
   - Si hay adjuntos, los guarda en archivos temporales
   - Procesa cada adjunto según la configuración YAML de la casilla

4. **Envío de respuestas**:
   - Genera respuestas personalizadas según el caso
   - Utiliza encabezados de prioridad alta para mejor entrega
   - Incluye referencias al mensaje original para mantener el hilo

## Seguridad y Robustez

- **Prevención de bucles**: Evita responder a la misma casilla
- **Manejo de errores**: Captura y registra excepciones sin detener el daemon
- **Reconexión automática**: Intenta reconectarse a la base de datos en caso de error
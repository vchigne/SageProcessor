# Tests para SAGE Daemon CLI

Este directorio contiene tests específicos para el SAGE Daemon CLI (`sage_daemon`), que se encarga del monitoreo y procesamiento automático de archivos.

## Estructura de Directorios

```
sage_daemon_cli/
├── data/              # Datos de entrada para los tests
│   ├── email/         # Archivos para monitor de email
│   ├── sftp/          # Archivos para monitor SFTP
│   └── filesystem/    # Archivos para monitor de sistema de archivos
│
├── output/            # Resultados esperados y generados
│   ├── expected/      # Resultados esperados del procesamiento
│   └── logs/          # Logs generados durante las pruebas
│
└── yaml/              # Configuraciones YAML para tests
    ├── config/        # Configuraciones del daemon
    └── monitors/      # Configuraciones específicas de monitores
```

## Casos de Prueba

Los tests en este directorio cubren los siguientes escenarios:

1. **Monitores**: Funcionamiento de los monitores (email, SFTP, filesystem)
2. **Procesamiento automático**: Detección y procesamiento de archivos
3. **Gestión de errores**: Manejo de fallos en conexiones y procesamiento
4. **Configuración**: Validación de opciones de configuración
5. **Concurrencia**: Manejo de múltiples archivos simultáneos

## Cómo Ejecutar

Para ejecutar todos los tests del daemon:

```bash
python -m pytest tests_oficiales/sage_daemon_cli
```

Para ejecutar un test específico:

```bash
python -m pytest tests_oficiales/sage_daemon_cli/test_email_monitor.py::test_check_new_emails
```

## Configuración para Tests

Los tests pueden requerir variables de entorno específicas para conexiones:

```bash
# Para tests de email
export TEST_EMAIL_USER=usuario@example.com
export TEST_EMAIL_PASSWORD=contraseña

# Para tests de SFTP
export TEST_SFTP_HOST=sftp.example.com
export TEST_SFTP_USER=usuario
export TEST_SFTP_PASSWORD=contraseña
```

## Mocks y Simulaciones

Para evitar dependencias externas, muchos tests utilizan mocks para simular:
- Servidores SFTP
- Servidores de email
- Filesystem
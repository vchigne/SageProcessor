# DuckDB Systemd Deployment Scripts

Este directorio contiene todos los scripts y archivos necesarios para el despliegue de servidores DuckDB remotos utilizando systemd.

## Estructura de directorios

- `install_scripts/`: Scripts de instalación y validación
  - `install_duckdb_systemd.sh`: Script principal de instalación
  - `validate_duckdb_systemd.sh`: Script de validación post-instalación
  - `install_demos_duckdb_server.py`: Script para instalar demos en el servidor

- `server_files/`: Archivos que se copian al servidor remoto
  - `duckdb_server.py`: API REST de DuckDB
  - Otros archivos necesarios para el servidor

- `demo_files/`: Archivos de demostración y ejemplos
  - `demos.zip`: Paquete con demos y ejemplos

## Gestión

Estos archivos se gestionan desde la interfaz de administración en:
`/admin/duckdb-swarm/scripts`
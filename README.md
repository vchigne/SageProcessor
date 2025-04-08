# SAGE System - Updated

Sistema avanzado para la gestión de configuraciones organizacionales, procesamiento de archivos y validación de reglas basadas en YAML con asistencia de IA.

## Características Principales

- Gestión de configuraciones mediante YAML con asistencia de IA
- Procesamiento multi-canal de archivos (Email, SFTP, API, Sistema de archivos)
- Dashboard para monitoreo y métricas
- Sistema de respuestas automatizadas
- Gestión de suscripciones y permisos
- Validación y procesamiento inteligente de archivos
- Soporte para BOM (Byte Order Mark) en archivos CSV
- YAML Studio con posibilidad de descargar prompts para usar en otras plataformas

## Estructura del Sistema

```
├── API REST - Endpoints para gestión y configuración
├── YAML Studio - Editor inteligente de configuraciones
├── Procesador Multi-canal - Manejo de diferentes fuentes de datos
├── Motor de Validación - Verificación de reglas y estructura
└── Sistema de Notificaciones - Respuestas y alertas automáticas
```

## Documentación

- [Arquitectura y Funcionamiento](docs/architecture.md) - Explicación detallada del sistema
- [Guía de Uso](docs/how-to.md) - Tutorial paso a paso
- [Preguntas Frecuentes](docs/faq.md) - Respuestas a dudas comunes
- [TODO List](docs/TODO.md) - Lista de funcionalidades pendientes
- [Usar OpenRouter](docs/usar_open_router.md) - Guía para configurar OpenRouter con o3-mini
- [Usar Prompts Externos](docs/usar_prompt_externo.md) - Cómo usar los prompts de YAML Studio en otras plataformas
- [Soporte BOM en YAML Studio](README_YAML_STUDIO_BOM.md) - Documentación sobre el soporte para BOM en CSV

## Nuevas Funcionalidades

- **Descargar Prompt**: Ahora puedes descargar el prompt generado por YAML Studio para usarlo en otras interfaces de chat cuando OpenRouter no esté disponible.
- **Soporte BOM Mejorado**: Detección y procesamiento automático de BOM (Byte Order Mark) en archivos CSV.
- **Validación de Columnas**: Mejorada la detección de columnas y tipos de datos para archivos sin encabezados.

## Requisitos

- Node.js 20.x
- PostgreSQL 15+
- Python 3.11+

## Configuración Inicial

1. Clonar el repositorio
2. Instalar dependencias: `npm install`
3. Configurar variables de entorno
4. Iniciar el servidor: `npm run dev`

## Licencia

Este proyecto está bajo la licencia MIT.
# Uso de OpenRouter para acceder al modelo o3-mini

## Introducción

Esta documentación describe cómo utilizar [OpenRouter](https://openrouter.ai/) como una alternativa para acceder al modelo o3-mini cuando la API directa no está funcionando correctamente.

## Configuración

Para utilizar OpenRouter, necesitas:

1. Una cuenta en OpenRouter.ai
2. Una clave API de OpenRouter
3. Configurar la variable de entorno OPENROUTER_API_KEY

## Obtener una clave API de OpenRouter

1. Ve a [OpenRouter.ai](https://openrouter.ai/)
2. Crea una cuenta o inicia sesión
3. Ve a la sección "API Keys"
4. Genera una nueva clave API

## Configuración de variables de entorno

Para que SAGE utilice OpenRouter, debes configurar la siguiente variable de entorno:

```bash
export OPENROUTER_API_KEY=tu_clave_api_aquí
```

## Prioridad de claves API

SAGE utilizará las claves API en el siguiente orden de prioridad:

1. `OPENROUTER_API_KEY` - OpenRouter.ai (recomendado)
2. `O3_MINI_API_KEY` - API directa de o3-mini
3. `OPENAI_API_KEY` - OpenAI (respaldo, solo usa gpt-3.5-turbo)

## Verificar la conexión

Puedes verificar que la conexión con OpenRouter funciona correctamente ejecutando:

```bash
python test_openrouter.py
```

Este script realizará una prueba simple para verificar la conexión y mostrará el resultado.

## Solución de problemas

Si encuentras problemas con la conexión a OpenRouter, verifica:

1. Que la clave API sea válida y esté correctamente configurada
2. Que tengas una conexión estable a Internet
3. Que el modelo solicitado (o3-mini) esté disponible en OpenRouter

## Diferencias en la respuesta API

OpenRouter proporciona respuestas compatibles con la API de OpenAI, pero pueden existir pequeñas diferencias en los metadatos adicionales incluidos en la respuesta. El código de SAGE está preparado para manejar estas diferencias.

## Ventajas de usar OpenRouter

- Mayor estabilidad en la resolución DNS
- Acceso a múltiples modelos a través de una única API
- Compatible con clientes existentes para OpenAI
- Alta disponibilidad y escalabilidad

## Recursos adicionales

- [Documentación oficial de OpenRouter](https://openrouter.ai/docs)
- [GitHub de OpenRouter](https://github.com/openrouter-ai)
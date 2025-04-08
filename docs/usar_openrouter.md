# Uso de OpenRouter para YAML Studio en SAGE

Este documento explica cómo configurar y utilizar OpenRouter como proveedor alternativo para acceder al modelo o3-mini en YAML Studio.

## ¿Qué es OpenRouter?

OpenRouter es un servicio que actúa como intermediario para acceder a diversos modelos de IA, incluyendo o3-mini, Claude, GPT-4, y otros. Proporciona una API unificada y facilita el acceso a estos modelos cuando hay problemas de conexión directa o restricciones regionales.

## Ventajas de usar OpenRouter

1. **Mayor estabilidad**: Ofrece rutas alternativas para acceder a los modelos cuando la API directa presenta problemas
2. **Menor latencia**: Puede reducir los tiempos de respuesta dependiendo de la ubicación geográfica
3. **Compatibilidad**: Utiliza un formato de API similar a OpenAI, facilitando la integración
4. **Variedad de modelos**: Permite acceder a una amplia gama de modelos con la misma integración

## Configuración

Para utilizar OpenRouter con YAML Studio en SAGE, sigue estos pasos:

1. Regístrate en [OpenRouter](https://openrouter.ai/keys)
2. Genera una clave API desde el panel de control
3. Configura la variable de entorno:

```bash
# En Linux/macOS
export OPENROUTER_API_KEY=tu_clave_api

# En Windows (PowerShell)
$env:OPENROUTER_API_KEY="tu_clave_api"

# En Windows (CMD)
set OPENROUTER_API_KEY=tu_clave_api
```

## Verificación de la configuración

SAGE detectará automáticamente si la variable `OPENROUTER_API_KEY` está presente y la utilizará como proveedor preferido. Para verificar que está correctamente configurado:

```bash
python test_yaml_o3_mini_improved.py
```

Deberías ver una salida similar a esta:

```
2025-03-30 21:33:42 ℹ️ MESSAGE
=== Prueba del Generador YAML Mejorado ===

2025-03-30 21:33:42 ℹ️ MESSAGE
Inicializando generador YAML con OpenRouter...

2025-03-30 21:33:42 ℹ️ MESSAGE
✅ Usando OpenRouter para acceder al modelo o3-mini
```

## Resolución de problemas

Si encuentras problemas al conectar con OpenRouter:

1. **Verifica la clave API**: Asegúrate de que has configurado correctamente la variable de entorno
2. **Comprueba la conexión**: Verifica que puedes acceder a `openrouter.ai` desde tu red
3. **Revisa los logs**: Los mensajes de error en la consola proporcionan información útil
4. **Tiempo de respuesta**: Si las respuestas tardan demasiado, puedes ajustar el parámetro `timeout` en la llamada a `call_o3_mini_api`

## Alternativas

Si no puedes utilizar OpenRouter, SAGE intentará conectarse directamente a la API de o3-mini utilizando:

1. La variable de entorno `O3_MINI_API_KEY` si está disponible
2. La variable de entorno `OPENAI_API_KEY` como alternativa

## Soporte

Para resolver cualquier problema con la integración de OpenRouter en SAGE, contacta al equipo de desarrollo a través del sistema de tickets interno.
# Usando el Prompt de YAML Studio en Interfaces Externas

## Introducción

YAML Studio ahora ofrece la posibilidad de descargar el prompt generado para utilizarlo en otras interfaces de chat cuando OpenRouter no esté disponible o se necesite utilizar un modelo diferente.

## ¿Cómo funciona?

1. Al hacer clic en el botón "Descargar Prompt" en la interfaz de YAML Studio, se generará y descargará automáticamente un archivo de texto que contiene el prompt completo.

2. Este prompt contiene toda la información necesaria para que cualquier modelo de IA genere un archivo YAML válido para SAGE, incluyendo:
   - Información sobre el archivo procesado
   - Ejemplos de los datos
   - Las instrucciones específicas proporcionadas
   - Las especificaciones del formato YAML requerido

## Donde puedes usar el prompt

Puedes pegar el prompt descargado en varias interfaces de chat, como:

- [ChatGPT](https://chat.openai.com/)
- [Gemini](https://gemini.google.com/)
- [Claude](https://claude.ai/)
- [Perplexity](https://www.perplexity.ai/)
- [Copilot](https://copilot.microsoft.com/)
- Cualquier otra interfaz de chat basada en IA capaz de generar código YAML

## Instrucciones de uso

1. Sube tu archivo (CSV, Excel o ZIP) en YAML Studio
2. Proporciona las instrucciones específicas si es necesario
3. Haz clic en el botón "Descargar Prompt"
4. Abre tu interfaz de chat preferida
5. Pega el contenido completo del archivo descargado
6. Envía el mensaje y espera la respuesta
7. Copia el YAML generado por el modelo
8. Valídalo en YAML Studio si es necesario

## Consejos

- Para mejores resultados, usa modelos avanzados como GPT-4, Claude 3 Opus, o modelos similares con capacidades de generación de código.
- Si el modelo no genera un YAML completo, puedes pedirle que complete las partes faltantes o que corrija errores específicos.
- Puedes modificar manualmente el prompt antes de enviarlo si deseas ajustar alguna instrucción o añadir contexto adicional.

## Limitaciones

- La calidad del YAML generado dependerá del modelo utilizado.
- Es posible que modelos menos avanzados no sigan exactamente todas las especificaciones requeridas.
- Siempre verifica y valida el YAML generado antes de usarlo en producción.

---

Con esta funcionalidad, YAML Studio se hace más versátil, permitiéndote usar el poder de diferentes modelos de IA para generar configuraciones YAML optimizadas para SAGE, incluso cuando el servicio principal no esté disponible.
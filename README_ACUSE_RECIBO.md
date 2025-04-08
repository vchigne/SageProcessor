# SAGE Daemon 2: Acuse de Recibo Universal

## Descripción

Se ha implementado una nueva funcionalidad en el SAGE Daemon 2 que envía un acuse de recibo a **TODOS** los mensajes entrantes, independientemente de si el remitente está autorizado o no.

## Motivación

La implementación anterior diferenciaba el tratamiento según la autorización del remitente:
- Para remitentes **autorizados**: Se procesaban adjuntos o se enviaba un mensaje solicitando adjuntos.
- Para remitentes **no autorizados**: Se enviaba un mensaje informando que no estaban autorizados.

Esta nueva funcionalidad garantiza que **todos los remitentes** reciban una confirmación de que su mensaje ha sido recibido, lo que mejora la experiencia de usuario y proporciona tranquilidad al emisor.

## Cambios Implementados

1. Se ha modificado el flujo de procesamiento de correos en `sage_daemon2/daemon.py`:
   - Al recibir un mensaje, se envía inmediatamente un acuse de recibo.
   - Se mantiene el registro del estado de autorización del remitente solo con fines informativos.

2. Se ha implementado la función `send_generic_acknowledgment` que:
   - Crea una respuesta con el asunto "Re: [Asunto Original]".
   - Incluye encabezados de prioridad alta para mejor entrega.
   - Añade encabezados `In-Reply-To` y `References` para que la respuesta aparezca como un hilo de conversación.
   - Incluye un mensaje genérico que informa que el correo ha sido recibido y está siendo procesado.

## Beneficios

1. **Mejor Experiencia de Usuario**: Todos los usuarios reciben confirmación de que su mensaje fue recibido.
2. **Reducción de Consultas**: Menos preguntas sobre si el correo fue recibido o no.
3. **Mayor Confiabilidad Percibida**: Los usuarios confían más en el sistema cuando reciben respuestas automáticas.
4. **Trazabilidad**: Todas las interacciones quedan documentadas con una respuesta.

## Formato del Acuse de Recibo

El acuse de recibo tiene el siguiente formato:

```
Asunto: Re: [Asunto Original]

Estimado/a Usuario,

Hemos recibido su mensaje en [casilla@sage.vidahub.ai].

Estamos procesando su solicitud y le informaremos pronto cuando hayamos completado el análisis.

Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.

Saludos cordiales,
Sistema SAGE
```

## Encabezados SMTP Especiales

Cada acuse de recibo incluye:

1. **Encabezados de prioridad**:
   - `X-Priority: 1`
   - `X-MSMail-Priority: High`
   - `Importance: High`

2. **Encabezados de referencia** (si el mensaje original incluye `Message-ID`):
   - `In-Reply-To: <message-id-original>`
   - `References: <message-id-original>`

Estos encabezados garantizan que la respuesta aparezca como un hilo de conversación en la mayoría de los clientes de correo y reciba atención prioritaria.

## Ejemplos de Logs

```
2025-04-02 19:26:52,220 - SAGE_Daemon2.EmailProcessor - INFO - Dirección de respuesta determinada: victor.chigne@gmail.com (de Return-Path)
2025-04-02 19:26:52,221 - SAGE_Daemon2.EmailProcessor - INFO - Enviando acuse de recibo a: victor.chigne@gmail.com
2025-04-02 19:26:52,221 - SAGE_Daemon2.EmailProcessor - INFO - Añadidos encabezados de respuesta In-Reply-To: <CA+=NkhhL9rNmVqrar_Dq0FUNkGJZe5ZhwBC8nb+1409ZG70zhw@mail.gmail.com>
2025-04-02 19:26:52,743 - SAGE_Daemon2.EmailProcessor - INFO - Acuse de recibo enviado correctamente a victor.chigne@gmail.com
2025-04-02 19:26:52,743 - SAGE_Daemon2.EmailProcessor - INFO - Remitente autorizado (solo registro): victor.chigne@gmail.com

2025-04-02 19:26:59,898 - SAGE_Daemon2.EmailProcessor - INFO - Dirección de respuesta determinada: vchigne@yahoo.com (de Return-Path)
2025-04-02 19:26:59,899 - SAGE_Daemon2.EmailProcessor - INFO - Enviando acuse de recibo a: vchigne@yahoo.com
2025-04-02 19:26:59,899 - SAGE_Daemon2.EmailProcessor - INFO - Añadidos encabezados de respuesta In-Reply-To: <1892304729.825206.1743621532537@mail.yahoo.com>
2025-04-02 19:27:00,361 - SAGE_Daemon2.EmailProcessor - INFO - Acuse de recibo enviado correctamente a vchigne@yahoo.com
2025-04-02 19:27:00,362 - SAGE_Daemon2.EmailProcessor - INFO - Remitente no autorizado (solo registro): vchigne@yahoo.com
```

## Consideraciones Futuras

En futuras actualizaciones se podría considerar:

1. Personalizar el mensaje de acuse de recibo según el tipo de remitente o asunto.
2. Implementar un sistema anti-spam que limite los acuses de recibo a un mismo remitente en un periodo corto de tiempo.
3. Incluir información adicional en la respuesta, como instrucciones generales sobre el uso del sistema.
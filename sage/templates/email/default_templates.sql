-- Plantillas predeterminadas para el sistema de email SAGE
-- Estas plantillas se cargan una sola vez durante la inicialización del sistema

-- Verificar si ya existen plantillas predeterminadas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM plantillas_email WHERE es_predeterminada = TRUE) THEN
        -- Plantilla predeterminada para notificación detallada
        INSERT INTO plantillas_email (
            nombre, descripcion, tipo, subtipo, variante, 
            canal, idioma, asunto, contenido_html, contenido_texto,
            es_predeterminada, estado
        ) VALUES (
            'Notificación Detallada', 
            'Plantilla predeterminada para notificaciones con detalle completo de eventos',
            'notificacion', 
            'detallado', 
            'standard',
            'email', 
            'es', 
            'SAGE - Notificación: {{ evento_resumen }}',
            E'<html>\n<head>\n    <style>\n        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }\n        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }\n        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }\n        table { border-collapse: collapse; width: 100%; }\n        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }\n        th { background-color: #f2f2f2; }\n        .error { color: #e53e3e; }\n        .warning { color: #dd6b20; }\n        .info { color: #3182ce; }\n        .success { color: #38a169; }\n    </style>\n</head>\n<body>\n    <div class="header">\n        <h2>Notificación SAGE</h2>\n        <p>Fecha: {{ fecha }}</p>\n    </div>\n    \n    <div class="content">\n        <h3>Detalle de eventos</h3>\n        <table>\n            <tr>\n                <th>Tipo</th>\n                <th>Emisor</th>\n                <th>Mensaje</th>\n                <th>Fecha</th>\n            </tr>\n            {{ detalle_eventos }}\n        </table>\n    </div>\n    \n    <div class="footer">\n        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>\n    </div>\n</body>\n</html>',
            E'Notificación SAGE\n\nFecha: {{ fecha }}\n\nDetalle de eventos:\n\n{{ detalle_eventos_texto }}\n\nEste es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.',
            TRUE, 
            'activo'
        );
        
        -- Plantilla predeterminada para notificación resumida por emisor
        INSERT INTO plantillas_email (
            nombre, descripcion, tipo, subtipo, variante, 
            canal, idioma, asunto, contenido_html, contenido_texto,
            es_predeterminada, estado
        ) VALUES (
            'Notificación Resumida por Emisor', 
            'Plantilla predeterminada para notificaciones resumidas por emisor',
            'notificacion', 
            'resumido_emisor', 
            'standard',
            'email', 
            'es', 
            'SAGE - Resumen por emisor: {{ evento_resumen }}',
            E'<html>\n<head>\n    <style>\n        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }\n        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }\n        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }\n        table { border-collapse: collapse; width: 100%; }\n        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }\n        th { background-color: #f2f2f2; }\n        .error { color: #e53e3e; }\n        .warning { color: #dd6b20; }\n        .info { color: #3182ce; }\n        .success { color: #38a169; }\n    </style>\n</head>\n<body>\n    <div class="header">\n        <h2>Resumen por Emisor</h2>\n        <p>Fecha: {{ fecha }}</p>\n    </div>\n    \n    <div class="content">\n        <h3>Resumen por emisor</h3>\n        <table>\n            <tr>\n                <th>Emisor</th>\n                <th>Errores</th>\n                <th>Advertencias</th>\n                <th>Información</th>\n                <th>Exitosos</th>\n            </tr>\n            {{ resumen_emisor }}\n        </table>\n    </div>\n    \n    <div class="footer">\n        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>\n    </div>\n</body>\n</html>',
            E'Resumen por Emisor SAGE\n\nFecha: {{ fecha }}\n\nResumen por emisor:\n\n{{ resumen_emisor_texto }}\n\nEste es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.',
            TRUE, 
            'activo'
        );
        
        -- Plantilla predeterminada para notificación resumida por casilla
        INSERT INTO plantillas_email (
            nombre, descripcion, tipo, subtipo, variante, 
            canal, idioma, asunto, contenido_html, contenido_texto,
            es_predeterminada, estado
        ) VALUES (
            'Notificación Resumida por Casilla', 
            'Plantilla predeterminada para notificaciones resumidas por casilla',
            'notificacion', 
            'resumido_casilla', 
            'standard',
            'email', 
            'es', 
            'SAGE - Resumen de casilla: {{ casilla_nombre }}',
            E'<html>\n<head>\n    <style>\n        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }\n        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }\n        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }\n        table { border-collapse: collapse; width: 100%; }\n        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }\n        th { background-color: #f2f2f2; }\n        .error { color: #e53e3e; }\n        .warning { color: #dd6b20; }\n        .info { color: #3182ce; }\n        .success { color: #38a169; }\n    </style>\n</head>\n<body>\n    <div class="header">\n        <h2>Resumen de Casilla: {{ casilla_nombre }}</h2>\n        <p>Fecha: {{ fecha }}</p>\n    </div>\n    \n    <div class="content">\n        <h3>Resumen de eventos</h3>\n        <table>\n            <tr>\n                <th>Tipo</th>\n                <th>Cantidad</th>\n            </tr>\n            {{ resumen_casilla }}\n        </table>\n    </div>\n    \n    <div class="footer">\n        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>\n    </div>\n</body>\n</html>',
            E'Resumen de Casilla SAGE: {{ casilla_nombre }}\n\nFecha: {{ fecha }}\n\nResumen de eventos:\n\n{{ resumen_casilla_texto }}\n\nEste es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.',
            TRUE, 
            'activo'
        );
        
        -- Plantilla predeterminada para respuestas de remitente no autorizado
        INSERT INTO plantillas_email (
            nombre, descripcion, tipo, subtipo, variante, 
            canal, idioma, asunto, contenido_html, contenido_texto,
            es_predeterminada, estado
        ) VALUES (
            'Respuesta de Remitente No Autorizado', 
            'Plantilla predeterminada para respuestas a remitentes no autorizados',
            'respuesta_daemon', 
            'remitente_no_autorizado', 
            'standard',
            'email', 
            'es', 
            'Re: {{ asunto_original }}',
            E'<html>\n<head>\n    <style>\n        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }\n        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }\n        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }\n        .highlight { background-color: #f9f9f9; padding: 10px; border-left: 4px solid #3182ce; margin: 10px 0; }\n    </style>\n</head>\n<body>\n    <div class="header">\n        <h2>Respuesta Automática</h2>\n    </div>\n    \n    <div class="content">\n        <p>Estimado/a Usuario,</p>\n        \n        <p>¡Gracias por comunicarse con nosotros a través de {{ email_casilla }}!</p>\n        \n        <p>Queremos informarle que actualmente su dirección de correo electrónico ({{ email_remitente }}) no se encuentra en nuestra lista de remitentes autorizados para esta casilla. ¡Pero no se preocupe! Valoramos enormemente su interés en utilizar nuestros servicios de procesamiento de datos.</p>\n        \n        <div class="highlight">\n            <p>Para brindarle una experiencia completa y personalizada con el Sistema SAGE, le invitamos a contactar a su administrador de sistema para solicitar su autorización. Una vez autorizado, podrá disfrutar de todas las ventajas y beneficios de nuestra plataforma de procesamiento automatizado:</p>\n            \n            <p>✓ Validación automática de archivos<br>\n            ✓ Notificaciones en tiempo real<br>\n            ✓ Reportes detallados de procesamiento<br>\n            ✓ Integración con sus sistemas existentes</p>\n        </div>\n        \n        <p>Si tiene alguna consulta o necesita asistencia adicional, nuestro equipo está siempre disponible para ayudarle. ¡Nos encantaría poder atenderle pronto como usuario autorizado!</p>\n        \n        <p>Gracias por su comprensión y por elegirnos.</p>\n        \n        <p>Atentamente,<br>\n        El Equipo SAGE</p>\n    </div>\n    \n    <div class="footer">\n        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor contacte a su administrador para más información.</p>\n    </div>\n</body>\n</html>',
            E'Estimado/a Usuario,\n\n¡Gracias por comunicarse con nosotros a través de {{ email_casilla }}!\n\nQueremos informarle que actualmente su dirección de correo electrónico ({{ email_remitente }}) no se encuentra en nuestra lista de remitentes autorizados para esta casilla. ¡Pero no se preocupe! Valoramos enormemente su interés en utilizar nuestros servicios de procesamiento de datos.\n\nPara brindarle una experiencia completa y personalizada con el Sistema SAGE, le invitamos a contactar a su administrador de sistema para solicitar su autorización. Una vez autorizado, podrá disfrutar de todas las ventajas y beneficios de nuestra plataforma de procesamiento automatizado:\n\n✓ Validación automática de archivos\n✓ Notificaciones en tiempo real\n✓ Reportes detallados de procesamiento\n✓ Integración con sus sistemas existentes\n\nSi tiene alguna consulta o necesita asistencia adicional, nuestro equipo está siempre disponible para ayudarle. ¡Nos encantaría poder atenderle pronto como usuario autorizado!\n\nGracias por su comprensión y por elegirnos.\n\nAtentamente,\nEl Equipo SAGE\n\nEste es un mensaje automático generado por el sistema SAGE. Por favor contacte a su administrador para más información.',
            TRUE, 
            'activo'
        );
        
        -- Plantilla predeterminada para respuestas de falta de adjunto
        INSERT INTO plantillas_email (
            nombre, descripcion, tipo, subtipo, variante, 
            canal, idioma, asunto, contenido_html, contenido_texto,
            es_predeterminada, estado
        ) VALUES (
            'Respuesta de Falta de Adjunto', 
            'Plantilla predeterminada para respuestas cuando falta un adjunto',
            'respuesta_daemon', 
            'falta_adjunto', 
            'standard',
            'email', 
            'es', 
            'Re: {{ asunto_original }}',
            E'<html>\n<head>\n    <style>\n        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }\n        .header { background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }\n        .footer { background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }\n        .highlight { background-color: #f9f9f9; padding: 10px; border-left: 4px solid #dd6b20; margin: 10px 0; }\n    </style>\n</head>\n<body>\n    <div class="header">\n        <h2>Respuesta Automática</h2>\n    </div>\n    \n    <div class="content">\n        <p>Estimado/a Usuario,</p>\n        \n        <p>Hemos recibido su mensaje en {{ email_casilla }}, pero no se encontró ningún archivo adjunto para procesar.</p>\n        \n        <div class="highlight">\n            <p>Para que el sistema SAGE pueda procesar su solicitud, por favor reenvíe su mensaje incluyendo el archivo que desea procesar como adjunto.</p>\n        </div>\n        \n        <p>Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.</p>\n        \n        <p>Saludos cordiales,<br>\n        Sistema SAGE</p>\n    </div>\n    \n    <div class="footer">\n        <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>\n    </div>\n</body>\n</html>',
            E'Estimado/a Usuario,\n\nHemos recibido su mensaje en {{ email_casilla }}, pero no se encontró ningún archivo adjunto para procesar.\n\nPara que el sistema SAGE pueda procesar su solicitud, por favor reenvíe su mensaje incluyendo el archivo que desea procesar como adjunto.\n\nEste es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.\n\nSaludos cordiales,\nSistema SAGE\n\nEste es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.',
            TRUE, 
            'activo'
        );
    END IF;
END $$;
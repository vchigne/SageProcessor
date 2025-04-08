# Preguntas Frecuentes (FAQ)

## Configuración General

### ¿Qué es una instalación?
Una instalación es la combinación única de una organización, un país y un producto. Representa la implementación específica de un producto para una organización en un país determinado.

### ¿Cuál es la diferencia entre un emisor y un responsable?
- **Emisor**: Es quien envía los archivos al sistema. Está vinculado a una organización y puede usar diferentes métodos de envío.
- **Responsable**: Es quien recibe notificaciones y gestiona los archivos en los casilleros. Puede estar asignado a múltiples casilleros.

### ¿Puedo tener múltiples emisores por organización?
Sí, una organización puede tener tantos emisores como necesite, cada uno con sus propias configuraciones y métodos de envío permitidos.

## Métodos de Envío

### ¿Qué métodos de envío están disponibles?
1. Email (IMAP/POP3)
2. SFTP
3. Sistema de archivos local
4. API REST

### ¿Cómo funciona el envío por email?
El sistema monitorea una dirección de email específica para cada casillero. Cuando se recibe un email con adjuntos, estos son procesados según las reglas configuradas.

### ¿Es seguro el método SFTP?
Sí, el sistema utiliza credenciales únicas por emisor y encriptación para garantizar la seguridad de las transferencias.

## Casilleros y Procesamiento

### ¿Qué es un casillero?
Un casillero es un punto de recepción de archivos que:
- Está asociado a una instalación
- Tiene responsables asignados
- Procesa archivos según reglas específicas

### ¿Cómo se validan los archivos?
Los archivos se validan usando:
1. Reglas básicas (formato, tamaño)
2. Reglas YAML personalizadas
3. Validaciones específicas por tipo de archivo

### ¿Qué pasa si un archivo no cumple las reglas?
- Se notifica al emisor y responsables
- Se genera un reporte de error
- El archivo se mueve a una carpeta de errores
- Se registra en los logs del sistema

## YAML Studio

### ¿Qué es YAML Studio?
Es una herramienta que permite crear y editar reglas de validación y procesamiento usando YAML, con asistencia de IA para sugerencias y validación.

### ¿Cómo funciona la asistencia de IA?
La IA ayuda a:
- Sugerir reglas basadas en el contexto
- Validar la sintaxis YAML
- Proponer mejoras en las reglas

## Notificaciones y Respuestas

### ¿Cómo se configuran las respuestas automáticas?
Las respuestas se configuran en el casillero, especificando:
- Condiciones de envío
- Plantillas de mensaje
- Destinatarios

### ¿Quién recibe las notificaciones?
- Responsables del casillero
- Emisor del archivo
- Otros usuarios configurados en las reglas

## Suscripciones y Permisos

### ¿Cómo funcionan los niveles de acceso?
Existen diferentes niveles:
- Administrador de sistema
- Administrador de organización
- Responsable de casillero
- Usuario básico

### ¿Se pueden limitar los métodos de envío por emisor?
Sí, cada emisor puede tener configurados sus propios métodos de envío permitidos.

## Mantenimiento y Soporte

### ¿Dónde puedo ver los logs del sistema?
Los logs están disponibles en:
- Dashboard de monitoreo
- Sección de logs del sistema
- Reportes de actividad

### ¿Cómo se hace backup de las configuraciones?
- Las configuraciones se respaldan automáticamente
- Se pueden exportar manualmente
- Se mantiene un historial de cambios

### ¿Qué debo hacer si un archivo no se procesa correctamente?
1. Verificar los logs de error
2. Comprobar las reglas de validación
3. Revisar la configuración del casillero
4. Contactar al soporte si persiste el problema

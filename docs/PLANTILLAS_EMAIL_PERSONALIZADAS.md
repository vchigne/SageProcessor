# Sistema de Plantillas de Email Personalizadas

Este documento describe la implementación del sistema de plantillas de email personalizadas por cliente para SAGE Daemon 2 y detalla los pasos pendientes para completar la integración.

## Resumen del Estado Actual

El sistema de plantillas personalizadas por cliente está **parcialmente implementado**. La estructura de base de datos, endpoints de API, interfaz de administración y lógica de selección están completas, pero la integración con SAGE Daemon 2 requiere algunos ajustes finales.

### Componentes Implementados:

1. **Base de Datos**:
   - Tablas `plantillas_email` y `cliente_plantilla` creadas
   - Esquema de datos completo para almacenar plantillas y sus asignaciones a clientes

2. **API REST**:
   - Endpoints para gestionar plantillas (`/api/admin/plantillas-email`)
   - Endpoints para gestionar asignaciones (`/api/admin/asignaciones-plantilla`)
   - Métodos GET, POST, PUT y DELETE implementados

3. **Interfaz de Administración**:
   - Página para gestionar plantillas en `/admin/plantillas-email`
   - Página para asignar plantillas a clientes en `/admin/asignaciones-plantilla`

4. **Lógica de Selección**:
   - Módulo `utils.py` con funciones para seleccionar la plantilla adecuada
   - Sistema de prioridad que busca primero plantillas personalizadas por cliente

5. **Integración Básica**:
   - Clase `NotificadorAdapter` que conecta con el sistema de notificaciones
   - Soporte ya incorporado en la clase `Notificador` para usar el sistema de plantillas

## Pendientes para Completar la Integración

### 1. Asegurar el Correcto Funcionamiento de Importaciones

SAGE Daemon 2 ya intenta importar el adaptador de plantillas, pero lo hace dentro de un bloque try/except:

```python
try:
    from sage.templates.email.notificador_adapter import NotificadorAdapter
    HAS_TEMPLATE_SYSTEM = True
except ImportError:
    HAS_TEMPLATE_SYSTEM = False
```

Es posible que la importación esté fallando silenciosamente. Pasos a realizar:

- Verificar que el paquete `sage.templates.email` sea accesible desde SAGE Daemon 2
- Comprobar rutas de importación y estructura de directorios
- Agregar logs más detallados para diagnosticar errores de importación

### 2. Pasar el ID del Suscriptor para Habilitar Plantillas Personalizadas

El método `_generar_contenido_notificacion` en el Notificador acepta el parámetro `suscriptor_id`, pero es posible que no se esté pasando correctamente:

```python
def _generar_contenido_notificacion(self, eventos, nivel_detalle, portal_id=None, 
                                   casilla_id=None, suscriptor_id=None):
```

Pasos a realizar:

- Modificar `NotificacionesManager` para pasar el ID del suscriptor al llamar a `_generar_contenido_notificacion`
- Actualizar la llamada en `procesar_suscripciones` para incluir el suscriptor_id
- Asegurar que este ID se propague correctamente hasta el `NotificadorAdapter`

### 3. Activar Logs de Diagnóstico

Para diagnosticar posibles problemas de integración, es necesario activar logs más detallados:

```python
# En notificador.py, agregar:
if HAS_TEMPLATE_SYSTEM:
    try:
        self.template_adapter = NotificadorAdapter(db_connection)
        logger.info("Sistema de plantillas de email inicializado correctamente")
    except Exception as e:
        logger.error(f"Error al inicializar sistema de plantillas: {str(e)}")
        # Mostrar stack trace completo para mejor diagnóstico
        import traceback
        logger.error(traceback.format_exc())
        self.template_adapter = None
```

### 4. Asignar Plantillas a Clientes para Pruebas

Para probar correctamente el sistema, es necesario:

1. Crear plantillas personalizadas a través de la interfaz administrativa
2. Asignar estas plantillas a clientes específicos
3. Verificar que las notificaciones usen estas plantillas
4. Crear casos de prueba para cubrir diferentes escenarios:
   - Cliente con plantilla personalizada
   - Cliente sin plantilla personalizada (usa la predeterminada)
   - Caso de error (debe usar método tradicional como fallback)

### 5. Actualizar la Documentación

Una vez completada la integración:

1. Actualizar documentación de usuario con instrucciones para usar plantillas personalizadas
2. Documentar API para desarrolladores que quieran extender el sistema
3. Crear ejemplos de uso para diferentes tipos de plantillas

## Arquitectura del Sistema

```
┌──────────────────┐      ┌─────────────────┐      ┌────────────────────┐
│  SAGE Daemon 2   │──────▶  Notificador    │──────▶  NotificadorAdapter │
└──────────────────┘      └─────────────────┘      └────────────────────┘
                                                             │
                                                             ▼
                                                   ┌──────────────────────┐
                                                   │  TemplateManager     │
                                                   └──────────────────────┘
                                                             │
                                                             ▼
┌──────────────────┐      ┌─────────────────┐      ┌────────────────────┐
│  Base de Datos   │◀─────│  Plantillas     │◀─────│  TemplateRenderer  │
└──────────────────┘      └─────────────────┘      └────────────────────┘
```

## Flujo de Selección de Plantillas

1. El Notificador recibe una solicitud para generar contenido
2. Intenta usar el sistema de plantillas a través del NotificadorAdapter
3. El TemplateManager busca una plantilla personalizada para el suscriptor
4. Si la encuentra, la devuelve
5. Si no, busca una plantilla predeterminada según el tipo, subtipo, etc.
6. Si no encuentra ninguna, o hay algún error, utiliza el método tradicional

## Conclusión

El sistema de plantillas personalizadas por cliente está casi completo, solo requiere algunos ajustes finales en la integración con SAGE Daemon 2 para funcionar completamente. Una vez implementados estos cambios, el sistema permitirá una personalización flexible de las comunicaciones para cada cliente, manteniendo la compatibilidad con el sistema actual.
# Arquitectura del Sistema

## Relaciones entre Componentes

### Organizaciones y Emisores

Una organización puede tener múltiples emisores. Los emisores son entidades que envían archivos al sistema y están vinculados a una organización específica. Cada emisor tiene:
- Un tipo (interno, corporativo, distribuidora, bot, etc.)
- Información de contacto (email, teléfono)
- Estado activo/inactivo

### Casilleros y Responsables

Los casilleros son puntos de recepción de archivos que:
- Tienen uno o más responsables asignados
- Están vinculados a una instalación específica
- Pueden recibir archivos por diferentes métodos

Los responsables son usuarios que:
- Reciben notificaciones sobre los archivos recibidos
- Pueden gestionar uno o más casilleros
- Tienen niveles de acceso específicos

### Métodos de Envío Permitidos

Cada casillero puede tener múltiples métodos de envío habilitados:
1. **Email**
   - Dirección de email específica para el casillero
   - Configuración de filtros y validaciones
   - Sistema de respuestas automáticas

2. **SFTP**
   - Credenciales específicas
   - Directorio dedicado
   - Monitoreo automático

3. **Sistema de Archivos Local**
   - Directorios monitoreados
   - Patrones de nombres de archivo
   - Reglas de procesamiento

4. **API REST**
   - Endpoints dedicados
   - Tokens de autenticación
   - Rate limiting y seguridad

### Instalaciones

Una instalación representa la implementación de un producto en una organización y país específicos. Incluye:
- Organización asociada
- País de operación
- Producto implementado
- Configuraciones específicas

### Flujo de Procesamiento

1. **Recepción de Archivos**
   ```
   Emisor -> Método de Envío -> Casillero -> Validación Inicial
   ```

2. **Validación y Procesamiento**
   ```
   Validación Inicial -> Reglas YAML -> Procesamiento -> Notificaciones
   ```

3. **Notificaciones y Respuestas**
   ```
   Procesamiento -> Responsables -> Respuestas Automáticas -> Emisor
   ```

## Diagrama de Base de Datos

```
organizaciones
└── emisores
    └── metodos_envio_emisor
        └── casillas_recepcion
            ├── responsables
            └── instalaciones
                ├── productos
                └── paises
```

## Consideraciones de Seguridad

- Autenticación basada en tokens para API
- Encriptación de credenciales SFTP
- Validación de tipos de archivo
- Rate limiting por emisor
- Logs de auditoría

## Monitoreo y Métricas

El dashboard principal muestra:
- Estado de casilleros
- Estadísticas de procesamiento
- Alertas y notificaciones
- Métricas de rendimiento

## Escalabilidad

El sistema está diseñado para:
- Procesamiento asíncrono de archivos
- Múltiples workers para procesamiento
- Caché de configuraciones
- Balanceo de carga

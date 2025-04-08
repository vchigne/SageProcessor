# Arquitectura Lambda para Escalado SAGE

## Diagrama Conceptual

```
[Cliente] --> [API Gateway] --> [Next.js App]
                                    |
                                    ▼
[S3: archivos] <--> [sage_daemon] <--> [Lambda workers]
       ▲                |                    |
       |                ▼                    |
       └------- [DynamoDB: bloqueos] <-------┘
                        |
                        ▼
               [PostgreSQL: metadatos]
```

## Descripción General

La arquitectura propuesta permite que el sistema SAGE escale horizontalmente para procesar miles de archivos concurrentemente, sin realizar cambios significativos al código base existente. El componente central es el `sage_daemon`, que actúa como orquestador, decidiendo qué trabajos procesar localmente y cuáles delegar a funciones Lambda.

## Componentes Principales

### 1. sage_daemon (Orquestador)

El daemon existente se modifica para:
- Mantener una cola de trabajos pendientes
- Procesar hasta 3 trabajos localmente en paralelo
- Delegar trabajos adicionales a funciones Lambda cuando sea necesario
- Monitorear el estado de trabajos delegados

### 2. Almacenamiento Compartido (S3)

Reemplaza o complementa el directorio `executions` local:
- Estructura de carpetas virtuales por ID de ejecución
- Accesible tanto desde el servidor principal como desde Lambda
- Configurado con retención y encriptación adecuadas

### 3. Sistema de Bloqueos (DynamoDB)

Proporciona sincronización distribuida:
- Tabla con TTL para prevenir bloqueos indefinidos
- Operaciones atómicas para garantizar exclusividad
- Mecanismo de heartbeat para renovar bloqueos en ejecuciones largas

### 4. Funciones Lambda

Versiones ligeras del procesador de archivos:
- Reciben parámetros de ejecución del orquestador
- Acceden a archivos en S3
- Ejecutan el mismo código de procesamiento que la versión local
- Escriben resultados de vuelta en S3
- Registran metadata de ejecución en PostgreSQL

### 5. Base de Datos PostgreSQL

Mantiene la estructura actual:
- Accesible desde Lambda a través de VPC
- Almacena metadata de todas las ejecuciones
- Soporta consultas desde la interfaz web

## Flujo de Ejecución

1. **Recepción de Trabajo**
   - El archivo llega al sistema por la interfaz web o API
   - Se crea un registro en PostgreSQL con estado "pendiente"
   - El archivo se almacena en S3

2. **Orquestación**
   - `sage_daemon` detecta el trabajo pendiente
   - Evalúa carga actual del sistema y tamaño de la cola
   - Decide si procesar localmente o delegar a Lambda

3. **Procesamiento**
   - **Local**: Procesamiento directo como funciona actualmente
   - **Lambda**: 
     - Se invoca una función Lambda con los parámetros necesarios
     - La función adquiere un bloqueo distribuido
     - Procesa el archivo usando el mismo código base
     - Escribe resultados en S3
     - Actualiza estado en PostgreSQL
     - Libera el bloqueo

4. **Monitoreo y Resultados**
   - El `sage_daemon` monitorea el progreso de todas las ejecuciones
   - La interfaz web consulta PostgreSQL para mostrar estado
   - Logs y archivos de salida son accesibles desde S3

## Ventajas de la Arquitectura

- **Escalabilidad**: Capacidad para procesar miles de archivos simultáneamente
- **Resiliencia**: Los fallos en un nodo no afectan a otros procesamientos
- **Eficiencia**: Combinación óptima entre procesamiento local y distribuido
- **Costo-efectiva**: Sólo paga por el procesamiento real en Lambda
- **Mínimo cambio de código**: Mantiene la lógica de negocio existente
- **Transparente**: Usuarios finales no perciben diferencia en la interfaz

## Consideraciones Operativas

- **Monitoreo**: Dashboard centralizado con métricas clave
- **Alertas**: Notificaciones automáticas ante fallos o comportamientos anómalos
- **Costos**: Configuración de límites y alertas de presupuesto
- **Seguridad**: IAM con principio de mínimo privilegio
- **Backups**: Estrategia de respaldos para datos críticos

## Limitaciones y Soluciones

| Limitación | Solución |
|------------|----------|
| Tiempo máximo de ejecución Lambda (15 min) | Dividir procesamiento de archivos muy grandes en pasos |
| Cold starts de Lambda | Usar Provisioned Concurrency para las primeras N ejecuciones |
| Costos variables | Implementar monitoreo detallado y límites de concurrencia |
| Acceso base de datos | Configurar VPC y optimizar consultas para reducir latencia |
| Debugging distribuido | Sistema centralizado de logs y trazabilidad entre componentes |

## Escalamiento Futuro

Esta arquitectura sienta las bases para:
- Procesamiento multi-región para alta disponibilidad
- Implementación de cola de prioridades para trabajos críticos
- Analítica avanzada sobre patrones de uso
- Machine Learning para optimización predictiva de recursos
# Guía de Uso

## Configuración Básica

### 1. Gestión de Organizaciones

Para crear una nueva organización:
1. Acceder a "Configuración Básica"
2. Seleccionar la pestaña "Organizaciones"
3. Hacer clic en "Nueva Organización"
4. Completar el nombre y guardar

### 2. Configuración de Países

Para agregar un nuevo país:
1. Ir a la pestaña "Países"
2. Hacer clic en "Nuevo País"
3. Ingresar:
   - Código ISO
   - Nombre
   - Marcar si es territorio personalizado

### 3. Gestión de Productos

Para configurar productos:
1. Acceder a "Productos"
2. Crear nuevo producto con nombre
3. El producto estará disponible para crear instalaciones

### 4. Crear Instalaciones

Una instalación vincula:
1. Una organización
2. Un país
3. Un producto específico

## Configuración de Emisores

### 1. Crear Emisor

1. Seleccionar la organización
2. Hacer clic en "Nuevo Emisor"
3. Completar:
   - Nombre
   - Tipo de emisor
   - Email corporativo
   - Teléfono

### 2. Configurar Métodos de Envío

Para cada emisor, configurar los métodos permitidos:

#### Email
1. Habilitar recepción por email
2. Configurar dirección de email
3. Establecer filtros de remitente

#### SFTP
1. Generar credenciales
2. Configurar directorio
3. Establecer patrones de archivo

#### Sistema de Archivos Local
1. Definir directorio de monitoreo
2. Configurar patrones de nombre
3. Establecer frecuencia de revisión

#### API
1. Generar token de acceso
2. Configurar rate limits
3. Definir formatos aceptados

## Gestión de Casilleros

### 1. Crear Casillero

1. Seleccionar instalación
2. Definir nombre y descripción
3. Asignar responsables

### 2. Configurar Responsables

Para cada casillero:
1. Agregar responsables
2. Definir niveles de acceso
3. Configurar notificaciones

### 3. Reglas de Procesamiento

Usando YAML Studio:
1. Crear reglas de validación
2. Definir transformaciones
3. Establecer respuestas automáticas

## Monitoreo y Dashboard

### 1. Vista General

El dashboard muestra:
- Estado de casilleros
- Archivos procesados
- Alertas activas

### 2. Métricas Detalladas

Acceder a:
- Estadísticas por emisor
- Tiempos de procesamiento
- Errores y advertencias

### 3. Reportes

Generar reportes de:
1. Actividad por casillero
2. Rendimiento del sistema
3. Auditoría de accesos

## Solución de Problemas

### 1. Logs del Sistema

Acceder a los logs para:
- Verificar errores
- Monitorear actividad
- Diagnosticar problemas

### 2. Herramientas de Diagnóstico

Usar las herramientas para:
1. Validar configuraciones
2. Probar conexiones
3. Verificar permisos

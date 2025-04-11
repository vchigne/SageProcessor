# Procesamiento de Datos Directos en SAGE

Este documento explica el funcionamiento del procesamiento de datos directos en el sistema SAGE y las recientes mejoras implementadas para garantizar la compatibilidad con el validador YAML.

## Problemas Identificados

Se identificaron dos problemas principales en el procesamiento de datos directos:

1. **UUID inconsistentes**: El UUID almacenado en la base de datos no coincidía con el UUID usado para crear el directorio de ejecución.

2. **Columnas faltantes en archivos generados**: Al procesar datos directos, el sistema generaba archivos Excel/CSV que no incluían las columnas vacías, lo que causaba errores de validación cuando el YAML esperaba un número específico de columnas.

## Soluciones Implementadas

### 1. Sincronización de UUIDs

- Se modificó `datos-directos.ts` para extraer el UUID directamente del nombre del directorio de ejecución
- Este UUID extraído se utiliza consistentemente en la base de datos y en las URLs de respuesta
- Ver documentación detallada en [UUID_PROCESS.md](./UUID_PROCESS.md)

### 2. Preservación de Estructura de Columnas

Para solucionar el problema de las columnas faltantes, se han implementado las siguientes mejoras:

1. **Obtención de columnas desde el YAML**:
   - La función `crearArchivoDesdeData()` ahora recibe el contenido YAML completo
   - Se extraen los nombres de todas las columnas definidas en el YAML para ese catálogo
   - Si no se encuentran definiciones en el YAML, se utiliza el modo anterior (usar columnas de los datos)

2. **Preservación de la estructura**:
   - Se asegura que todas las filas incluyan todas las columnas definidas en el YAML
   - Las columnas ausentes en los datos se inicializan con valores vacíos
   - Esto mantiene el número exacto de columnas requerido por el validador YAML

3. **Mejora en la generación de archivos**:
   - Los archivos Excel y CSV generados ahora incluyen todas las columnas definidas
   - Se respeta el orden de las columnas según la definición YAML

## Ejemplo de Proceso

1. **Datos recibidos del formulario**:
   ```json
   {
     "catalogo1": [
       {"columna1": "valor1", "columna2": "valor2"}
     ]
   }
   ```

2. **Definición YAML del catálogo**:
   ```yaml
   catalogs:
     catalogo1:
       columns:
         columna1:
           type: string
         columna2:
           type: string
         columna3:
           type: integer
         columna4:
           type: date
   ```

3. **Archivo generado (antes)**:
   Solo incluía columna1 y columna2

4. **Archivo generado (después)**:
   Incluye todas las columnas: columna1, columna2, columna3 y columna4 (con valores vacíos para columna3 y columna4)

## Impacto en el Procesamiento

- Se reducen los errores de validación por estructura incorrecta
- Se mantiene la integridad de los datos respetando la definición YAML
- El validador puede procesar correctamente los archivos generados desde el portal

## Estructura de Datos Completa

El sistema ahora garantiza que todos los archivos generados a través del portal tengan la estructura completa según la definición YAML, incluyendo:

1. El número exacto de columnas
2. Los nombres correctos para cada columna
3. El orden de columnas según la definición YAML

Esto permite una validación precisa y evita errores causados por columnas opcionales que el usuario podría dejar en blanco.
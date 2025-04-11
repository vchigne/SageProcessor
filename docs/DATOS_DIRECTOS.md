# Procesamiento de Datos Directos en SAGE

## Descripción

El módulo de datos directos permite a los usuarios cargar información manualmente a través de formularios en la interfaz web, que luego es procesada por el motor SAGE según la configuración YAML asociada a una casilla específica.

## Flujo de Proceso

1. **Ingreso de datos**: El usuario ingresa datos en un formulario web generado dinámicamente a partir de la configuración YAML.

2. **Validación inicial**: Los datos son validados en el lado del cliente y luego en el servidor para asegurar que cumplen con las reglas básicas de formato.

3. **Creación de archivo temporal**: Los datos validados son convertidos a un archivo temporal en formato CSV o Excel según la configuración del YAML. Este archivo se almacena en el directorio `tmp/`.

4. **Generación de UUID**: Se genera un identificador único (UUID) para la ejecución.

5. **Registro en base de datos**: Se crea un registro en la tabla `ejecuciones_yaml` con el estado inicial "Parcial".

6. **Procesamiento SAGE**: Se ejecuta el procesador SAGE a través de un script Python temporal que invoca `process_files()` con los parámetros adecuados.

7. **Limpieza de temporales**: Una vez completado el procesamiento, se eliminan los archivos temporales.

8. **Actualización de registro**: Se actualiza el registro en la base de datos con el resultado (errores, advertencias, estado final).

## Implementación Técnica

### 1. Generación de archivo temporal

```typescript
// Determinar el formato basado en la configuración YAML
const formato = obtenerFormatoArchivo(yamlContent, catalogName);
const fileExt = formato.type.toLowerCase() === 'excel' ? '.xlsx' : '.csv';

// Crear archivo temporal
const archivoName = `datos_directos_${timestamp}`;
const tmpFilePath = path.join(process.cwd(), 'tmp', archivoName + fileExt);
await crearArchivoDesdeData(data, catalogName, tmpFilePath, formato);
```

### 2. Invocación del procesador SAGE

```typescript
// Crear script temporal para invocar SAGE
const pythonCode = `
import os
import json
import sys
from sage.main import process_files

try:
    # Llamar a process_files con los parámetros adecuados
    execution_uuid, error_count, warning_count = process_files(
        yaml_path="${yamlPath}", 
        data_path="${filePath}",
        casilla_id=${casilla_id},
        metodo_envio="portal_upload"
    )
    
    # Imprimir el resultado como JSON para procesarlo en JavaScript
    print(json.dumps({
        "execution_uuid": execution_uuid,
        "errors": error_count,
        "warnings": warning_count
    }))
    sys.exit(0)
except Exception as e:
    print(json.dumps({
        "error": str(e)
    }))
    sys.exit(1)
`;

// Ejecutar el script
const pythonProcess = spawn('python3', [pythonScriptPath], {
  env: { 
    ...process.env,
    PYTHONPATH: process.cwd()
  }
});
```

### 3. Limpieza de archivos temporales

```typescript
// Limpieza del YAML temporal
try {
  await fsPromises.unlink(yamlPath);
} catch (err) {
  console.error('Error al eliminar archivo YAML temporal:', err);
}

// Limpieza del script Python temporal
try {
  await fsPromises.unlink(pythonScriptPath);
} catch (err) {
  console.error('Error al eliminar script Python temporal:', err);
}
```

## Ventajas del enfoque

1. **Simplicidad**: Utiliza la misma función `process_files()` que el resto del sistema, manteniendo la coherencia.

2. **Generación estándar de resultados**: Todos los archivos de resultados (logs, reportes) se generan en el directorio de ejecuciones con la misma estructura que otros métodos.

3. **Limpieza**: Los archivos temporales se eliminan después del procesamiento, evitando acumulación de datos innecesarios.

4. **Rastreabilidad**: El UUID generado permite rastrear la ejecución en el sistema de logs y reportes.

## Consideraciones importantes

- El procesamiento es asíncrono desde la perspectiva del servidor web, pero sincrónico para el usuario (la solicitud HTTP espera a que termine).
- Los archivos de datos originales no se conservan en su formato JSON, sino que se convierten a CSV o Excel para ser procesados.
- El método de envío registrado es "portal_upload" para distinguirlo de otras fuentes de datos.
- La selección entre CSV y Excel se basa en la configuración del catálogo en el YAML.
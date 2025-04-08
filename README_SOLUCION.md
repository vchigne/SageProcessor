# Solución al Problema de BOM en SAGE

## Descripción del Problema

SAGE es un sistema que procesa archivos YAML de configuración y archivos CSV de datos. Los archivos CSV del proyecto Clorox tienen un formato UTF-8 con BOM (Byte Order Mark), que causa problemas de lectura en el procesador de archivos original.

## Diagnóstico

Después de analizar los archivos, se identificaron los siguientes problemas:

1. Todos los archivos CSV tienen un marcador BOM al inicio (bytes EF BB BF)
2. El procesador de archivos de SAGE no maneja correctamente este marcador BOM
3. Existen discrepancias entre la estructura definida en el YAML y la estructura real de los archivos CSV

## Soluciones Implementadas

### 1. Modificación Directa del Procesador de Archivos

Se ha modificado directamente el archivo `sage/file_processor.py` para incluir una función de detección de BOM y utilizar la codificación adecuada:

```python
def detect_bom(file_path):
    """
    Detecta si un archivo tiene BOM (Byte Order Mark)
    
    Args:
        file_path: Ruta al archivo a comprobar
        
    Returns:
        bool: True si el archivo tiene BOM, False en caso contrario
    """
    try:
        with open(file_path, 'rb') as f:
            # BOM UTF-8: EF BB BF
            return f.read(3) == b'\xef\xbb\xbf'
    except Exception:
        return False
```

El método `_read_file` ha sido modificado para detectar automáticamente si un archivo CSV tiene BOM y usar la codificación `utf-8-sig` en ese caso:

```python
def _read_file(self, file_path: str, catalog: Catalog) -> pd.DataFrame:
    # ...
    if file_type == 'CSV':
        # Detectar BOM en el archivo CSV
        has_bom = detect_bom(file_path)
        
        # Si tiene BOM, usar utf-8-sig que maneja automáticamente el BOM
        if has_bom:
            try:
                df = pd.read_csv(
                    file_path,
                    delimiter=catalog.file_format.delimiter,
                    header=0 if catalog.file_format.header else None,
                    encoding='utf-8-sig'  # Esta codificación maneja BOM correctamente
                )
            except Exception:
                # Si falla con utf-8-sig, probar alternativas
                df = pd.read_csv(
                    file_path,
                    delimiter=catalog.file_format.delimiter,
                    header=0 if catalog.file_format.header else None,
                    encoding='latin1'
                )
        else:
            # No tiene BOM, seguir el proceso normal
            # ...
```

Esta solución permite que el procesador maneje transparentemente archivos CSV con o sin BOM.

### 2. Herramientas de Prueba y Diagnóstico

Se han creado herramientas para probar y verificar el correcto funcionamiento de la solución:

1. `test_bom_support.py`: Script de prueba que crea archivos con y sin BOM para verificar la detección y procesamiento
2. `procesar_clorox_bom.py`: Script específico para procesar el archivo CloroxGenerico.yaml con el nuevo procesador

### 3. Soluciones Alternativas Mantenidas

Se han mantenido las soluciones alternativas desarrolladas previamente:

1. **Parche en tiempo de ejecución** (`sage/bom_patch.py`): Para aplicarlo sin modificar el código fuente
2. **Herramienta para eliminar BOM** (`eliminar_bom.py`): Como solución alternativa para pre-procesar archivos
3. **Configuración YAML corregida** (`test_csv/CloroxGenerico_final.yaml`): Para pruebas con estructura correcta

## ¿Por qué usar utf-8-sig en lugar de eliminar el BOM?

El BOM (Byte Order Mark) es un marcador que indica la codificación del archivo. Usar `utf-8-sig` como codificación tiene varias ventajas sobre eliminar el BOM:

1. **Preservación de datos**: No altera el archivo original
2. **Manejo transparente**: Pandas reconoce el BOM y lo maneja correctamente
3. **Preservación de caracteres especiales**: Garantiza que se interpreten correctamente
4. **Compatibilidad**: Funciona tanto para archivos con BOM como sin él

La codificación `utf-8-sig` interpreta correctamente el BOM como parte de la información de codificación, sin tratarlo como contenido del archivo.

## Uso Recomendado

Con la modificación directa de `file_processor.py`, ahora se puede usar SAGE normalmente sin necesidad de scripts especiales:

```bash
python -m sage.main test_csv/CloroxGenerico_final.yaml test_cli/output.zip
```

Para probar específicamente el manejo de BOM:

```bash
python test_bom_support.py
```

Para procesar el archivo CloroxGenerico:

```bash
python procesar_clorox_bom.py
```

## Beneficios de la Solución

1. **Transparencia total**: El procesador maneja automáticamente archivos con o sin BOM
2. **Sin cambios en el flujo de trabajo**: No requiere pasos adicionales o pre-procesamiento
3. **Mantenimiento sencillo**: La solución está integrada en el código base
4. **Retrocompatibilidad**: No afecta al procesamiento de archivos sin BOM
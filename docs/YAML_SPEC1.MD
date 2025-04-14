
# Especificación YAML para SAGE v1.1.0

## 🎯 Introducción

SAGE utiliza archivos YAML para definir la estructura y reglas de validación de datos. Esta especificación define la sintaxis y convenciones para crear estas configuraciones.

## 📊 Tipos de Datos y Validaciones

### Tipos Básicos

| Tipo     | Descripción              | Validación Recomendada                                    | Ejemplo           |
|----------|-------------------------|--------------------------------------------------------|-------------------|
| texto    | Cadenas de texto        | `str.match()`                                          | "ABC123"          |
| decimal  | Números con decimales   | `astype(float)`                                        | 123.45           |
| entero   | Números enteros         | `pd.to_numeric(x).apply(lambda x: float(x).is_integer() if pd.notnull(x) else True)` | 42               |
| fecha    | Fechas en formato ISO   | `pd.to_datetime()`                                     | "2025-03-10"     |
| booleano | Valores verdadero/falso | `astype(bool)`                                         | true/false       |

### Reglas de Validación Mejoradas

#### Para Enteros
```yaml
validation_rules:
  - name: "Validar Entero"
    description: "El campo debe ser un número entero"
    rule: "pd.to_numeric(df['campo']).apply(lambda x: float(x).is_integer() if pd.notnull(x) else True)"
    severity: "error"
```

#### Para Decimales
```yaml
validation_rules:
  - name: "Validar Decimal"
    description: "El campo debe ser un número con 2 decimales máximo"
    rule: "df['campo'].astype(float).round(2) == df['campo'].astype(float)"
    severity: "error"
```

## 🏗️ Estructura del YAML

### Secciones Principales

```yaml
sage_yaml:        # Metadatos del YAML
  name: "Nombre"
  description: "Descripción"
  version: "1.0.0"
  author: "Autor"
  comments: "Comentarios"

catalogs:         # Definición de catálogos
  # ... catálogos

packages:         # Definición de paquetes
  # ... paquetes
```

### Definición de Catálogos

```yaml
catalogs:
  nombre_catalogo:
    name: "Nombre del Catálogo"
    description: "Descripción"
    filename: "archivo.ext"
    file_format:
      type: "CSV|EXCEL"
      delimiter: ","        # Solo para CSV
      header: true         # Indica si tiene encabezados
    
    fields:
      - name: "campo"
        type: "tipo_dato"
        required: true|false
        unique: true|false
        validation_rules:
          - name: "Nombre Regla"
            description: "Descripción amigable"
            rule: "expresión pandas"
            severity: "error|warning"

    catalog_validation:    # Validaciones a nivel catálogo
      - name: "Nombre"
        description: "Descripción"
        rule: "expresión pandas"
        severity: "error|warning"
```

### Definición de Paquetes

```yaml
packages:
  nombre_paquete:
    name: "Nombre del Paquete"
    description: "Descripción"
    file_format:
      type: "ZIP|CSV|EXCEL"
    catalogs:
      - catalogo1
      - catalogo2
    package_validation:
      - name: "Nombre"
        description: "Descripción"
        rule: "expresión pandas"
        severity: "error|warning"
```

## 💡 Mejores Prácticas

### Validaciones Numéricas
1. Usar `pd.to_numeric()` para conversión segura
2. Implementar `float(x).is_integer()` para enteros
3. Manejar NaN/null con `pd.notnull()`
4. Usar `astype()` solo después de validar tipo

### Mensajes de Error
1. Usar lenguaje amigable y emoji
2. Incluir sugerencias de corrección
3. Ser específico pero conciso

### Ejemplos Prácticos

#### Validación de Enteros
```yaml
validation_rules:
  - name: "Código Numérico"
    description: "¡Hey! El código debe ser un número entero 🔢"
    rule: "pd.to_numeric(df['codigo']).apply(lambda x: float(x).is_integer() if pd.notnull(x) else True)"
    severity: "error"
```

#### Validación de Fechas
```yaml
validation_rules:
  - name: "Fecha Válida"
    description: "¡La fecha debe estar en formato YYYY-MM-DD! 📅"
    rule: "pd.to_datetime(df['fecha'], errors='coerce').notnull()"
    severity: "error"
```

#### Validación Entre Catálogos
```yaml
package_validation:
  - name: "Referencias Válidas"
    description: "¡Ups! Algunos códigos no existen en el catálogo maestro 🔍"
    rule: "df['ventas']['codigo'].isin(df['productos']['codigo'])"
    severity: "error"
```

## 📝 Notas Importantes

1. Las validaciones de enteros ahora usan `float(x).is_integer()` para mayor precisión
2. Se recomienda usar `pd.to_numeric()` antes de validaciones numéricas
3. Los mensajes de error deben ser constructivos y amigables
4. Las reglas deben manejar casos nulos apropiadamente
5. La severidad determina cómo se maneja el error (error/warning)

## 🔄 Compatibilidad

Esta especificación es compatible con versiones anteriores pero introduce mejoras en:
- Validación de tipos numéricos
- Manejo de valores nulos
- Mensajes de error
- Reglas entre catálogos


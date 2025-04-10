# Especificación YAML para SAGE

## 🎯 Introducción

SAGE utiliza archivos YAML para definir la estructura y reglas de validación de tus datos. Esta documentación te ayudará a crear y mantener estos archivos de configuración.

## 🏗️ Estructura General

Un archivo YAML de SAGE tiene tres secciones principales obligatorias:

sage_yaml:        # Información general del YAML (requerido)
  # ... configuración general

catalogs:         # Definición de catálogos (requerido)
  # ... definición de catálogos

packages:         # Definición de paquetes (requerido)
  # ... definición de paquetes
```

## 📊 Tipos de Datos Soportados

SAGE soporta los siguientes tipos de datos:

| Tipo     | Descripción                  | Validación           | Ejemplo           |
|----------|------------------------------|---------------------|-------------------|
| texto    | Cadenas de texto            | `str.match()`      | "ABC123"          |
| decimal  | Números con decimales       | `astype(float)`    | 123.45           |
| entero   | Números enteros             | `astype(int)`      | 42               |
| fecha    | Fechas en formato ISO       | `pd.to_datetime()` | "2025-03-10"     |
| booleano | Valores verdadero/falso     | `astype(bool)`     | true/false       |

## 📑 Secciones del YAML

### Encabezado (sage_yaml)

Contiene la información general del archivo de configuración. Todos los campos son obligatorios.


sage_yaml:
  name: "Nombre del YAML"           # Nombre descriptivo (requerido)
  description: "Descripción"        # Explicación del propósito (requerido)
  version: "1.0.0"                 # Versión del archivo (requerido)
  author: "Nombre del Autor"       # Autor del YAML (requerido)
  comments: "Comentarios"          # Notas adicionales (opcional)
```

### Catálogos (catalogs)

Define la estructura y reglas de validación para cada tipo de archivo.


catalogs:
  nombre_catalogo_csv:                 # Identificador único del catálogo
    name: "Nombre del Catálogo CSV"    # Nombre descriptivo (requerido)
    description: "Descripción"     # Explicación del catálogo (requerido)
    filename: "archivo.csv"        # Nombre del archivo sin ruta (requerido)
    file_format:                  # Configuración del formato (requerido)
      type: "CSV"                 # Tipo: CSV o EXCEL solamente
      delimiter: ","              # Requerido para CSV
      header: true                # Opcional, indica si el archivo tiene encabezados (true) o no (false). IMPORTANTE: Esta propiedad DEBE estar dentro de file_format
      
  nombre_catalogo_excel:              # Identificador único del catálogo
    name: "Nombre del Catálogo Excel" # Nombre descriptivo (requerido)
    description: "Descripción"     # Explicación del catálogo (requerido)
    filename: "archivo.xlsx"       # Nombre del archivo sin ruta (requerido)
    file_format:                  # Configuración del formato (requerido)
      type: "EXCEL"               # Tipo: CSV o EXCEL solamente
      header: true                # Opcional, indica si el archivo tiene encabezados (true) o no (false). IMPORTANTE: Esta propiedad SIEMPRE debe estar dentro de file_format

    fields:                       # Lista de campos (requerido)
      - name: "codigo"            # Nombre del campo (requerido)
        type: "texto"             # Tipo de dato (requerido)
        required: true            # Campo obligatorio (opcional)
        unique: true              # Debe ser único (opcional)
        validation_rules:         # Reglas de validación (opcional)
          - name: "Regla 1"       # Nombre descriptivo
            description: "¡Ops! El código no es válido 😅"  # Mensaje amigable
            rule: "df['codigo'].notnull()"  # Expresión pandas
            severity: "error"     # error/warning

    row_validation:              # Validaciones a nivel de fila (opcional)
      - name: "Validación de Fila"
        description: "¡Hey! El total debe ser positivo 💰"
        rule: "df['total'] > 0"
        severity: "error"

    catalog_validation:          # Validaciones a nivel de catálogo (opcional)
      - name: "Validación de Catálogo"
        description: "¡Cuidado! El total excede el límite 🚨"
        rule: "df['total'].sum() < 1000000"
        severity: "warning"


### Paquetes (packages)

Agrupa múltiples catálogos y define validaciones entre ellos. Para paquetes con múltiples catálogos, solo se permite el formato ZIP.


packages:
  nombre_paquete:                # Identificador único del paquete
    name: "Nombre del Paquete"   # Nombre descriptivo (requerido)
    description: "Descripción"   # Explicación del paquete (requerido)
    file_format:                # Configuración del formato (requerido)
      type: "ZIP"               # ZIP para múltiples catálogos
                               # CSV o EXCEL solo para un catálogo
    catalogs:                   # Lista de catálogos incluidos (requerido)
      - catalogo1              # Debe existir en la sección catalogs
      - catalogo2
    package_validation:         # Validaciones entre catálogos (opcional)
      - name: "Validación Cruzada"
        description: "¡Ups! El cliente no existe en el catálogo 🤔"
        rule: "df['ventas']['cliente'].isin(df['clientes']['id'])"
        severity: "error"

## 🎯 Reglas de Validación

Las reglas de validación utilizan expresiones pandas y deben seguir estas convenciones específicas:

### Sintaxis para Tipos Numéricos

# Para "mayor a X":
rule: "df['columna'].astype(float) > X"

# Para "mayor o igual a X":
rule: "df['columna'].astype(float) >= X"

# NO usar estas formas:
# ❌ df['columna'] > X
# ❌ float(df['columna']) > X


### Operadores Comunes
- Comparación: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Texto: `.str.match()`, `.str.contains()`
- Nulos: `.notnull()`, `.isnull()`
- Múltiples condiciones: `&` (and), `|` (or)

### Ejemplos de Reglas

# Verificar que un código siga un patrón
rule: "df['codigo'].str.match('^[A-Z]-[0-9]{3}$')"

# Validar rango numérico (con conversión explícita)
rule: "df['precio'].astype(float).between(0, 1000000)"

# Comprobar relaciones entre columnas
rule: "df['total'].astype(float) == df['cantidad'].astype(float) * df['precio'].astype(float)"

# Validaciones de fecha
rule: "pd.to_datetime(df['fecha_entrega']) > pd.to_datetime(df['fecha_pedido'])"

## 📝 Mensajes de Error

SAGE utiliza mensajes de error amigables y descriptivos. Sigue estas pautas:

1. **Usa lenguaje conversacional:**

# ✅ Bien
description: "¡Ops! El precio no puede ser negativo 😅"

# ❌ Mal
description: "Error: precio < 0"


2. **Incluye sugerencias de corrección:**

# ✅ Bien
description: "¡Hey! El código debe tener el formato P-123 📝"

# ❌ Mal
description: "Formato de código inválido"

3. **Usa emojis apropiadamente:**

# ✅ Bien
description: "¡Atención! El total excede el límite de crédito 💳"

# ❌ Mal
description: "🚫❌💢 ERROR EN TOTAL"


## 🎓 Consejos y Mejores Prácticas

1. **Nombres de Campos**
   - Usa nombres descriptivos y consistentes
   - Evita espacios y caracteres especiales
   - Mantén la misma convención en todo el YAML
   - Usa nombres que reflejen el contenido (ej: fecha_creacion vs fecha1)
   - Limita la longitud a 30 caracteres para mejor legibilidad

2. **Reglas de Validación**
   - Comienza con reglas simples y añade complejidad gradualmente
   - Usa mensajes de error claros y descriptivos
   - Considera el impacto en el rendimiento con reglas complejas
   - Siempre convierte tipos numéricos usando .astype()
   - Valida primero los casos más comunes
   - Agrupa validaciones relacionadas

3. **Organización**
   - Agrupa campos relacionados en el mismo catálogo
   - Usa paquetes para validaciones que involucren múltiples catálogos
   - Mantén las validaciones de catálogo separadas de las validaciones de paquete
   - Sigue una estructura lógica en el orden de los campos
   - Documenta las relaciones entre catálogos

4. **Mantenimiento**
   - Documenta los cambios en la versión del YAML
   - Mantén los comentarios actualizados
   - Revisa periódicamente las reglas de validación
   - Implementa un sistema de versionado semántico
   - Haz copias de seguridad antes de cambios mayores

5. **Optimización**
   - Minimiza el uso de expresiones regulares complejas
   - Evita validaciones redundantes
   - Usa índices para campos frequently buscados
   - Mantén las validaciones de catálogo simples
   - Prioriza la claridad sobre la complejidad

6. **Gestión de Errores**
   - Usa mensajes amigables y constructivos
   - Incluye sugerencias de corrección
   - Mantén un balance entre errores y advertencias
   - Agrupa errores relacionados
   - Proporciona contexto en los mensajes

7. **Paquetes ZIP**
   - Solo usa ZIP para múltiples catálogos
   - Mantén una estructura de directorios clara
   - Nombra los archivos consistentemente
   - Verifica relaciones entre catálogos
   - Documenta la estructura del ZIP

8. **Pruebas**
   - Valida con datos de prueba representativos
   - Prueba casos límite y valores extremos
   - Verifica todas las reglas de validación
   - Documenta casos de prueba importantes
   - Mantén un conjunto de datos de prueba actualizado

## 📝 Ejemplos Prácticos

### Validaciones Numéricas

validation_rules:
  - name: "Validar Total"
    description: "¡Hey! El total debe ser la suma de los productos 🧮"
    rule: "df['total'].astype(float) == df.apply(lambda x: x['cantidad'].astype(float) * x['precio'].astype(float), axis=1)"
    severity: "error"


### Validaciones de Fecha

validation_rules:
  - name: "Rango de Fechas"
    description: "¡Ops! La fecha debe estar entre 2020 y 2025 📅"
    rule: "pd.to_datetime(df['fecha']).dt.year.between(2020, 2025)"
    severity: "error"


### Validaciones de Texto

validation_rules:
  - name: "Formato Email"
    description: "¡El email debe tener un formato válido! 📧"
    rule: "df['email'].str.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')"
    severity: "error"

### Validaciones Entre Catálogos

package_validation:
  - name: "Verificar Referencias"
    description: "¡Ups! Algunos productos no existen en el catálogo maestro 🔍"
    rule: "df['ventas']['producto_id'].isin(df['productos']['id'])"
    severity: "error"

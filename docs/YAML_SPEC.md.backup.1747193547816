# Especificación YAML para SAGE

## 🎯 Introducción

SAGE utiliza archivos YAML para definir la estructura y reglas de validación de tus datos. Esta documentación te ayudará a crear y mantener estos archivos de configuración.

## Uso de tipos de archivo

El sistema SAGE puede procesar varios tipos de archivos:

- `CSV`: Archivos delimitados por caracteres (coma, punto y coma, etc.)
- `EXCEL`: Hojas de cálculo Microsoft Excel (XLS, XLSX)
- `ZIP`: Archivos comprimidos que contienen múltiples archivos CSV o Excel

La configuración `file_format.type` determina qué tipo de archivo espera cada paquete o catálogo. Es crucial que esta configuración coincida con el formato real del archivo, ya que SAGE utiliza esta información para determinar cómo procesar los datos.

### Importante: Procesamiento según tipo de archivo

Cuando SAGE recibe un archivo para procesar:

1. Primero determina el tipo de archivo por su extensión (.csv, .xlsx, .zip)
2. Luego busca en la configuración YAML un paquete o catálogo con `file_format.type` coincidente
3. Si encuentra una coincidencia, utiliza esa configuración para procesar el archivo
4. Si no encuentra coincidencia, puede generar un error o intentar utilizar una configuración alternativa

Para el ingreso de datos directos a través del portal, el sistema generará automáticamente el formato de archivo (CSV o Excel) que coincida con la configuración del primer catálogo disponible en el YAML, respetando configuraciones como delimitadores específicos para CSV o nombres de hojas para Excel.

## 🏗️ Estructura General

Un archivo YAML de SAGE tiene tres secciones principales obligatorias:

```yaml
sage_yaml:        # Información general del YAML (requerido)
  # ... configuración general

catalogs:         # Definición de catálogos (requerido)
  # ... definición de catálogos

packages:         # Definición de paquetes (requerido)
  # ... definición de paquetes
```

## 📊 Tipos de Datos Soportados

SAGE soporta los siguientes tipos de datos:

| Tipo     | Descripción                  | Ejemplo           |
|----------|------------------------------|-------------------|
| texto    | Cadenas de texto             | "ABC123"          |
| decimal  | Números con decimales        | 123.45            |
| entero   | Números enteros              | 42                |
| fecha    | Fechas en formato ISO        | "2025-03-10"      |
| booleano | Valores verdadero/falso      | true/false       |

## 📑 Secciones del YAML

### Encabezado (sage_yaml)

Contiene la información general del archivo de configuración. Todos los campos son obligatorios.


yaml
sage_yaml:
  name: "Nombre del YAML"           # Nombre descriptivo (requerido)
  description: "Descripción"        # Explicación del propósito (requerido)
  version: "1.0.0"                 # Versión del archivo (requerido)
  author: "Nombre del Autor"       # Autor del YAML (requerido)
  comments: "Comentarios"          # Notas adicionales (opcional)


### Catálogos (catalogs)

Define la estructura y reglas de validación para cada tipo de archivo.


catalogs:
  nombre_catalogo_csv:                 # Identificador único del catálogo
    name: "Nombre del Catálogo CSV"    # Nombre descriptivo (requerido)
    description: "Descripción"     # Explicación del catálogo (requerido)
    filename: "archivo.csv"        # Nombre del archivo sin ruta (requerido)
    file_format:                  # Configuración del formato (requerido)
      type: "CSV"                 # Tipo: CSV o EXCEL solamente
      delimiter: ","              # Requerido para CSV, pero no se usa para excel o zip 
      header: true                # Opcional, indica si el archivo tiene encabezados (true) o no (false). IMPORTANTE: Esta propiedad DEBE estar dentro de file_format
      
     fields:                       # Lista de campos (requerido)
      - name: "codigo"            # Nombre del campo (requerido)
        type: "texto"             # Tipo de dato (requerido)
        required: true            # Campo obligatorio (opcional)
        unique: true              # Debe ser único (opcional)
        validation_rules:         # Reglas de validación (opcional)
          - name: "Regla 1"       # Nombre descriptivo
            description: "¡Ops! El código no es válido 😅"  # Mensaje amigable
            rule: "df['codigo'].notnull()"  # Expresión dataframe pandas
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

SAGE valida automaticamente los siguientes casos:
- Que el archivo exista.
- Que tenga la extension y tipo de archivo correcto tal como esta definido en el YAML.
- Que los datos definidos como required estén presentes.
- Que los datos definidos como unique sean unicos.
- Que los datos definidos con un tipo de dato especifico (texto, decimal,entero, fecha, booleano) tengan el tipo de dato requerido.
- Que la cantidad de columnas en el archivo sea la misma que esta definida en el YAML.
Por tanto, en el yaml no hay que escribir validaciones especificas para esas condiciones, basta con especificar Required, Unique, el tipo de datos para que se apliquen las validaciones. No escribir en el yaml validacion especifica para estas condiciones, ni para validar cantidad de columnas.
Si en la seccion de campos del catalogo existen campos que no rquieran validacion, la seccion  validation_rules:  no debe ser venerada, no es necesario, ya que es opcional. Se incluye solo cuando hay reglas para ese campo. Lo mismo con  row_validation:, catalog_validation: y package_validation: . Si no existe validacion, no es necesario incluirlas.


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
   - Recuerda que esos nombres de campo pueden ser utilizados como nombres de columna en una tabla, por lo que debes de hacer que sea un nombre de columna valido. Si por algun motivo esta repertido, utiliza un postfijo para los nombres de campo repetidos (ejemplo Cantidad, Cantidad_1, Cantidad_2)

2. **Reglas de Validación**
   - Comienza con reglas simples. Si el usuario quiere reglas complejas las va a solicitar explicitamente.
   - Usa mensajes de error claros y descriptivos
   - Considera el impacto en el rendimiento con reglas complejas
   - Siempre convierte tipos numéricos usando .astype()
   - Valida primero los casos más comunes
   - Agrupa validaciones relacionadas

3. **Organización**
      - Usa paquetes para validaciones que involucren múltiples catálogos
   - Mantén las validaciones de catálogo separadas de las validaciones de paquete
   - Sigue una estructura lógica en el orden de los campos
   - Documenta las relaciones entre catálogos

4. **Optimización**
   - Minimiza el uso de expresiones regulares complejas
   - Evita validaciones redundantes
   - Usa índices para campos frequently buscados
   - Mantén las validaciones de catálogo simples
   - Prioriza la claridad sobre la complejidad

5. **Gestión de Errores**
   - Usa mensajes amigables y constructivos
   - Incluye sugerencias de corrección
   - Mantén un balance entre errores y advertencias
   - Agrupa errores relacionados
   - Proporciona contexto en los mensajes

6. **Paquetes ZIP**
   - Solo usa ZIP para múltiples catálogos
   - Mantén una estructura de relaciones entre catalogos clara
   - Nombra los archivos consistentemente
   - Verifica relaciones entre catálogos, de preferencia catalogo por catalogo en lugar de escribir una sola expresion para todas las relaciones.
   - Documenta la estructura del ZIP


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

# Documentación: Formato JSON de Configuración de Frecuencias

Este documento detalla la estructura y uso del campo `configuracion_frecuencia` utilizado en SAGE para gestionar las frecuencias de envío de información por parte de los emisores.

## Estructura General

El campo `configuracion_frecuencia` es un objeto JSON con la siguiente estructura base:

```json
{
  "tipo": "string",       // Tipo de frecuencia (diario, semanal, mensual, etc.)
  "hora": "HH:MM",        // Hora de envío en formato de 24 horas
  "dias_semana": ["..."], // Solo para frecuencia semanal
  "dias_mes": ["..."],    // Solo para frecuencia mensual
  "dia_limite": "N"       // Solo para frecuencia hasta_dia_n
}
```

## Tipos de Frecuencia

El sistema admite los siguientes tipos de frecuencia, cada uno con parámetros específicos:

### 1. Diario

Indica que el emisor debe enviar información todos los días a una hora específica.

```json
{
  "tipo": "diario",
  "hora": "09:00"
}
```

Para verificar si un envío está demorado:
- Comprobar si ha pasado la hora de envío para el día actual.

### 2. Semanal

Indica que el emisor debe enviar información en días específicos de la semana.

```json
{
  "tipo": "semanal",
  "hora": "15:30",
  "dias_semana": ["lunes", "miércoles", "viernes"]
}
```

Para verificar si un envío está demorado:
- Comprobar si el día actual está en la lista `dias_semana`.
- Si está en la lista, verificar si ha pasado la hora de envío.
- Si no está en la lista, verificar si el último día de la lista anterior al día actual ha recibido envío.

### 3. Quincenal

Indica envíos cada 15 días. En esta frecuencia, se considera dos veces al mes: el día 1 y el día 15.

```json
{
  "tipo": "quincenal",
  "hora": "10:00"
}
```

Para verificar si un envío está demorado:
- Si el día del mes es 1 o 15, comprobar si ha pasado la hora de envío.
- Si el día está entre 2-14, verificar si se recibió el envío el día 1.
- Si el día está entre 16-final del mes, verificar si se recibió el envío el día 15.

### 4. Mensual

Permite especificar días específicos del mes para el envío.

```json
{
  "tipo": "mensual",
  "hora": "08:00",
  "dias_mes": ["1", "15", "25"]
}
```

Para verificar si un envío está demorado:
- Comprobar si el día actual está en `dias_mes`.
- Si está, verificar si ha pasado la hora de envío.
- Si no está, verificar si el último día de `dias_mes` anterior al día actual ha recibido envío.

### 5. Fin de Mes

Indica que el envío debe realizarse el último día de cada mes.

```json
{
  "tipo": "fin_de_mes",
  "hora": "16:00"
}
```

Para verificar si un envío está demorado:
- Si es el último día del mes, comprobar si ha pasado la hora de envío.
- Si no es el último día, verificar si se recibió el envío el último día del mes anterior.

### 6. Hasta el Día N del Mes

Indica que los envíos deben completarse antes de un día específico del mes.

```json
{
  "tipo": "hasta_dia_n",
  "hora": "23:59",
  "dia_limite": "5"
}
```

Para verificar si un envío está demorado:
- Si el día actual es mayor que `dia_limite`, verificar si se recibió el envío en el mes actual.
- Si no se recibió y ya pasó el día límite, está demorado.

### 7. Bajo Demanda

Indica que no hay una frecuencia establecida, y los envíos se realizan según se requiera.

```json
{
  "tipo": "bajo_demanda",
  "hora": "00:00"
}
```

En este caso, no se aplica el concepto de "demorado", ya que no hay una programación definida.

## Algoritmo para Determinar Demoras

Para determinar si un envío está demorado, se recomienda el siguiente algoritmo general:

1. Obtener la configuración de frecuencia del emisor.
2. Determinar la última fecha esperada de envío según el tipo de frecuencia.
3. Consultar la última fecha real de envío del emisor.
4. Si la última fecha real es anterior a la última fecha esperada, el envío está demorado.

### Ejemplo de Implementación (Pseudocódigo)

```javascript
function verificarDemora(configuracionFrecuencia, ultimoEnvio) {
  const fechaActual = new Date();
  let fechaEsperada;
  
  switch(configuracionFrecuencia.tipo) {
    case 'diario':
      fechaEsperada = new Date(fechaActual);
      fechaEsperada.setHours(parseInt(configuracionFrecuencia.hora.split(':')[0]));
      fechaEsperada.setMinutes(parseInt(configuracionFrecuencia.hora.split(':')[1]));
      break;
    
    case 'semanal':
      // Lógica para frecuencia semanal...
      break;
    
    // Otros casos...
  }
  
  return ultimoEnvio < fechaEsperada;
}
```

## Consideraciones Adicionales

- Todas las horas se interpretan en la zona horaria configurada en el servidor.
- Si la configuración de frecuencia no existe o está incompleta, se debe asumir que no hay una frecuencia establecida.
- Para meses con menos días que la fecha especificada (por ejemplo, 31 en febrero), se debe considerar el último día del mes como válido.
- Las implementaciones deben manejar correctamente el cambio de mes y de año.

## Almacenamiento en Base de Datos

En la base de datos PostgreSQL, el campo `configuracion_frecuencia` se almacena como un tipo `JSONB`, lo que permite consultas eficientes sobre las propiedades del JSON.

```sql
-- Ejemplo de consulta para encontrar emisores con frecuencia diaria
SELECT * FROM metodos_envio_emisor 
WHERE configuracion_frecuencia->>'tipo' = 'diario';

-- Ejemplo de consulta para encontrar emisores con día límite específico
SELECT * FROM metodos_envio_emisor 
WHERE configuracion_frecuencia->>'tipo' = 'hasta_dia_n'
AND configuracion_frecuencia->>'dia_limite' = '5';
```
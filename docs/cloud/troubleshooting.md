# Solución de Problemas del Sistema de Almacenamiento en la Nube

Este documento proporciona orientación para solucionar problemas comunes que pueden surgir al utilizar el sistema de almacenamiento en la nube de SAGE.

## Problemas Comunes y Soluciones

### 1. Error al Conectar con Proveedor de Nube

**Síntomas:**
- Mensajes de error como "Credenciales inválidas" o "No se puede conectar al proveedor"
- Fallos en la migración de archivos
- Errores en la verificación de conexión

**Posibles Causas y Soluciones:**

#### Credenciales Incorrectas

- **Para S3/MinIO:** 
  - Verificar que el Access Key y Secret Key son correctos
  - Comprobar que la región especificada existe
  - Validar los permisos de la política IAM asociada a las credenciales

- **Para Azure:** 
  - Verificar que la cadena de conexión es válida y completa
  - Comprobar que el contenedor especificado existe
  - Revisar los permisos en el portal de Azure

- **Para GCP:**
  - Comprobar que el archivo JSON de credenciales es válido
  - Verificar que la cuenta de servicio tiene permisos suficientes
  - Asegurar que el bucket especificado existe

- **Para SFTP:**
  - Verificar la conexión al host y puerto (usar `telnet host puerto`)
  - Comprobar credenciales de usuario/contraseña
  - Revisar permisos de escritura en el directorio destino

#### Problemas de Red

- Verificar que no hay firewalls bloqueando la conexión
- Comprobar si se requiere un proxy para acceder a la nube
- Verificar que los endpoints de la nube son accesibles desde el servidor

**Código de Diagnóstico:**

```javascript
// Ejemplo para diagnosticar problemas de conexión con S3
import { getStorageManager } from '@/utils/cloud/storage-manager';

async function diagnosticarConexionS3(provider) {
  console.log("Iniciando diagnóstico de conexión S3...");
  
  try {
    // 1. Verificar estructura de credenciales
    console.log("Verificando estructura de credenciales...");
    const creds = provider.credenciales;
    
    if (!creds.access_key || !creds.secret_key) {
      throw new Error("Credenciales incompletas: Falta access_key o secret_key");
    }
    
    // 2. Verificar configuración
    console.log("Verificando configuración...");
    const config = provider.configuracion;
    
    if (!config.bucket) {
      throw new Error("Configuración incompleta: Falta bucket");
    }
    
    // 3. Probar conexión básica
    console.log("Probando conexión básica...");
    const storageManager = getStorageManager(provider);
    const testResult = await storageManager.testConnection();
    
    if (!testResult.success) {
      throw new Error(`Prueba de conexión fallida: ${testResult.message}`);
    }
    
    // 4. Probar listado de archivos
    console.log("Probando listado de archivos...");
    await storageManager.listContents('');
    
    // 5. Intentar crear archivo de prueba
    console.log("Probando escritura...");
    const testFilePath = `test-${Date.now()}.txt`;
    await storageManager.writeFile(testFilePath, "Test contenido", Buffer.from("Test contenido"));
    
    // 6. Intentar leer archivo de prueba
    console.log("Probando lectura...");
    await storageManager.readFile(testFilePath);
    
    // 7. Eliminar archivo de prueba
    console.log("Limpiando archivo de prueba...");
    await storageManager.deleteFile(testFilePath);
    
    console.log("Diagnóstico completado con éxito.");
    return { success: true, message: "Conexión y operaciones funcionando correctamente" };
  } catch (error) {
    console.error("Error en diagnóstico:", error);
    return { 
      success: false, 
      message: `Diagnóstico fallido: ${error.message}`,
      error: error
    };
  }
}
```

### 2. Problemas al Leer Archivos de la Nube

**Síntomas:**
- Errores "Archivo no encontrado" aunque el archivo exista
- Contenido truncado o vacío
- Errores de permisos

**Posibles Causas y Soluciones:**

#### Rutas Incorrectas

- Verificar que la URI cloud:// está bien formada
- Comprobar que se están usando barras (/) y no barras invertidas (\\)
- Asegurar que la ruta no tiene dobles barras (excepto en `http://`)

#### Problemas de Codificación

- Verificar que los nombres de archivos no contienen caracteres especiales
- Comprobar que se está usando la codificación adecuada al leer el archivo

#### Permisos Insuficientes

- Verificar que el usuario/credencial tiene permisos de lectura
- Comprobar la política de acceso en el proveedor de nube

**Ejemplo de Solución:**

```javascript
import { readFileAsText, isCloudPath, parseCloudUri } from '@/utils/cloud-storage';

async function leerArchivoConRecuperacion(rutaArchivo, intentosMax = 3) {
  let intentos = 0;
  let ultimoError = null;
  
  while (intentos < intentosMax) {
    try {
      // Normalizar la ruta si es necesario
      if (isCloudPath(rutaArchivo)) {
        const parsedUri = parseCloudUri(rutaArchivo);
        if (parsedUri) {
          // Asegurar que no hay dobles barras en la ruta
          const pathNormalizada = parsedUri.path.replace(/\/+/g, '/');
          rutaArchivo = `cloud://${parsedUri.provider}/${pathNormalizada}`;
        }
      }
      
      console.log(`Intento ${intentos + 1}: Leyendo archivo ${rutaArchivo}`);
      const contenido = await readFileAsText(rutaArchivo);
      console.log(`Archivo leído correctamente (${contenido.length} bytes)`);
      return contenido;
    } catch (error) {
      intentos++;
      ultimoError = error;
      console.warn(`Error en intento ${intentos}:`, error.message);
      
      // Esperar antes del siguiente intento (backoff exponencial)
      const tiempoEspera = Math.pow(2, intentos) * 1000;
      await new Promise(resolve => setTimeout(resolve, tiempoEspera));
    }
  }
  
  // Si llegamos aquí, fallaron todos los intentos
  console.error(`Fallaron todos los intentos de leer ${rutaArchivo}:`, ultimoError);
  throw new Error(`No se pudo leer el archivo después de ${intentosMax} intentos: ${ultimoError.message}`);
}
```

### 3. Problemas en la Migración de Archivos

**Síntomas:**
- Janitor Daemon reporta errores de migración
- Archivos migrados parcialmente
- Base de datos actualizada pero archivos no disponibles

**Posibles Causas y Soluciones:**

#### Inconsistencia en la Base de Datos

- Verificar que `ruta_directorio` y `ruta_nube` son coherentes
- Comprobar que `migrado_a_nube` solo es true cuando realmente está migrado
- Validar que el proveedor referenciado (`nube_primaria_id`) existe y está activo

#### Problemas de Permisos

- Verificar permisos de escritura en la nube
- Comprobar permisos de lectura en archivos locales
- Revisar cuotas o límites de almacenamiento

#### Timeouts

- Revisar tamaño de archivos migrados (posibles timeouts)
- Comprobar la estabilidad de la conexión

**Herramienta de Diagnóstico:**

```javascript
// API para verificar el estado de migración de una ejecución
// src/pages/api/admin/verificar-migracion.js
import { getStorageManager } from '@/utils/cloud/storage-manager';
import { pool } from '@/utils/db';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { ejecucion_id } = req.query;
  
  if (!ejecucion_id) {
    return res.status(400).json({ 
      error: 'Se requiere el parámetro ejecucion_id' 
    });
  }
  
  try {
    // 1. Obtener información de la ejecución
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          id, uuid, ruta_directorio, ruta_nube, migrado_a_nube, nube_primaria_id
         FROM ejecuciones_yaml
         WHERE id = $1`,
        [ejecucion_id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ejecución no encontrada' });
      }
      
      const ejecucion = result.rows[0];
      
      // 2. Preparar resultados
      const diagnostico = {
        ejecucion_id: ejecucion.id,
        uuid: ejecucion.uuid,
        migrado_segun_db: ejecucion.migrado_a_nube,
        ruta_local: ejecucion.ruta_directorio,
        ruta_nube: ejecucion.ruta_nube,
        nube_id: ejecucion.nube_primaria_id,
        
        existe_local: false,
        archivos_locales: [],
        
        existe_nube: false,
        archivos_nube: [],
        
        problemas_detectados: []
      };
      
      // 3. Verificar existencia local
      if (ejecucion.ruta_directorio) {
        if (fs.existsSync(ejecucion.ruta_directorio)) {
          diagnostico.existe_local = true;
          
          // Listar archivos locales
          const archivos = fs.readdirSync(ejecucion.ruta_directorio)
            .filter(f => !f.startsWith('.'))
            .map(f => {
              const fullPath = path.join(ejecucion.ruta_directorio, f);
              const stats = fs.statSync(fullPath);
              return {
                nombre: f,
                tamaño: stats.size,
                modificado: stats.mtime
              };
            });
          
          diagnostico.archivos_locales = archivos;
          
          // Detectar problemas
          if (ejecucion.migrado_a_nube && archivos.length > 0) {
            diagnostico.problemas_detectados.push(
              'La ejecución figura como migrada pero aún tiene archivos locales'
            );
          }
        } else if (ejecucion.migrado_a_nube === false) {
          diagnostico.problemas_detectados.push(
            'La ejecución figura como no migrada pero no existe el directorio local'
          );
        }
      }
      
      // 4. Verificar existencia en nube
      if (ejecucion.ruta_nube && ejecucion.nube_primaria_id) {
        // Obtener información del proveedor
        const providerResult = await client.query(
          `SELECT id, nombre, tipo, credenciales, configuracion 
           FROM cloud_providers 
           WHERE id = $1`,
          [ejecucion.nube_primaria_id]
        );
        
        if (providerResult.rows.length === 0) {
          diagnostico.problemas_detectados.push(
            `El proveedor de nube con ID ${ejecucion.nube_primaria_id} no existe`
          );
        } else {
          const provider = providerResult.rows[0];
          
          // Parsear credenciales y configuración
          provider.credenciales = typeof provider.credenciales === 'string' 
            ? JSON.parse(provider.credenciales) 
            : provider.credenciales;
            
          provider.configuracion = typeof provider.configuracion === 'string' 
            ? JSON.parse(provider.configuracion) 
            : provider.configuracion;
          
          try {
            // Crear gestor de almacenamiento
            const storageManager = getStorageManager(provider);
            
            // Extraer ruta dentro del proveedor
            const rutaNube = ejecucion.ruta_nube;
            const parsedUri = parseCloudUri(rutaNube);
            
            if (!parsedUri) {
              diagnostico.problemas_detectados.push(
                `URI de nube inválida: ${rutaNube}`
              );
            } else {
              // Verificar existencia listando contenidos
              const contents = await storageManager.listContents(parsedUri.path);
              
              diagnostico.existe_nube = true;
              diagnostico.archivos_nube = [
                ...contents.folders.map(f => ({ 
                  nombre: f.name, 
                  tipo: 'directorio'
                })),
                ...contents.files.map(f => ({ 
                  nombre: f.name, 
                  tamaño: f.size, 
                  modificado: f.modified,
                  tipo: 'archivo'
                }))
              ];
              
              // Detectar problemas
              if (ejecucion.migrado_a_nube && diagnostico.archivos_nube.length === 0) {
                diagnostico.problemas_detectados.push(
                  'La ejecución figura como migrada pero no hay archivos en la nube'
                );
              }
              
              if (!ejecucion.migrado_a_nube && diagnostico.archivos_nube.length > 0) {
                diagnostico.problemas_detectados.push(
                  'La ejecución figura como no migrada pero hay archivos en la nube'
                );
              }
            }
          } catch (error) {
            diagnostico.problemas_detectados.push(
              `Error verificando archivos en la nube: ${error.message}`
            );
          }
        }
      } else if (ejecucion.migrado_a_nube) {
        diagnostico.problemas_detectados.push(
          'La ejecución figura como migrada pero no tiene ruta de nube o proveedor asignado'
        );
      }
      
      // 5. Devolver diagnóstico
      return res.status(200).json(diagnostico);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Error verificando migración para ejecución ${ejecucion_id}:`, error);
    return res.status(500).json({ 
      error: `Error en verificación: ${error.message}` 
    });
  }
}
```

### 4. Problemas con el Formato de URIs

**Síntomas:**
- Errores "URI inválida" o "Proveedor no encontrado"
- Archivos no encontrados a pesar de usar rutas aparentemente correctas

**Solución:**

Asegúrese de que las URIs cloud:// sigan el formato correcto:

```
cloud://{tipo_proveedor}/{ruta/al/recurso}
```

Donde:
- `{tipo_proveedor}` debe ser uno de: s3, azure, gcp, sftp, minio
- `{ruta/al/recurso}` no debe comenzar con barra

**Ejemplos Correctos:**
- `cloud://s3/ejecuciones/abc123/log.txt`
- `cloud://azure/contenedor/carpeta/archivo.json`

**Ejemplos Incorrectos:**
- `cloud://s3//ejecuciones/abc123/log.txt` (doble barra)
- `cloud://amazon/carpeta/archivo.json` (tipo incorrecto)
- `cloud:///azure/contenedor/archivo.txt` (formato incorrecto)

**Función de Validación:**

```javascript
/**
 * Valida y normaliza una URI de nube
 * @param {string} uri - URI para validar
 * @returns {string|null} - URI normalizada o null si es inválida
 */
function validarUriNube(uri) {
  if (!uri || typeof uri !== 'string') {
    console.error('URI nula o no es string');
    return null;
  }
  
  // Verificar formato general
  if (!uri.startsWith('cloud://')) {
    console.error('URI no comienza con cloud://');
    return null;
  }
  
  // Extraer partes
  const parts = uri.substring(8).split('/');
  
  // Necesitamos al menos un proveedor
  if (parts.length < 1 || !parts[0]) {
    console.error('URI no tiene proveedor especificado');
    return null;
  }
  
  const provider = parts[0].toLowerCase();
  
  // Verificar tipo de proveedor
  const validProviders = ['s3', 'azure', 'gcp', 'sftp', 'minio'];
  if (!validProviders.includes(provider)) {
    console.error(`Tipo de proveedor '${provider}' no válido. Debe ser uno de: ${validProviders.join(', ')}`);
    return null;
  }
  
  // Construir ruta normalizada (eliminar barras duplicadas)
  const pathParts = parts.slice(1).filter(p => p !== '');
  if (pathParts.length === 0) {
    return `cloud://${provider}/`;
  }
  
  return `cloud://${provider}/${pathParts.join('/')}`;
}
```

## Herramientas de Diagnóstico

### Herramienta de Verificación de Migración

Utilidad para verificar el estado de migración de todas las ejecuciones:

```javascript
async function verificarEstadoMigraciones() {
  const client = await pool.connect();
  try {
    // Buscar inconsistencias
    const query = `
      SELECT 
        id, 
        uuid, 
        ruta_directorio, 
        ruta_nube, 
        migrado_a_nube, 
        nube_primaria_id
      FROM ejecuciones_yaml
      WHERE 
        (migrado_a_nube = true AND (ruta_nube IS NULL OR nube_primaria_id IS NULL))
        OR
        (migrado_a_nube = false AND ruta_nube IS NOT NULL)
    `;
    
    const result = await client.query(query);
    
    if (result.rows.length === 0) {
      console.log('No se encontraron inconsistencias en la migración a la nube.');
      return [];
    }
    
    console.log(`Se encontraron ${result.rows.length} ejecuciones con posibles problemas de migración:`);
    
    const problematicos = result.rows.map(row => {
      let problema = '';
      
      if (row.migrado_a_nube && !row.ruta_nube) {
        problema = 'Marcada como migrada pero sin ruta en la nube';
      } else if (row.migrado_a_nube && !row.nube_primaria_id) {
        problema = 'Marcada como migrada pero sin proveedor de nube';
      } else if (!row.migrado_a_nube && row.ruta_nube) {
        problema = 'Marcada como no migrada pero tiene ruta en la nube';
      }
      
      return {
        id: row.id,
        uuid: row.uuid,
        problema,
        detalles: row
      };
    });
    
    // Imprimir resumen
    problematicos.forEach(p => {
      console.log(`- ID ${p.id} (${p.uuid}): ${p.problema}`);
    });
    
    return problematicos;
  } finally {
    client.release();
  }
}
```

### Herramienta de Prueba de Adaptadores

```javascript
async function probarTodosLosAdaptadores() {
  const adaptadores = ['s3', 'azure', 'gcp', 'sftp', 'minio'];
  const resultados = {};
  
  for (const tipo of adaptadores) {
    try {
      console.log(`\n--- Probando adaptador para ${tipo} ---`);
      
      // Obtener adaptador
      let adapter;
      if (tipo === 'minio') {
        adapter = getAdapter('s3');
      } else {
        adapter = getAdapter(tipo);
      }
      
      if (!adapter) {
        console.error(`No se pudo obtener adaptador para ${tipo}`);
        resultados[tipo] = { cargado: false, error: 'Adaptador no encontrado' };
        continue;
      }
      
      // Verificar métodos requeridos
      const metodos = [
        'createClient', 
        'testConnection', 
        'uploadFile', 
        'downloadFile', 
        'listFiles', 
        'listContents'
      ];
      
      const metodosDisponibles = metodos.filter(m => typeof adapter[m] === 'function');
      const metodosAusentes = metodos.filter(m => typeof adapter[m] !== 'function');
      
      console.log(`Métodos disponibles (${metodosDisponibles.length}/${metodos.length}): ${metodosDisponibles.join(', ')}`);
      
      if (metodosAusentes.length > 0) {
        console.warn(`Métodos ausentes: ${metodosAusentes.join(', ')}`);
      }
      
      resultados[tipo] = { 
        cargado: true, 
        metodosDisponibles, 
        metodosAusentes
      };
    } catch (error) {
      console.error(`Error probando adaptador ${tipo}:`, error);
      resultados[tipo] = { cargado: false, error: error.message };
    }
  }
  
  console.log('\n--- Resumen de Adaptadores ---');
  for (const [tipo, resultado] of Object.entries(resultados)) {
    const status = resultado.cargado ? 'OK' : 'ERROR';
    console.log(`${tipo}: ${status}`);
  }
  
  return resultados;
}
```

## Verificación de Integridad

Para verificar la integridad general del sistema de almacenamiento en la nube, se puede ejecutar el siguiente conjunto de verificaciones:

```javascript
async function verificarIntegridadSistemaAlmacenamiento() {
  const informe = {
    tiempoInicio: new Date(),
    verificaciones: {}
  };
  
  try {
    // 1. Verificar adaptadores
    informe.verificaciones.adaptadores = await probarTodosLosAdaptadores();
    
    // 2. Verificar proveedores en base de datos
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT tipo, COUNT(*) as total, SUM(CASE WHEN activo THEN 1 ELSE 0 END) as activos 
        FROM cloud_providers 
        GROUP BY tipo
      `);
      
      informe.verificaciones.proveedores = {
        resumen: result.rows,
        detalles: {}
      };
      
      // Verificar que hay al menos un proveedor activo para cada tipo
      const tiposSinProveedorActivo = ['s3', 'azure', 'gcp', 'sftp', 'minio']
        .filter(tipo => {
          const row = result.rows.find(r => r.tipo === tipo);
          return !row || row.activos === 0;
        });
      
      if (tiposSinProveedorActivo.length > 0) {
        informe.verificaciones.proveedores.advertencias = [
          `Sin proveedores activos para: ${tiposSinProveedorActivo.join(', ')}`
        ];
      }
      
      // Verificar predeterminados
      const predeterminadosQuery = await client.query(`
        SELECT tipo, COUNT(*) as total
        FROM cloud_providers 
        WHERE predeterminado = true
        GROUP BY tipo
      `);
      
      const tiposConMultiplesPredeterminados = predeterminadosQuery.rows
        .filter(r => r.total > 1)
        .map(r => r.tipo);
      
      if (tiposConMultiplesPredeterminados.length > 0) {
        informe.verificaciones.proveedores.errores = [
          `Múltiples proveedores predeterminados para: ${tiposConMultiplesPredeterminados.join(', ')}`
        ];
      }
    } finally {
      client.release();
    }
    
    // 3. Verificar estado migraciones
    informe.verificaciones.migraciones = {
      problematicas: await verificarEstadoMigraciones()
    };
    
    // 4. Verificar rutas nube
    const clientRutas = await pool.connect();
    try {
      const rutasResult = await clientRutas.query(`
        SELECT ruta_nube, COUNT(*) as total
        FROM ejecuciones_yaml
        WHERE migrado_a_nube = true AND ruta_nube IS NOT NULL
        GROUP BY ruta_nube
      `);
      
      informe.verificaciones.rutas = {
        total: rutasResult.rows.reduce((sum, row) => sum + parseInt(row.total), 0),
        problematicas: []
      };
      
      // Verificar formato de URIs
      for (const row of rutasResult.rows) {
        const uri = row.ruta_nube;
        const uriNormalizada = validarUriNube(uri);
        
        if (!uriNormalizada) {
          informe.verificaciones.rutas.problematicas.push({
            uri,
            total: parseInt(row.total),
            problema: 'URI inválida'
          });
        } else if (uri !== uriNormalizada) {
          informe.verificaciones.rutas.problematicas.push({
            uri,
            uriNormalizada,
            total: parseInt(row.total),
            problema: 'URI no normalizada'
          });
        }
      }
    } finally {
      clientRutas.release();
    }
    
    // Finalizar informe
    informe.tiempoFin = new Date();
    informe.duracion = (informe.tiempoFin - informe.tiempoInicio) / 1000;
    informe.exito = true;
    
    return informe;
  } catch (error) {
    console.error('Error en verificación de integridad:', error);
    informe.tiempoFin = new Date();
    informe.duracion = (informe.tiempoFin - informe.tiempoInicio) / 1000;
    informe.exito = false;
    informe.error = error.message;
    
    return informe;
  }
}
```

## Información para Soporte Técnico

Al reportar un problema con el sistema de almacenamiento en la nube, proporcione la siguiente información:

1. **ID de Ejecución**: Si el problema está relacionado con una ejecución específica
2. **URI Cloud**: La ruta completa si el problema es con un archivo específico
3. **Proveedor de Nube**: Tipo y nombre del proveedor afectado
4. **Mensajes de Error**: Texto completo del error
5. **Acciones Realizadas**: Pasos que llevaron al error
6. **Logs Relevantes**: Extractos del log de aplicación o Janitor Daemon

## Preguntas Frecuentes

### ¿Por qué mi ejecución no se migra automáticamente?

Las ejecuciones se migran cuando:
1. Son más antiguas que el umbral configurado (por defecto 5 horas)
2. Tienen un directorio local válido
3. Hay al menos un proveedor de nube activo configurado

Asegúrese de que su ejecución cumple estos criterios.

### ¿Puedo seguir accediendo a archivos después de migrados?

Sí, el sistema proporciona acceso transparente a archivos independientemente de su ubicación. Cuando se solicita un archivo migrado, el sistema:

1. Detecta que la ruta es una URI cloud://
2. Localiza el proveedor apropiado
3. Descarga el archivo temporalmente si es necesario
4. Sirve el contenido

El usuario no necesita saber dónde está almacenado realmente el archivo.

### ¿Cómo puedo migrar manualmente una ejecución?

Puede usar la API de migración o una herramienta administrativa. También puede actualizar directamente la base de datos, pero esto debe ser un último recurso.
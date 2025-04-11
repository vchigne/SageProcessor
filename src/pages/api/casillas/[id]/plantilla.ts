import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import * as xlsx from 'xlsx';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(child_process.exec);

// Conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Sólo permitir solicitudes GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id } = req.query;
  
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'ID de casilla no válido' });
  }

  try {
    // Obtener información de la casilla
    const casillaQuery = await pool.query(
      `SELECT c.*, c.nombre_yaml
       FROM casillas c
       WHERE c.id = $1`,
      [id]
    );

    if (casillaQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Casilla no encontrada' });
    }

    const casilla = casillaQuery.rows[0];
    
    // Obtener el contenido YAML de la tabla casillas
    const yamlQuery = await pool.query(
      `SELECT yaml_contenido 
       FROM casillas 
       WHERE id = $1`,
      [id]
    );
    
    console.log('Buscando YAML para casilla:', casilla.id, 'nombre_yaml:', casilla.nombre_yaml);
    
    if (yamlQuery.rows.length === 0 || !yamlQuery.rows[0].yaml_contenido) {
      return res.status(400).json({ error: 'No se ha definido una estructura en el archivo YAML para esta casilla' });
    }
    
    const yamlContenido = yamlQuery.rows[0].yaml_contenido;
    
    // Si no hay contenido YAML, no podemos generar una plantilla
    if (!yamlContenido) {
      return res.status(400).json({ error: 'No se ha definido una estructura en el archivo YAML para esta casilla' });
    }

    try {
      // Crear un directorio temporal para nuestros archivos
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plantilla-'));
      console.log(`Directorio temporal creado: ${tempDir}`);
      
      // Analizar el contenido YAML
      const yamlContent = yaml.parse(yamlContenido);
      
      // Crear el archivo de instrucciones detalladas
      let instrucciones = `INSTRUCCIONES PARA LA CASILLA: ${casilla.nombre_yaml || casilla.nombre || `Casilla ID: ${casilla.id}`}\n\n`;
      instrucciones += `Este documento contiene instrucciones para completar correctamente el archivo de datos\n`;
      instrucciones += `requerido por el sistema SAGE. Lea atentamente toda la información antes de completar la plantilla.\n\n`;
      instrucciones += `=== INFORMACIÓN GENERAL ===\n\n`;
      
      if (yamlContent.sage_yaml) {
        instrucciones += `Nombre: ${yamlContent.sage_yaml.name || 'No especificado'}\n`;
        instrucciones += `Descripción: ${yamlContent.sage_yaml.description || 'No especificada'}\n`;
        instrucciones += `Versión: ${yamlContent.sage_yaml.version || 'No especificada'}\n`;
        instrucciones += `Autor: ${yamlContent.sage_yaml.author || 'No especificado'}\n`;
        
        if (yamlContent.sage_yaml.comments) {
          instrucciones += `Notas adicionales: ${yamlContent.sage_yaml.comments}\n`;
        }
        
        instrucciones += `\nImportante: El archivo que se adjunta a estas instrucciones contiene la estructura\n`;
        instrucciones += `requerida con datos de ejemplo. NO modifique la estructura, solo reemplace los\n`;
        instrucciones += `datos de ejemplo con información real.\n\n`;
      }
      
      // Determinar si es un paquete (ZIP con múltiples catálogos)
      const esMultiCatalogo = !!(yamlContent.packages && Object.keys(yamlContent.packages).length > 0);
      
      if (esMultiCatalogo) {
        instrucciones += `=== ESTRUCTURA DEL PAQUETE ===\n\n`;
        instrucciones += `Este archivo YAML define un paquete que contiene múltiples catálogos.\n`;
        
        // Obtener información del primer paquete
        const primerNombrePaquete = Object.keys(yamlContent.packages)[0];
        const primerPaquete = yamlContent.packages[primerNombrePaquete];
        
        // Determinar formato del paquete
        let formatoPaquete = 'EXCEL';
        if (primerPaquete.file_format && primerPaquete.file_format.type) {
          formatoPaquete = primerPaquete.file_format.type.toUpperCase();
        }
        
        instrucciones += `Formato del paquete: ${formatoPaquete}\n\n`;
        
        // Agregar información sobre los catálogos incluidos
        Object.entries(yamlContent.packages).forEach(([nombrePaquete, paquete]: [string, any]) => {
          instrucciones += `Paquete: ${nombrePaquete}\n`;
          instrucciones += `Nombre: ${paquete.name || nombrePaquete}\n`;
          instrucciones += `Descripción: ${paquete.description || 'No especificada'}\n`;
          
          if (paquete.catalogs && Array.isArray(paquete.catalogs)) {
            instrucciones += `Catálogos incluidos:\n`;
            paquete.catalogs.forEach((catalogo: string) => {
              instrucciones += `  - ${catalogo}\n`;
            });
          }
          
          instrucciones += `\n`;
        });
      }
      
      // Agregar información sobre catálogos
      if (yamlContent.catalogs && Object.keys(yamlContent.catalogs).length > 0) {
        instrucciones += `=== CATÁLOGOS ===\n\n`;
        
        Object.entries(yamlContent.catalogs).forEach(([nombreCatalogo, catalogo]: [string, any]) => {
          instrucciones += `Catálogo: ${nombreCatalogo}\n`;
          instrucciones += `Nombre: ${catalogo.name || nombreCatalogo}\n`;
          instrucciones += `Descripción: ${catalogo.description || 'No especificada'}\n`;
          
          // Agregar información sobre el formato del archivo
          if (catalogo.file_format) {
            const formatoCatalogo = catalogo.file_format.type ? catalogo.file_format.type.toUpperCase() : 'EXCEL';
            instrucciones += `Formato: ${formatoCatalogo}\n`;
            
            if (formatoCatalogo === 'CSV' && catalogo.file_format.delimiter) {
              instrucciones += `Delimitador: ${catalogo.file_format.delimiter}\n`;
            }
            
            if (catalogo.file_format.header !== undefined) {
              instrucciones += `Incluye encabezado: ${catalogo.file_format.header ? 'Sí' : 'No'}\n`;
            }
          }
          
          // Detallar campos
          instrucciones += `\nCampos del catálogo ${nombreCatalogo}:\n`;
          instrucciones += `----------------------------------\n`;
          
          if (catalogo.fields && Array.isArray(catalogo.fields)) {
            // Primero, construir una lista de campos obligatorios para destacarlos
            const camposObligatorios = catalogo.fields
              .filter((campo: any) => campo.name && campo.required)
              .map((campo: any) => campo.name);
            
            if (camposObligatorios.length > 0) {
              instrucciones += `\nCAMPOS OBLIGATORIOS (deben incluirse siempre):\n`;
              camposObligatorios.forEach((nombreCampo: string) => {
                instrucciones += `  * ${nombreCampo}\n`;
              });
              instrucciones += `\n`;
            }
            
            // Luego, detallar todos los campos con sus características
            instrucciones += `\nDETALLE DE CADA CAMPO:\n`;
            
            catalogo.fields.forEach((campo: any) => {
              if (!campo.name) return;
              
              instrucciones += `\n  - ${campo.name}${campo.required ? ' (OBLIGATORIO)' : ''}:\n`;
              instrucciones += `    Tipo de dato: ${campo.type || 'texto'}\n`;
              
              if (campo.description) {
                instrucciones += `    Descripción: ${campo.description}\n`;
              }
              
              if (campo.unique) {
                instrucciones += `    Valores únicos: Sí (no se permiten valores duplicados)\n`;
              }
              
              if (campo.example) {
                instrucciones += `    Ejemplo válido: ${campo.example}\n`;
              }
              
              // Agregar información sobre validaciones del campo
              if (campo.validation_rules && Array.isArray(campo.validation_rules) && campo.validation_rules.length > 0) {
                instrucciones += `    Reglas de validación:\n`;
                
                campo.validation_rules.forEach((regla: any) => {
                  const severidad = regla.severity ? 
                    (regla.severity.toLowerCase() === 'error' ? 'ERROR (bloquea el procesamiento)' : 
                     regla.severity.toLowerCase() === 'warning' ? 'ADVERTENCIA (permite continuar)' : 
                     regla.severity) : 'No especificada';
                  
                  instrucciones += `      * ${regla.name}: ${regla.description || 'No hay descripción'}\n`;
                  instrucciones += `        Severidad: ${severidad}\n`;
                });
              }
            });
            
            // Agregar información sobre validaciones del catálogo completo
            if (catalogo.catalog_validation && Array.isArray(catalogo.catalog_validation) && catalogo.catalog_validation.length > 0) {
              instrucciones += `\nVALIDACIONES A NIVEL DEL CATÁLOGO COMPLETO:\n`;
              instrucciones += `Estas validaciones se aplican al archivo completo y no a campos individuales.\n`;
              
              catalogo.catalog_validation.forEach((validacion: any) => {
                const severidad = validacion.severity ? 
                  (validacion.severity.toLowerCase() === 'error' ? 'ERROR (bloquea el procesamiento)' : 
                   validacion.severity.toLowerCase() === 'warning' ? 'ADVERTENCIA (permite continuar)' : 
                   validacion.severity) : 'No especificada';
                
                instrucciones += `  * ${validacion.name}: ${validacion.description || 'No hay descripción'}\n`;
                instrucciones += `    Severidad: ${severidad}\n`;
              });
            }
            
          } else {
            instrucciones += `  No se han definido campos específicos para este catálogo.\n`;
            instrucciones += `  Por favor, consulte la documentación adicional o contacte al administrador del sistema.\n`;
          }
          
          instrucciones += `\n`;
        });
      }
      
      // Guardar el archivo de instrucciones
      const instruccionesFilePath = path.join(tempDir, 'instrucciones.txt');
      fs.writeFileSync(instruccionesFilePath, instrucciones);
      
      // Crear un directorio para el paquete interno (si es necesario)
      const paqueteDir = path.join(tempDir, 'paquete');
      fs.mkdirSync(paqueteDir);
      
      // Determinar nombre para el paquete interno
      let nombrePaqueteInterno = 'catalogo.zip';
      if (esMultiCatalogo) {
        const primerNombrePaquete = Object.keys(yamlContent.packages)[0];
        const primerPaquete = yamlContent.packages[primerNombrePaquete];
        if (primerPaquete.filename) {
          nombrePaqueteInterno = primerPaquete.filename;
        }
      }
      
      // Generar plantillas Excel para cada catálogo
      if (yamlContent.catalogs && Object.keys(yamlContent.catalogs).length > 0) {
        // Para cada catálogo, crear un archivo Excel
        Object.entries(yamlContent.catalogs).forEach(([nombreCatalogo, catalogo]: [string, any]) => {
          const wb = xlsx.utils.book_new();
          const campos: string[] = [];
          const ejemplos: string[] = [];
          
          // Procesar campos si existen
          if (catalogo.fields && Array.isArray(catalogo.fields)) {
            catalogo.fields.forEach((campo: any) => {
              if (campo.name) {
                campos.push(campo.name);
                
                // Generar valor de ejemplo según el tipo y nombre del campo
                let valorEjemplo = campo.example || '';
                if (!valorEjemplo) {
                  // Obtener el nombre del campo en minúsculas para hacer coincidencias más fáciles
                  const nombreCampoLower = campo.name.toLowerCase();
                  
                  // Definir el tipo de datos base
                  const tipoDato = campo.type?.toLowerCase() || 'text';
                  
                  // Generar un valor de ejemplo significativo basado tanto en el nombre como en el tipo
                  if (nombreCampoLower.includes('codigo') || nombreCampoLower.includes('code')) {
                    valorEjemplo = tipoDato.includes('int') ? '10045' : 'COD-10045';
                  }
                  else if (nombreCampoLower.includes('nombre') || nombreCampoLower.includes('name')) {
                    valorEjemplo = 'Nombre Ejemplo';
                  }
                  else if (nombreCampoLower.includes('descripcion') || nombreCampoLower.includes('description')) {
                    valorEjemplo = 'Descripción detallada del elemento';
                  }
                  else if (nombreCampoLower.includes('precio') || nombreCampoLower.includes('price') || nombreCampoLower.includes('monto') || nombreCampoLower.includes('amount')) {
                    valorEjemplo = tipoDato.includes('int') ? '1500' : '1500.75';
                  }
                  else if (nombreCampoLower.includes('fecha') || nombreCampoLower.includes('date')) {
                    valorEjemplo = '2025-03-30';
                  }
                  else if (nombreCampoLower.includes('correo') || nombreCampoLower.includes('email')) {
                    valorEjemplo = 'ejemplo@dominio.com';
                  }
                  else if (nombreCampoLower.includes('telefono') || nombreCampoLower.includes('phone')) {
                    valorEjemplo = '+51 999888777';
                  }
                  else if (nombreCampoLower.includes('direccion') || nombreCampoLower.includes('address')) {
                    valorEjemplo = 'Av. Ejemplo 123, Ciudad';
                  }
                  else if (nombreCampoLower.includes('ciudad') || nombreCampoLower.includes('city')) {
                    valorEjemplo = 'Lima';
                  }
                  else if (nombreCampoLower.includes('pais') || nombreCampoLower.includes('country')) {
                    valorEjemplo = 'Perú';
                  }
                  else if (nombreCampoLower.includes('ruc') || nombreCampoLower.includes('dni') || nombreCampoLower.includes('documento')) {
                    valorEjemplo = '10456789012';
                  }
                  else if (nombreCampoLower.includes('cantidad') || nombreCampoLower.includes('quantity')) {
                    valorEjemplo = '25';
                  }
                  else if (nombreCampoLower.includes('porcentaje') || nombreCampoLower.includes('percent')) {
                    valorEjemplo = '18.5';
                  }
                  else if (nombreCampoLower.includes('activo') || nombreCampoLower.includes('active') || nombreCampoLower.includes('enabled')) {
                    valorEjemplo = 'true';
                  }
                  else {
                    // Si no hay coincidencia específica, usar valores genéricos según el tipo
                    switch (tipoDato) {
                      case 'texto':
                      case 'string':
                      case 'text':
                        valorEjemplo = `Ejemplo ${campo.name}`;
                        break;
                      case 'entero':
                      case 'integer':
                      case 'int':
                        valorEjemplo = '123';
                        break;
                      case 'decimal':
                      case 'float':
                      case 'double':
                        valorEjemplo = '123.45';
                        break;
                      case 'fecha':
                      case 'date':
                        valorEjemplo = '2025-03-30';
                        break;
                      case 'boolean':
                      case 'booleano':
                        valorEjemplo = 'true';
                        break;
                      default:
                        valorEjemplo = `Ejemplo de ${campo.name}`;
                    }
                  }
                }
                ejemplos.push(valorEjemplo);
              }
            });
          }
          
          // Si no hay campos, usar algunos genéricos
          if (campos.length === 0) {
            campos.push('Campo1', 'Campo2', 'Campo3');
            ejemplos.push('Valor1', 'Valor2', 'Valor3');
          }
          
          // Crear hoja con los datos
          const wsData = [campos, ejemplos];
          const ws = xlsx.utils.aoa_to_sheet(wsData);
          
          // Agregar la hoja al libro
          xlsx.utils.book_append_sheet(wb, ws, nombreCatalogo);
          
          // Determinar nombre y formato del archivo
          let formatoArchivo = 'xlsx';
          let nombreArchivo = `${nombreCatalogo}.${formatoArchivo}`;
          
          if (catalogo.file_format && catalogo.file_format.type) {
            if (catalogo.file_format.type.toLowerCase() === 'csv') {
              formatoArchivo = 'csv';
            }
          }
          
          // Si se especificó un nombre de archivo, usarlo
          if (catalogo.filename) {
            nombreArchivo = catalogo.filename;
          }
          
          // Guardar el archivo en el directorio del paquete
          if (formatoArchivo === 'csv') {
            // Generar CSV
            let csvContenido = '';
            csvContenido += campos.join(',') + '\n';
            csvContenido += ejemplos.join(',') + '\n';
            
            fs.writeFileSync(path.join(paqueteDir, nombreArchivo), csvContenido);
          } else {
            // Guardar Excel
            xlsx.writeFile(wb, path.join(paqueteDir, nombreArchivo));
          }
        });
      } else {
        // Crear una plantilla genérica
        const wb = xlsx.utils.book_new();
        const wsData = [
          ['Campo1', 'Campo2', 'Campo3'],
          ['Valor1', 'Valor2', 'Valor3']
        ];
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        xlsx.utils.book_append_sheet(wb, ws, 'Plantilla');
        
        // Guardar Excel en el directorio del paquete
        xlsx.writeFile(wb, path.join(paqueteDir, 'plantilla.xlsx'));
      }
      
      // Crear el paquete ZIP interno
      const paqueteInternoPath = path.join(tempDir, nombrePaqueteInterno);
      await execPromise(`cd ${paqueteDir} && zip -r ${paqueteInternoPath} ./*`);
      
      console.log(`Paquete interno creado: ${paqueteInternoPath}`);
      
      // Crear el ZIP final que contiene las instrucciones y el paquete interno
      const zipFilePath = path.join(tempDir, `plantilla_${casilla.id}.zip`);
      await execPromise(`cd ${tempDir} && zip -j ${zipFilePath} ${instruccionesFilePath} ${paqueteInternoPath}`);
      
      console.log(`Archivo ZIP final creado: ${zipFilePath}`);
      
      // Verificar que el archivo ZIP existe
      if (!fs.existsSync(zipFilePath)) {
        throw new Error('No se pudo crear el archivo ZIP');
      }
      
      // Leer el archivo ZIP
      const zipBuffer = fs.readFileSync(zipFilePath);
      
      // Configurar las cabeceras para la descarga
      res.setHeader('Content-Type', 'application/zip');
      
      // Asegurar que el nombre del archivo tenga la extensión .zip
      const nombreArchivo = `plantilla_${casilla.nombre_yaml?.replace(/[^a-zA-Z0-9]/g, '_') || `casilla_${casilla.id}`}`;
      const nombreArchivoConExtension = nombreArchivo.endsWith('.zip') ? nombreArchivo : `${nombreArchivo}.zip`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivoConExtension}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      
      // Enviar el archivo ZIP como respuesta
      res.status(200).end(zipBuffer);
      
      // Limpiar el directorio temporal después de enviar la respuesta
      setTimeout(() => {
        try {
          // Función recursiva para eliminar directorios y sus contenidos
          const eliminarDirectorio = (dirPath: string) => {
            if (fs.existsSync(dirPath)) {
              fs.readdirSync(dirPath).forEach((file) => {
                const curPath = path.join(dirPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                  // Si es un directorio, llamada recursiva
                  eliminarDirectorio(curPath);
                } else {
                  // Si es un archivo, eliminarlo
                  fs.unlinkSync(curPath);
                }
              });
              // Eliminar el directorio vacío
              fs.rmdirSync(dirPath);
            }
          };
          
          // Eliminar todo el directorio temporal y su contenido
          eliminarDirectorio(tempDir);
          console.log(`Directorio temporal ${tempDir} eliminado correctamente`);
        } catch (cleanupError) {
          console.error('Error al limpiar directorio temporal:', cleanupError);
        }
      }, 2000);
      
    } catch (processingError) {
      console.error('Error al procesar y generar plantilla:', processingError);
      return res.status(500).json({ error: 'Error al generar la plantilla' });
    }
  } catch (error) {
    console.error('Error al generar plantilla:', error);
    return res.status(500).json({ error: 'Error interno del servidor al generar la plantilla' });
  }
}
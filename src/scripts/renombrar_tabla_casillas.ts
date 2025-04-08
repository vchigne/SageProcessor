import { promises as fs } from 'fs';
import path from 'path';

/**
 * Script para renombrar todas las referencias a la tabla 'casillas_recepcion' por 'casillas'
 */
async function renombrarReferencias() {
  // Lista de archivos donde realizar el reemplazo
  const archivos = [
    './src/pages/api/casillas/[id]/nombre-humano.ts',
    './src/pages/api/casillas/[id]/plantilla.ts',
    './src/pages/api/casillas/index.ts',
    './src/pages/api/casillas-recepcion/get-link.js',
    './src/pages/api/casillas-recepcion/[id].js',
    './src/pages/api/casillas-recepcion/index.js',
    './src/pages/api/casillas-recepcion/toggle-active.js',
    './src/pages/api/dashboard/details.ts',
    './src/pages/api/dashboard/estadisticas-entidades.ts',
    './src/pages/api/dashboard/instalaciones-casillas.ts',
    './src/pages/api/dashboard/stats.ts',
    './src/pages/api/dashboard/ultimas-ejecuciones.ts',
    './src/pages/api/data-boxes/[id]/nombre-humano.ts',
    './src/pages/api/data-boxes/[id].ts',
    './src/pages/api/data-boxes/[id]/update.ts',
    './src/pages/api/data-boxes/[id]/yaml.ts',
    './src/pages/api/data-boxes.ts',
    './src/pages/api/email/casillas/sin-configurar.ts',
    './src/pages/api/email/configuraciones/[id].ts',
    './src/pages/api/email/configuraciones/index.ts',
    './src/pages/api/email/configuraciones/stats.ts',
    './src/pages/api/frecuencias/index.js',
    './src/pages/api/metodos-envio/index.js',
    './src/pages/api/obsoleto/responsables_index.js',
    './src/pages/api/portales/historial-ejecuciones.ts',
    './src/pages/api/portales/historial-envios.ts',
    './src/pages/api/portales/info-casilla.ts',
    './src/pages/api/portales/[uuid]/casillas.js',
    './src/pages/api/portales/[uuid]/casillas-vencimiento.ts',
    './src/pages/api/process-files.ts',
    './src/pages/api/suscripciones/index.ts',
    './src/scripts/migrar-metadatos-yaml.ts',
    './sage_daemon/daemon.py',
    './sage/email_manager.py'
  ];

  // Contadores para estadísticas
  let archivosActualizados = 0;
  let reemplazosRealizados = 0;
  
  // Procesar cada archivo
  for (const ruta of archivos) {
    try {
      if (!await fileExists(ruta)) {
        console.log(`⚠️ Archivo no encontrado: ${ruta}`);
        continue;
      }

      // Leer el contenido del archivo
      let contenido = await fs.readFile(ruta, 'utf8');
      
      // Contar ocurrencias antes del reemplazo
      const ocurrencias = (contenido.match(/casillas_recepcion/g) || []).length;
      
      if (ocurrencias === 0) {
        console.log(`ℹ️ No hay ocurrencias en: ${ruta}`);
        continue;
      }
      
      // Realizar el reemplazo
      const nuevoContenido = contenido.replace(/casillas_recepcion/g, 'casillas');
      
      // Si hubo cambios, escribir el archivo
      if (nuevoContenido !== contenido) {
        await fs.writeFile(ruta, nuevoContenido, 'utf8');
        console.log(`✅ Actualizado ${ruta}: ${ocurrencias} reemplazos`);
        archivosActualizados++;
        reemplazosRealizados += ocurrencias;
      }
    } catch (error) {
      console.error(`❌ Error procesando ${ruta}:`, error);
    }
  }
  
  // Mostrar resumen
  console.log('\n--- Resumen ---');
  console.log(`Total archivos revisados: ${archivos.length}`);
  console.log(`Archivos actualizados: ${archivosActualizados}`);
  console.log(`Reemplazos realizados: ${reemplazosRealizados}`);
}

/**
 * Verifica si un archivo existe
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Ejecutar el script
renombrarReferencias().catch(console.error);
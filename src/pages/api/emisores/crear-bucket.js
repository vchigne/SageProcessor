/**
 * API para crear un nuevo bucket usando un secreto de nube
 * 
 * POST: Crea un nuevo bucket utilizando las credenciales del secreto
 */

import { pool } from '../../../utils/db';
import { getCloudAdapter } from '../../../utils/cloud';

export default async function handler(req, res) {
  // Solo permitir peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método no permitido' 
    });
  }

  try {
    const { secreto_id, bucketName } = req.body;
    
    // Validar parámetros
    if (!secreto_id || isNaN(parseInt(secreto_id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de secreto no válido' 
      });
    }
    
    if (!bucketName || typeof bucketName !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere un nombre válido para el bucket' 
      });
    }
    
    // Validar formato del nombre (letras minúsculas, números, puntos y guiones)
    if (!/^[a-z0-9.-]+$/.test(bucketName)) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de bucket inválido. Use sólo letras minúsculas, números, puntos y guiones.'
      });
    }
    
    const client = await pool.connect();
    
    try {
      // Obtener el secreto por ID
      const secretResult = await client.query(
        `SELECT id, nombre, tipo, secretos
         FROM cloud_secrets
         WHERE id = $1`,
        [secreto_id]
      );
      
      if (secretResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Secreto no encontrado' 
        });
      }
      
      const secret = secretResult.rows[0];
      
      // Parsear credenciales si es necesario
      let credenciales = typeof secret.secretos === 'string' 
        ? JSON.parse(secret.secretos) 
        : secret.secretos;
        
      // Para GCP, necesitamos asegurarnos de que el key_file esté parseado correctamente
      if (secret.tipo === 'gcp' && credenciales.key_file && typeof credenciales.key_file === 'string') {
        try {
          console.log('[Buckets API] Intentando parsear key_file de GCP');
          credenciales.key_file = JSON.parse(credenciales.key_file);
          console.log('[Buckets API] key_file parseado correctamente');
        } catch (error) {
          console.error('[Buckets API] Error al parsear key_file:', error);
          // Continuamos aunque haya error, el adaptador intentará manejarlo
        }
      }
      
      // Para Azure, verificar la estructura de connection_string
      if (secret.tipo === 'azure' && credenciales.connection_string) {
        console.log('[Buckets API] Verificando formato del connection_string de Azure para crear bucket');
        const connString = credenciales.connection_string;
        
        // Formato especial con URL + SharedAccessSignature
        if ((connString.includes('SharedAccessSignature=sv=') || connString.includes('SharedAccessSignature=')) && 
            connString.includes('blob.core.windows.net')) {
          console.log('[Buckets API] Detectado formato connection_string con SharedAccessSignature y URL');
          
          // Verificar que el SAS token tenga permisos de creación (sp=c o sp=a)
          if (!connString.includes('sp=c') && !connString.includes('sp=rwdlacup') && 
              !connString.includes('sp=a') && !connString.includes('sp=write')) {
            return res.status(400).json({
              success: false,
              message: 'El token SAS no tiene permisos suficientes para crear buckets. Debe tener sp=c o permisos de escritura.'
            });
          }
        }
      }
      
      // Cargar el adaptador para el tipo de nube
      const adapter = await getCloudAdapter(secret.tipo);
      
      if (!adapter || !adapter.createBucket) {
        return res.status(400).json({
          success: false,
          message: `El proveedor ${secret.tipo} no soporta la función de crear buckets`
        });
      }
      
      // Sin configuración específica
      const configuracion = {};
      
      // Intentar crear el bucket
      console.log(`[Buckets API] Creando bucket "${bucketName}" con secreto ${secreto_id} (${secret.tipo})`);
      
      try {
        const result = await adapter.createBucket(credenciales, configuracion, bucketName);
        
        // Actualizar fecha de última modificación
        await client.query(
          `UPDATE cloud_secrets 
           SET modificado_en = NOW() 
           WHERE id = $1`,
          [secreto_id]
        );
        
        return res.status(201).json({
          success: true,
          message: `Bucket "${bucketName}" creado exitosamente`,
          bucket: { name: bucketName }
        });
      } catch (error) {
        console.error('[Buckets API] Error en la creación del bucket:', error);
        return res.status(500).json({
          success: false,
          message: `Error al crear bucket: ${error.message}`,
          details: error
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en API de creación de bucket:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error interno del servidor: ${error.message}`,
      details: error
    });
  }
}
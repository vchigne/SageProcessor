/**
 * API para listar y crear buckets usando un secreto de nube
 * 
 * GET: Lista los buckets disponibles
 * POST: Crea un nuevo bucket
 */

import { Pool } from 'pg';
import { getCloudAdapter } from '@/utils/cloud';

// Obtener conexión a la base de datos desde las variables de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;
  
  // Validar que el ID es un número
  const secretId = parseInt(id);
  if (isNaN(secretId)) {
    return res.status(400).json({ error: 'ID de secreto inválido' });
  }
  
  try {
    // Obtener un secreto específico
    const result = await pool.query(`
      SELECT id, nombre, tipo, secretos 
      FROM cloud_secrets 
      WHERE id = $1 AND activo = true
    `, [secretId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Secreto no encontrado o inactivo' });
    }
    
    const secreto = result.rows[0];
    
    // Parsear los secretos si es necesario
    const credentials = typeof secreto.secretos === 'string' 
      ? JSON.parse(secreto.secretos) 
      : secreto.secretos;
    
    // Cargar el adaptador para este tipo de proveedor
    const adapter = await getCloudAdapter(secreto.tipo);
    
    if (!adapter) {
      return res.status(400).json({ 
        error: `Adaptador no encontrado para el tipo ${secreto.tipo}` 
      });
    }
    
    // Configuración básica para la operación
    const config = {};
    
    // Ajustes especiales para MinIO
    if (secreto.tipo === 'minio') {
      if (credentials?.endpoint) {
        config.endpoint = credentials.endpoint;
        
        // Si el endpoint no tiene protocolo, agregarlo
        if (config.endpoint && !config.endpoint.startsWith('http')) {
          const useSSL = credentials.secure !== false;
          const protocol = useSSL ? 'https://' : 'http://';
          config.endpoint = protocol + config.endpoint;
        }
      }
    }
    
    // Listar buckets (GET)
    if (method === 'GET') {
      // Verificar si el adaptador tiene la función listBuckets
      if (!adapter.listBuckets) {
        return res.status(400).json({ 
          error: `El adaptador para ${secreto.tipo} no soporta listar buckets` 
        });
      }
      
      // Listar buckets usando el adaptador correspondiente
      const buckets = await adapter.listBuckets(credentials, config);
      
      return res.status(200).json({ 
        success: true,
        buckets: buckets
      });
    }
    
    // Crear bucket (POST)
    else if (method === 'POST') {
      const { name, region, access = 'private' } = req.body;
      
      // Validación básica
      if (!name) {
        return res.status(400).json({ 
          error: 'Se requiere un nombre para el bucket' 
        });
      }
      
      // Verificar si el adaptador tiene la función createBucket
      if (!adapter.createBucket) {
        // Si no existe, implementamos una versión básica aquí
        console.log(`Implementando creación de bucket para ${secreto.tipo}`);
        
        // Implementación específica según el tipo de proveedor
        let result;
        
        if (secreto.tipo === 's3' || secreto.tipo === 'minio') {
          const AWS = require('aws-sdk');
          
          // Configurar cliente S3
          const s3Config = {
            accessKeyId: credentials.access_key,
            secretAccessKey: credentials.secret_key,
            region: region || credentials.region || 'us-east-1'
          };
          
          // Si es MinIO, configurar endpoint
          if (secreto.tipo === 'minio' && config.endpoint) {
            s3Config.endpoint = config.endpoint;
            s3Config.s3ForcePathStyle = true;
            s3Config.signatureVersion = 'v4';
          }
          
          const s3 = new AWS.S3(s3Config);
          
          // Crear el bucket
          result = await s3.createBucket({
            Bucket: name,
            ACL: access
          }).promise();
          
          return res.status(201).json({
            success: true,
            message: `Bucket ${name} creado exitosamente`,
            details: result
          });
        }
        else if (secreto.tipo === 'azure') {
          return res.status(501).json({
            error: 'Creación de containers en Azure no implementada en este endpoint'
          });
        }
        else if (secreto.tipo === 'gcp') {
          return res.status(501).json({
            error: 'Creación de buckets en GCP no implementada en este endpoint'
          });
        }
        else {
          return res.status(400).json({
            error: `Creación de buckets no soportada para el tipo ${secreto.tipo}`
          });
        }
      }
      else {
        // Si el adaptador tiene la función createBucket, usarla
        const result = await adapter.createBucket(credentials, config, name, {
          region,
          access
        });
        
        return res.status(201).json({
          success: true,
          message: `Bucket ${name} creado exitosamente`,
          details: result
        });
      }
    }
    
    // Método no permitido
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error(`Error en operaciones de buckets para secreto ${id}:`, error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message,
      success: false
    });
  }
}
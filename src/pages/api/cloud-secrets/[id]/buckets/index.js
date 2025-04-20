import { Pool } from 'pg';
import { pool } from '../../../../../lib/db';
import { getCloudAdapter } from '../../../../../utils/cloud';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'ID de secreto inválido' });
  }
  
  const secretId = parseInt(id);
  
  try {
    // Obtener buckets para este secreto
    if (method === 'GET') {
      // Obtener el secreto desde la base de datos
      const secretResult = await pool.query(`
        SELECT id, nombre, tipo, credenciales
        FROM cloud_secrets
        WHERE id = $1
      `, [secretId]);
      
      if (secretResult.rows.length === 0) {
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      const secret = secretResult.rows[0];
      
      // Parsear credenciales
      const credentials = typeof secret.credenciales === 'string'
        ? JSON.parse(secret.credenciales)
        : secret.credenciales;
      
      // Determinar el tipo de proveedor
      if (!secret.tipo) {
        return res.status(400).json({ error: 'El secreto no tiene un tipo de proveedor definido' });
      }
      
      // Cargar el adaptador para el tipo de proveedor
      const adapter = await getCloudAdapter(secret.tipo);
      
      if (!adapter || !adapter.listBuckets) {
        return res.status(400).json({
          error: `El proveedor ${secret.tipo} no soporta la función de listar buckets`
        });
      }
      
      // Configuración por defecto para este tipo de proveedor
      const config = {};
      
      // Si hay endpoint en credentials, moverlo a config
      if (credentials.endpoint) {
        config.endpoint = credentials.endpoint;
      }
      
      // Si hay port en credentials, moverlo a config
      if (credentials.port) {
        config.port = credentials.port;
      }
      
      // Si hay secure en credentials, moverlo a config
      if (credentials.secure !== undefined) {
        config.secure = credentials.secure;
      }
      
      // Ejecutar la función para listar buckets
      const result = await adapter.listBuckets(credentials, config);
      
      // Devolver la lista de buckets
      return res.status(200).json(result);
    }
    
    // Crear un nuevo bucket
    else if (method === 'POST') {
      const { bucketName, options } = req.body;
      
      if (!bucketName) {
        return res.status(400).json({ error: 'Se requiere el nombre del bucket' });
      }
      
      // Obtener el secreto
      const secretResult = await pool.query(`
        SELECT id, nombre, tipo, credenciales
        FROM cloud_secrets
        WHERE id = $1
      `, [secretId]);
      
      if (secretResult.rows.length === 0) {
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      const secret = secretResult.rows[0];
      
      // Parsear credenciales
      const credentials = typeof secret.credenciales === 'string'
        ? JSON.parse(secret.credenciales)
        : secret.credenciales;
      
      // Determinar el tipo de proveedor
      if (!secret.tipo) {
        return res.status(400).json({ error: 'El secreto no tiene un tipo de proveedor definido' });
      }
      
      // Cargar el adaptador para el tipo de proveedor
      const adapter = await getCloudAdapter(secret.tipo);
      
      if (!adapter || !adapter.createBucket) {
        return res.status(400).json({
          error: `El proveedor ${secret.tipo} no soporta la función de crear buckets`
        });
      }
      
      // Configuración por defecto para este tipo de proveedor
      const config = {};
      
      // Si hay endpoint en credentials, moverlo a config
      if (credentials.endpoint) {
        config.endpoint = credentials.endpoint;
      }
      
      // Si hay port en credentials, moverlo a config
      if (credentials.port) {
        config.port = credentials.port;
      }
      
      // Si hay secure en credentials, moverlo a config
      if (credentials.secure !== undefined) {
        config.secure = credentials.secure;
      }
      
      // Ejecutar la función para crear el bucket
      const result = await adapter.createBucket(credentials, config, bucketName, options || {});
      
      // Devolver el resultado
      return res.status(201).json(result);
    }
    
    // Método no permitido
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error(`Error al procesar solicitud de buckets para secreto ${secretId}:`, error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}
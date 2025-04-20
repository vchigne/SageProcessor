import { Pool } from 'pg';
import { pool } from '../../../../../lib/db';
import { getCloudAdapter } from '../../../../../utils/cloud';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'ID de proveedor inválido' });
  }
  
  const providerId = parseInt(id);
  
  try {
    // Obtener buckets existentes para este proveedor
    if (method === 'GET') {
      // Obtener el proveedor de nube
      const providerResult = await pool.query(`
        SELECT id, tipo, credenciales, configuracion, secreto_id
        FROM cloud_providers
        WHERE id = $1
      `, [providerId]);
      
      if (providerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      
      const provider = providerResult.rows[0];
      
      // Obtener credenciales (directas o de un secreto)
      let credentials = null;
      
      if (provider.secreto_id) {
        // Obtener credenciales desde el secreto
        const secretResult = await pool.query(`
          SELECT credenciales
          FROM cloud_secrets
          WHERE id = $1
        `, [provider.secreto_id]);
        
        if (secretResult.rows.length === 0) {
          return res.status(400).json({ error: 'El secreto asociado no existe' });
        }
        
        credentials = typeof secretResult.rows[0].credenciales === 'string'
          ? JSON.parse(secretResult.rows[0].credenciales)
          : secretResult.rows[0].credenciales;
      } else {
        // Usar credenciales directas del proveedor
        credentials = typeof provider.credenciales === 'string'
          ? JSON.parse(provider.credenciales)
          : provider.credenciales;
      }
      
      // Parsear la configuración
      const config = typeof provider.configuracion === 'string'
        ? JSON.parse(provider.configuracion)
        : provider.configuracion;
      
      // Cargar el adaptador para el tipo de proveedor
      const adapter = await getCloudAdapter(provider.tipo);
      
      if (!adapter || !adapter.listBuckets) {
        return res.status(400).json({
          error: `El proveedor ${provider.tipo} no soporta la función de listar buckets`
        });
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
      
      // Obtener el proveedor de nube
      const providerResult = await pool.query(`
        SELECT id, tipo, credenciales, configuracion, secreto_id
        FROM cloud_providers
        WHERE id = $1
      `, [providerId]);
      
      if (providerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      
      const provider = providerResult.rows[0];
      
      // Obtener credenciales (directas o de un secreto)
      let credentials = null;
      
      if (provider.secreto_id) {
        // Obtener credenciales desde el secreto
        const secretResult = await pool.query(`
          SELECT credenciales
          FROM cloud_secrets
          WHERE id = $1
        `, [provider.secreto_id]);
        
        if (secretResult.rows.length === 0) {
          return res.status(400).json({ error: 'El secreto asociado no existe' });
        }
        
        credentials = typeof secretResult.rows[0].credenciales === 'string'
          ? JSON.parse(secretResult.rows[0].credenciales)
          : secretResult.rows[0].credenciales;
      } else {
        // Usar credenciales directas del proveedor
        credentials = typeof provider.credenciales === 'string'
          ? JSON.parse(provider.credenciales)
          : provider.credenciales;
      }
      
      // Parsear la configuración
      const config = typeof provider.configuracion === 'string'
        ? JSON.parse(provider.configuracion)
        : provider.configuracion;
      
      // Cargar el adaptador para el tipo de proveedor
      const adapter = await getCloudAdapter(provider.tipo);
      
      if (!adapter || !adapter.createBucket) {
        return res.status(400).json({
          error: `El proveedor ${provider.tipo} no soporta la función de crear buckets`
        });
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
    console.error(`Error al procesar solicitud de buckets para proveedor ${providerId}:`, error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}
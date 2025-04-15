import { Pool } from 'pg';
import { getConfig } from '@/utils/db';

// Conexión a la base de datos
const pool = new Pool(getConfig());

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'ID de proveedor inválido' });
  }

  const providerId = parseInt(id);

  try {
    // Obtener un proveedor específico
    if (method === 'GET') {
      const result = await pool.query(`
        SELECT * FROM cloud_providers WHERE id = $1
      `, [providerId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      
      // Por seguridad, no devolvemos las credenciales completas
      const provider = result.rows[0];
      
      // Solo mostramos información parcial de las credenciales para mostrar en UI
      let maskedCredentials = {};
      if (provider.credenciales) {
        const creds = typeof provider.credenciales === 'string' 
          ? JSON.parse(provider.credenciales) 
          : provider.credenciales;
          
        // Enmascarar valores sensibles
        Object.keys(creds).forEach(key => {
          if (key.toLowerCase().includes('key') || 
              key.toLowerCase().includes('secret') || 
              key.toLowerCase().includes('password') || 
              key.toLowerCase().includes('token')) {
            // Solo mostrar los primeros 4 caracteres y luego asteriscos
            const value = creds[key];
            maskedCredentials[key] = value && value.length > 4 
              ? value.substring(0, 4) + '*'.repeat(8) 
              : '****';
          } else {
            maskedCredentials[key] = creds[key];
          }
        });
      }
      
      return res.status(200).json({
        ...provider,
        credenciales: maskedCredentials
      });
    }
    
    // Actualizar un proveedor
    else if (method === 'PUT') {
      const { nombre, descripcion, tipo, credenciales, configuracion, activo } = req.body;
      
      // Validación básica
      if (!nombre || !tipo) {
        return res.status(400).json({ error: 'Se requieren nombre y tipo' });
      }
      
      // Verificar si el proveedor existe
      const checkResult = await pool.query('SELECT id FROM cloud_providers WHERE id = $1', [providerId]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      
      // Obtener credenciales existentes si no se proporcionan nuevas
      let updatedCredentials = credenciales;
      let updatedConfig = configuracion;
      
      if (!credenciales) {
        const currentResult = await pool.query('SELECT credenciales FROM cloud_providers WHERE id = $1', [providerId]);
        updatedCredentials = currentResult.rows[0].credenciales;
      } else if (typeof credenciales !== 'string') {
        updatedCredentials = JSON.stringify(credenciales);
      }
      
      if (!configuracion) {
        const currentResult = await pool.query('SELECT configuracion FROM cloud_providers WHERE id = $1', [providerId]);
        updatedConfig = currentResult.rows[0].configuracion;
      } else if (typeof configuracion !== 'string') {
        updatedConfig = JSON.stringify(configuracion);
      }
      
      // Actualizar el proveedor
      const result = await pool.query(`
        UPDATE cloud_providers 
        SET nombre = $1, 
            descripcion = $2, 
            tipo = $3, 
            credenciales = $4, 
            configuracion = $5, 
            activo = $6,
            modificado_en = NOW()
        WHERE id = $7
        RETURNING id, nombre, descripcion, tipo, estado, activo, creado_en, modificado_en
      `, [
        nombre, 
        descripcion || '', 
        tipo, 
        updatedCredentials, 
        updatedConfig, 
        activo !== undefined ? activo : true, 
        providerId
      ]);
      
      return res.status(200).json(result.rows[0]);
    }
    
    // Eliminar un proveedor
    else if (method === 'DELETE') {
      // Verificar si el proveedor existe
      const checkResult = await pool.query('SELECT id FROM cloud_providers WHERE id = $1', [providerId]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      
      // Eliminar el proveedor
      await pool.query('DELETE FROM cloud_providers WHERE id = $1', [providerId]);
      
      return res.status(204).end();
    }
    
    // Método no permitido
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error(`Error al procesar solicitud para proveedor ${providerId}:`, error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message 
    });
  }
}
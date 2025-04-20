/**
 * API para gestionar un secreto de nube específico
 * 
 * Este endpoint permite obtener, actualizar o eliminar un secreto específico
 */

import { Pool } from 'pg';

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
    // Obtener un secreto específico (GET)
    if (method === 'GET') {
      const result = await pool.query(`
        SELECT * FROM cloud_secrets WHERE id = $1
      `, [secretId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      // Por seguridad, enmascarar los valores sensibles en la respuesta
      const secreto = result.rows[0];
      
      // Parsear los secretos si es necesario
      let secretosObj = secreto.secretos;
      if (typeof secretosObj === 'string') {
        secretosObj = JSON.parse(secretosObj);
      }
      
      // Enmascarar valores sensibles
      const maskedSecretos = {};
      Object.keys(secretosObj).forEach(key => {
        const value = secretosObj[key];
        
        // Consideramos sensibles keys, secrets, passwords, tokens
        if (key.toLowerCase().includes('key') || 
            key.toLowerCase().includes('secret') || 
            key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('clave')) {
          // Solo mostrar los primeros 4 caracteres y luego asteriscos
          maskedSecretos[key] = typeof value === 'string' && value.length > 4 
            ? value.substring(0, 4) + '*'.repeat(8) 
            : '****';
        } else {
          // Valores no sensibles se muestran completos
          maskedSecretos[key] = value;
        }
      });
      
      return res.status(200).json({
        ...secreto,
        secretos: maskedSecretos
      });
    }
    
    // Actualizar un secreto (PUT)
    else if (method === 'PUT') {
      const { nombre, descripcion, tipo, secretos, activo } = req.body;
      
      // Validación básica
      if (!nombre || !tipo) {
        return res.status(400).json({ error: 'Se requieren nombre y tipo' });
      }
      
      // Verificar si el secreto existe
      const checkResult = await pool.query('SELECT id FROM cloud_secrets WHERE id = $1', [secretId]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      // Obtener secretos existentes si el nuevo secreto contiene asteriscos (valores enmascarados)
      let updatedSecretos = secretos;
      
      if (secretos && typeof secretos === 'object') {
        // Obtener los secretos actuales
        const currentResult = await pool.query('SELECT secretos FROM cloud_secrets WHERE id = $1', [secretId]);
        const currentSecretos = typeof currentResult.rows[0].secretos === 'string' 
          ? JSON.parse(currentResult.rows[0].secretos) 
          : currentResult.rows[0].secretos || {};
        
        // Crear un objeto combinando los actuales con los nuevos
        const merged = { ...currentSecretos };
        
        // Verificar si hay campos sensibles enmascarados
        let containsSensitiveFields = false;
        
        Object.keys(secretos).forEach(key => {
          const value = secretos[key];
          
          // Verificar si es un campo sensible enmascarado (contiene asteriscos)
          const isSensitive = (
            key.toLowerCase().includes('key') || 
            key.toLowerCase().includes('secret') || 
            key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('clave')
          );
          
          // Si el campo es sensible y contiene asteriscos, no actualizar
          if (isSensitive && typeof value === 'string' && value.includes('*')) {
            containsSensitiveFields = true;
            console.log(`[UPDATE] Campo sensible enmascarado detectado: ${key}, manteniendo valor original`);
          } else {
            // Caso contrario, actualizar con el nuevo valor
            merged[key] = value;
          }
        });
        
        if (containsSensitiveFields) {
          console.log('[UPDATE] Algunos campos sensibles mantienen sus valores originales');
        }
        
        // Convertir a string para almacenar en la BD
        updatedSecretos = JSON.stringify(merged);
      }
      
      // Actualizar el secreto
      const updateFields = [];
      const updateValues = [];
      let valueIndex = 1;
      
      if (nombre) {
        updateFields.push(`nombre = $${valueIndex++}`);
        updateValues.push(nombre);
      }
      
      if (descripcion !== undefined) {
        updateFields.push(`descripcion = $${valueIndex++}`);
        updateValues.push(descripcion);
      }
      
      if (tipo) {
        updateFields.push(`tipo = $${valueIndex++}`);
        updateValues.push(tipo);
      }
      
      if (updatedSecretos) {
        updateFields.push(`secretos = $${valueIndex++}`);
        updateValues.push(updatedSecretos);
      }
      
      if (activo !== undefined) {
        updateFields.push(`activo = $${valueIndex++}`);
        updateValues.push(activo);
      }
      
      updateFields.push(`modificado_en = NOW()`);
      
      const updateQuery = `
        UPDATE cloud_secrets 
        SET ${updateFields.join(', ')} 
        WHERE id = $${valueIndex} 
        RETURNING id, nombre, descripcion, tipo, activo, creado_en, modificado_en
      `;
      
      updateValues.push(secretId);
      
      const result = await pool.query(updateQuery, updateValues);
      
      return res.status(200).json(result.rows[0]);
    }
    
    // Eliminar un secreto (DELETE)
    else if (method === 'DELETE') {
      // En lugar de eliminar físicamente, desactivamos el secreto
      const result = await pool.query(`
        UPDATE cloud_secrets 
        SET activo = false, modificado_en = NOW() 
        WHERE id = $1 
        RETURNING id, nombre, activo
      `, [secretId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      return res.status(200).json({ 
        message: 'Secreto desactivado correctamente',
        secreto: result.rows[0]
      });
    }
    
    // Método no permitido
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error(`Error en API de cloud-secrets/${id}:`, error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message 
    });
  }
}
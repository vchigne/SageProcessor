import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../../lib/db';
import { extraerMetadatosYaml } from '../../../../lib/yaml-parser';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid data box ID' });
  }

  try {
    const { yaml_content, api_endpoint, email_casilla, is_active } = req.body;
    console.log('Updating data box:', { id, api_endpoint, email_casilla, is_active });

    const client = await pool.connect();
    
    // Primero obtenemos los datos actuales de la casilla
    const dataBoxResult = await client.query(
      'SELECT instalacion_id, nombre_yaml FROM casillas WHERE id = $1',
      [id]
    );
    
    if (dataBoxResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Data box not found' });
    }
    
    const { instalacion_id, nombre_yaml } = dataBoxResult.rows[0];

    try {
      await client.query('BEGIN');
      
      // Preparamos la actualización de la casilla
      let nombre = null;
      let descripcion = null;
      
      // Si se proporciona nuevo contenido YAML, extraemos los metadatos y actualizamos el contenido
      if (yaml_content) {
        console.log('Procesando nuevo contenido YAML para casilla ID:', id);
        
        // Extraer nombre y descripción del contenido YAML
        const metadatos = extraerMetadatosYaml(yaml_content);
        nombre = metadatos.nombre;
        descripcion = metadatos.descripcion;
        
        console.log('Metadatos extraídos:', { nombre, descripcion });
      }
      
      // Actualizamos la casilla de recepción con todos los campos
      console.log('Actualizando casilla con los valores:', { 
        api_endpoint, 
        email_casilla, 
        is_active,
        nombre,
        descripcion 
      });
      
      const updateParams = [];
      let updateQuery = `UPDATE casillas SET `;
      
      // Construir la consulta dinámica para actualizar solo los campos proporcionados
      const updates = [];
      let paramIndex = 1;
      
      if (api_endpoint !== undefined) {
        updates.push(`api_endpoint = $${paramIndex++}`);
        updateParams.push(api_endpoint || null);
      }
      
      if (email_casilla !== undefined) {
        updates.push(`email_casilla = $${paramIndex++}`);
        updateParams.push(email_casilla || null);
      }
      
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        updateParams.push(is_active);
      }
      
      if (yaml_content) {
        updates.push(`yaml_contenido = $${paramIndex++}`);
        updateParams.push(yaml_content);
        
        if (nombre) {
          updates.push(`nombre = $${paramIndex++}`);
          updateParams.push(nombre);
        }
        
        if (descripcion) {
          updates.push(`descripcion = $${paramIndex++}`);
          updateParams.push(descripcion);
        }
      }
      
      updateQuery += updates.join(', ');
      updateQuery += ` WHERE id = $${paramIndex++} RETURNING id`;
      updateParams.push(id);
      
      const updateResult = await client.query(updateQuery, updateParams);

      // Si el email cambió y no es null, aseguramos que existe una configuración de email
      if (email_casilla && email_casilla.trim() !== '') {
        console.log('Verificando configuración de email para:', email_casilla);
        
        // Verificar si ya existe una configuración para este email
        const emailConfigResult = await client.query(
          `SELECT id FROM email_configuraciones WHERE direccion = $1`,
          [email_casilla]
        );
        
        if (emailConfigResult.rows.length === 0) {
          console.log('Creando configuración de email para:', email_casilla);
          
          // Crear una configuración básica con el usuario del sistema
          await client.query(
            `INSERT INTO email_configuraciones
              (nombre, direccion, proposito, servidor_entrada, puerto_entrada, 
              protocolo_entrada, usar_ssl_entrada, servidor_salida, puerto_salida, 
              usar_tls_salida, usuario, password, casilla_id, estado)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              `Email for ${nombre_yaml}`,  // nombre
              email_casilla,               // direccion
              'notificaciones',            // proposito
              'imap.example.com',          // servidor_entrada
              993,                         // puerto_entrada
              'imap',                      // protocolo_entrada
              true,                        // usar_ssl_entrada
              'smtp.example.com',          // servidor_salida
              587,                         // puerto_salida
              true,                        // usar_tls_salida
              'sistema',                   // usuario - valor por defecto para cumplir con la restricción NOT NULL
              'pendiente',                 // password - valor por defecto
              id,                          // casilla_id
              'pendiente'                  // estado
            ]
          );
        } else {
          console.log('Configuración de email ya existe para:', email_casilla);
          
          // Actualizar la asociación con esta casilla
          await client.query(
            `UPDATE email_configuraciones 
              SET casilla_id = $1
              WHERE direccion = $2`,
            [id, email_casilla]
          );
        }
      }

      await client.query('COMMIT');
      
      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'Data box not found' });
      } else {
        res.status(200).json({ 
          id: updateResult.rows[0].id,
          message: 'Data box updated successfully' 
        });
      }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Database error:', err);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating data box:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
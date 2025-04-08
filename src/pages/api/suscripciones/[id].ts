import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { 
    method,
    query: { id }
  } = req;

  if (!id) {
    return res.status(400).json({ error: 'ID es obligatorio' });
  }

  switch (method) {
    case 'GET':
      return handleGet(req, res, id as string);
    case 'DELETE':
      return handleDelete(req, res, id as string);
    case 'PUT':
      return handleUpdate(req, res, id as string);
    default:
      res.setHeader('Allow', ['GET', 'DELETE', 'PUT']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const query = 'SELECT * FROM suscripciones WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }
    
    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error al obtener suscripción:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    // Verificar si la suscripción existe antes de eliminarla
    const checkQuery = 'SELECT id FROM suscripciones WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }
    
    // Eliminar la suscripción
    const deleteQuery = 'DELETE FROM suscripciones WHERE id = $1 RETURNING id';
    const deleteResult = await pool.query(deleteQuery, [id]);
    
    return res.status(200).json({ 
      message: 'Suscripción eliminada correctamente',
      id: deleteResult.rows[0].id
    });
  } catch (error: any) {
    console.error('Error al eliminar suscripción:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handleUpdate(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    // Verificar si la suscripción existe antes de actualizarla
    const checkQuery = 'SELECT * FROM suscripciones WHERE id = $1';
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }
    
    const {
      casilla_id,
      nombre,
      email,
      telefono,
      frecuencia,
      nivel_detalle,
      tipos_evento,
      hora_envio,
      dia_envio,
      metodo_envio,
      emisores,
      es_tecnico,
      webhook_url,
      api_key
    } = req.body;
    
    // Convertir arrays a JSON para almacenarlos en la base de datos
    const tiposEventoJson = Array.isArray(tipos_evento) ? JSON.stringify(tipos_evento) : JSON.stringify([]);
    const emisoresJson = Array.isArray(emisores) ? JSON.stringify(emisores) : JSON.stringify([]);
    
    // hora_envio ya puede ser utilizado directamente como TIME
    // No es necesario realizar conversiones

    // Actualizar la suscripción
    const updateQuery = `
      UPDATE suscripciones
      SET 
        casilla_id = $1,
        nombre = $2,
        email = $3,
        telefono = $4,
        frecuencia = $5,
        nivel_detalle = $6,
        tipos_evento = $7,
        hora_envio = $8,
        dia_envio = $9,
        metodo_envio = $10,
        emisores = $11,
        es_tecnico = $12,
        webhook_url = $13,
        api_key = $14,
        updated_at = NOW()
      WHERE id = $15
      RETURNING *
    `;
    
    const values = [
      casilla_id,
      nombre,
      email,
      telefono,
      frecuencia,
      nivel_detalle,
      tiposEventoJson,
      hora_envio,
      dia_envio,
      metodo_envio,
      emisoresJson,
      es_tecnico,
      webhook_url,
      api_key,
      id
    ];
    
    const result = await pool.query(updateQuery, values);
    
    return res.status(200).json({ 
      message: 'Suscripción actualizada correctamente',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error al actualizar suscripción:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
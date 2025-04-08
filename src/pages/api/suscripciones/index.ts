import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { casilla_id, portalUuid, portalId } = req.query;

  if (!casilla_id && !portalUuid && !portalId) {
    return res.status(400).json({ error: 'Se requiere casilla_id, portalUuid o portalId' });
  }

  try {
    let query = '';
    let queryParams = [];

    // Consulta por casilla_id
    if (casilla_id) {
      query = `
        SELECT * 
        FROM suscripciones 
        WHERE casilla_id = $1
        ORDER BY created_at DESC
      `;
      queryParams = [casilla_id];
    }
    // Consulta por portalUuid o portalId (para el portal externo)
    else if (portalUuid || portalId) {
      // Si tenemos portalUuid, primero obtenemos el portal
      if (portalUuid) {
        const portalResult = await pool.query(`
          SELECT p.id, cr.id as casilla_id
          FROM portales p
          JOIN casillas cr ON p.instalacion_id = cr.instalacion_id
          WHERE p.uuid = $1
          LIMIT 1
        `, [portalUuid]);
        
        if (portalResult.rows.length === 0) {
          return res.status(404).json({ error: 'Portal no encontrado' });
        }
        
        // Consultar suscripciones por casilla_id del portal
        query = `
          SELECT * 
          FROM suscripciones 
          WHERE casilla_id = $1
          ORDER BY created_at DESC
        `;
        queryParams = [portalResult.rows[0].casilla_id];
      } else {
        // Si tenemos portalId, obtenemos la casilla relacionada
        const portalResult = await pool.query(`
          SELECT p.id, cr.id as casilla_id
          FROM portales p
          JOIN casillas cr ON p.instalacion_id = cr.instalacion_id
          WHERE p.id = $1
          LIMIT 1
        `, [portalId]);
        
        if (portalResult.rows.length === 0) {
          return res.status(404).json({ error: 'Portal no encontrado' });
        }
        
        // Consultar suscripciones por casilla_id del portal
        query = `
          SELECT * 
          FROM suscripciones 
          WHERE casilla_id = $1
          ORDER BY created_at DESC
        `;
        queryParams = [portalResult.rows[0].casilla_id];
      }
    }
    
    const result = await pool.query(query, queryParams);
    
    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('Error al obtener suscripciones:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { 
    casilla_id, 
    portalUuid,
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
  
  // El campo hora_envio ya es de tipo TIME, no necesitamos conversión
  // Podemos usar el valor directamente desde el formulario

  // Validar campos obligatorios básicos
  if (!nombre || !frecuencia || !nivel_detalle || !tipos_evento) {
    return res.status(400).json({ 
      error: 'Faltan campos obligatorios',
      missingFields: {
        nombre: !nombre,
        frecuencia: !frecuencia,
        nivel_detalle: !nivel_detalle,
        tipos_evento: !tipos_evento
      }
    });
  }

  // Validaciones adicionales según tipo de suscripción
  if (!es_tecnico && !email) {
    return res.status(400).json({ error: 'El email es obligatorio para suscripciones no técnicas' });
  }

  if (es_tecnico && !webhook_url) {
    return res.status(400).json({ error: 'La URL del webhook es obligatoria para suscripciones técnicas' });
  }

  // Validación para métodos que requieren teléfono
  if ((metodo_envio === 'whatsapp' || metodo_envio === 'telegram') && !telefono) {
    return res.status(400).json({ error: `El teléfono es obligatorio para envíos por ${metodo_envio}` });
  }

  try {
    // Determinar el casilla_id basado en los parámetros recibidos
    let casillaIdToUse = casilla_id;
    
    // Si no tenemos casilla_id pero tenemos portalUuid
    if (!casillaIdToUse && portalUuid) {
      // Obtener información del portal y la casilla asociada
      const portalResult = await pool.query(`
        SELECT p.id, cr.id as casilla_id
        FROM portales p
        JOIN casillas cr ON p.instalacion_id = cr.instalacion_id
        WHERE p.uuid = $1
        LIMIT 1
      `, [portalUuid]);
      
      if (portalResult.rows.length === 0) {
        return res.status(404).json({ error: 'Portal no encontrado o no tiene casilla asociada' });
      }
      
      casillaIdToUse = portalResult.rows[0].casilla_id;
    }
    
    if (!casillaIdToUse) {
      return res.status(400).json({ error: 'No se pudo determinar la casilla para la suscripción' });
    }
    
    const query = `
      INSERT INTO suscripciones (
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
        api_key,
        activo,
        created_at,
        updated_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, NOW(), NOW())
      RETURNING *
    `;
    
    const values = [
      casillaIdToUse,
      nombre,
      email || null,
      telefono || null,
      frecuencia,
      nivel_detalle,
      JSON.stringify(tipos_evento || []),
      hora_envio,
      dia_envio ? parseInt(dia_envio.toString(), 10) : null,
      metodo_envio || 'email',
      JSON.stringify(emisores || []),
      es_tecnico || false,
      webhook_url || null,
      api_key || null
    ];
    
    const result = await pool.query(query, values);
    
    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error al crear suscripción:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
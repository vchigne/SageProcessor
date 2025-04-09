import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      try {
        // Obtener parámetros de consulta
        const { proposito, estado, casilla_id, busqueda } = req.query;
        
        let query = `
          SELECT 
            ec.id, ec.nombre, ec.direccion, ec.proposito, 
            ec.servidor_entrada, ec.puerto_entrada, ec.protocolo_entrada, ec.usar_ssl_entrada,
            ec.servidor_salida, ec.puerto_salida, ec.usar_tls_salida,
            ec.usuario, ec.casilla_id, ec.estado, ec.ultimo_chequeo, ec.mensaje_error,
            ec.fecha_creacion, ec.fecha_modificacion,
            cr.nombre_yaml as casilla_nombre, cr.email_casilla
          FROM email_configuraciones ec
          LEFT JOIN casillas cr ON ec.casilla_id = cr.id
          WHERE 1=1
        `;
        
        const queryParams: any[] = [];
        let paramCounter = 1;
        
        // Aplicar filtros
        if (proposito) {
          query += ` AND ec.proposito = $${paramCounter}`;
          queryParams.push(proposito);
          paramCounter++;
        }
        
        if (estado) {
          query += ` AND ec.estado = $${paramCounter}`;
          queryParams.push(estado);
          paramCounter++;
        }
        
        if (casilla_id) {
          query += ` AND ec.casilla_id = $${paramCounter}`;
          queryParams.push(casilla_id);
          paramCounter++;
        }
        
        // Búsqueda de texto
        if (busqueda) {
          query += ` AND (
            ec.nombre ILIKE $${paramCounter} OR 
            ec.direccion ILIKE $${paramCounter} OR
            cr.nombre_yaml ILIKE $${paramCounter}
          )`;
          queryParams.push(`%${busqueda}%`);
          paramCounter++;
        }
        
        query += ` ORDER BY ec.nombre ASC`;
        
        const result = await pool.query(query, queryParams);
        
        return res.status(200).json(result.rows);
      } catch (error: any) {
        console.error('Error al obtener configuraciones de email:', error);
        return res.status(500).json({ 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
    case 'POST':
      try {
        const {
          nombre,
          direccion,
          proposito,
          servidor_entrada,
          puerto_entrada,
          protocolo_entrada,
          usar_ssl_entrada,
          servidor_salida,
          puerto_salida,
          usar_tls_salida,
          usuario,
          password,
          casilla_id,
          estado
        } = req.body;
        
        // Validaciones básicas
        if (!nombre || !direccion || !proposito || !usuario) {
          return res.status(400).json({ 
            error: 'Faltan campos requeridos: nombre, direccion, proposito, usuario' 
          });
        }
        
        // Consulta simplificada
        const result = await pool.query(`
          INSERT INTO email_configuraciones (
            nombre, direccion, proposito, servidor_entrada, puerto_entrada, 
            protocolo_entrada, usar_ssl_entrada, servidor_salida, puerto_salida, 
            usar_tls_salida, usuario, password, casilla_id, estado, 
            fecha_creacion, fecha_modificacion
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
          RETURNING id
        `, [
          nombre,
          direccion,
          proposito,
          servidor_entrada || null,
          puerto_entrada || null,
          protocolo_entrada || 'imap',
          usar_ssl_entrada === undefined ? true : usar_ssl_entrada,
          servidor_salida || null,
          puerto_salida || null,
          usar_tls_salida === undefined ? true : usar_tls_salida,
          usuario,
          password,
          casilla_id || null,
          estado || 'pendiente'
        ]);
        
        const id = result.rows[0].id;
        
        return res.status(201).json({ 
          id, 
          mensaje: 'Configuración creada correctamente' 
        });
      } catch (error: any) {
        console.error('Error al crear configuración de email:', error);
        return res.status(500).json({ 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
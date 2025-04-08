import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Conectar a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { id } = req.query;

  // Validar que el ID es un número
  const suscriptorId = parseInt(id as string, 10);
  if (isNaN(suscriptorId)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  switch (method) {
    case 'GET':
      try {
        // Obtener detalles del suscriptor
        const query = `
          SELECT 
            s.id, 
            s.tipo, 
            s.nombre, 
            s.email, 
            s.telefono, 
            s.fecha_creacion, 
            s.fecha_modificacion, 
            s.activo,
            (
              SELECT COUNT(*) 
              FROM suscripciones 
              WHERE suscriptor_id = s.id
            ) as total_suscripciones
          FROM 
            suscriptores s
          WHERE 
            s.id = $1
        `;
        
        const result = await pool.query(query, [suscriptorId]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Suscriptor no encontrado' });
        }
        
        return res.status(200).json(result.rows[0]);
      } catch (error: any) {
        console.error('Error al obtener suscriptor:', error);
        return res.status(500).json({ 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
    case 'PUT':
      try {
        const { tipo, nombre, email, telefono, activo } = req.body;
        
        // Validar campos requeridos
        if (!tipo || !nombre) {
          return res.status(400).json({ error: 'Tipo y nombre son campos requeridos' });
        }
        
        // Validar tipos permitidos
        if (!['humano', 'tecnico'].includes(tipo)) {
          return res.status(400).json({ error: 'Tipo debe ser "humano" o "tecnico"' });
        }
        
        // Si es humano, el email es obligatorio
        if (tipo === 'humano' && !email) {
          return res.status(400).json({ error: 'Email es requerido para suscriptores humanos' });
        }
        
        // Primero verificar si el suscriptor existe
        const checkQuery = 'SELECT id FROM suscriptores WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [suscriptorId]);
        
        if (checkResult.rows.length === 0) {
          return res.status(404).json({ error: 'Suscriptor no encontrado' });
        }
        
        // Actualizar suscriptor
        const query = `
          UPDATE suscriptores 
          SET 
            tipo = $1, 
            nombre = $2, 
            email = $3, 
            telefono = $4,
            activo = $5
          WHERE 
            id = $6 
          RETURNING *
        `;
        
        const values = [
          tipo, 
          nombre, 
          email || null, 
          telefono || null,
          activo !== undefined ? activo : true,
          suscriptorId
        ];
        
        const result = await pool.query(query, values);
        
        return res.status(200).json(result.rows[0]);
      } catch (error: any) {
        console.error('Error al actualizar suscriptor:', error);
        return res.status(500).json({ 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
    case 'DELETE':
      try {
        // Verificar si tiene suscripciones activas
        const checkQuery = `
          SELECT COUNT(*) as total 
          FROM suscripciones 
          WHERE suscriptor_id = $1
        `;
        
        const checkResult = await pool.query(checkQuery, [suscriptorId]);
        const totalSuscripciones = parseInt(checkResult.rows[0].total, 10);
        
        if (totalSuscripciones > 0) {
          // Si tiene suscripciones, solo desactivar en lugar de eliminar
          const updateQuery = `
            UPDATE suscriptores 
            SET activo = false 
            WHERE id = $1 
            RETURNING *
          `;
          
          const updateResult = await pool.query(updateQuery, [suscriptorId]);
          
          if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Suscriptor no encontrado' });
          }
          
          return res.status(200).json({ 
            message: 'Suscriptor desactivado. No se puede eliminar porque tiene suscripciones asociadas.',
            suscriptor: updateResult.rows[0]
          });
        } else {
          // Si no tiene suscripciones, eliminar completamente
          const deleteQuery = 'DELETE FROM suscriptores WHERE id = $1 RETURNING *';
          const deleteResult = await pool.query(deleteQuery, [suscriptorId]);
          
          if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Suscriptor no encontrado' });
          }
          
          return res.status(200).json({ 
            message: 'Suscriptor eliminado correctamente',
            suscriptor: deleteResult.rows[0]
          });
        }
      } catch (error: any) {
        console.error('Error al eliminar suscriptor:', error);
        return res.status(500).json({ 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
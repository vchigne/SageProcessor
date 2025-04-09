import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { id } = req.query;
  
  // Validar ID
  const configId = parseInt(id as string);
  if (isNaN(configId)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  switch (method) {
    case 'GET':
      try {
        const result = await pool.query(`
          SELECT 
            ec.id, ec.nombre, ec.direccion, ec.proposito, 
            ec.servidor_entrada, ec.puerto_entrada, ec.protocolo_entrada, ec.usar_ssl_entrada,
            ec.servidor_salida, ec.puerto_salida, ec.usar_tls_salida,
            ec.usuario, ec.casilla_id, ec.estado, ec.ultimo_chequeo, ec.mensaje_error,
            ec.fecha_creacion, ec.fecha_modificacion,
            cr.nombre_yaml as casilla_nombre
          FROM email_configuraciones ec
          LEFT JOIN casillas cr ON ec.casilla_id = cr.id
          WHERE ec.id = $1
        `, [configId]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        
        return res.status(200).json(result.rows[0]);
      } catch (error: any) {
        console.error(`Error al obtener configuración ${configId}:`, error);
        return res.status(500).json({ 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
    case 'PUT':
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
        
        // Verificar si existe
        const checkResult = await pool.query(
          'SELECT id FROM email_configuraciones WHERE id = $1', 
          [configId]
        );
        
        if (checkResult.rows.length === 0) {
          return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        
        // Si se proporciona password, actualizar. Si no, mantener el existente
        let query;
        let params;
        
        if (password) {
          query = `
            UPDATE email_configuraciones
            SET 
              nombre = $1,
              direccion = $2,
              proposito = $3,
              servidor_entrada = $4,
              puerto_entrada = $5,
              protocolo_entrada = $6,
              usar_ssl_entrada = $7,
              servidor_salida = $8,
              puerto_salida = $9,
              usar_tls_salida = $10,
              usuario = $11,
              password = $12,
              casilla_id = $13,
              estado = $14,
              fecha_modificacion = NOW()
            WHERE id = $15
          `;
          
          params = [
            nombre,
            direccion,
            proposito,
            servidor_entrada,
            puerto_entrada,
            protocolo_entrada,
            usar_ssl_entrada === undefined ? true : usar_ssl_entrada,
            servidor_salida,
            puerto_salida,
            usar_tls_salida === undefined ? true : usar_tls_salida,
            usuario,
            password,
            casilla_id,
            estado || 'pendiente',
            configId
          ];
        } else {
          query = `
            UPDATE email_configuraciones
            SET 
              nombre = $1,
              direccion = $2,
              proposito = $3,
              servidor_entrada = $4,
              puerto_entrada = $5,
              protocolo_entrada = $6,
              usar_ssl_entrada = $7,
              servidor_salida = $8,
              puerto_salida = $9,
              usar_tls_salida = $10,
              usuario = $11,
              casilla_id = $12,
              estado = $13,
              fecha_modificacion = NOW()
            WHERE id = $14
          `;
          
          params = [
            nombre,
            direccion,
            proposito,
            servidor_entrada,
            puerto_entrada,
            protocolo_entrada,
            usar_ssl_entrada === undefined ? true : usar_ssl_entrada,
            servidor_salida,
            puerto_salida,
            usar_tls_salida === undefined ? true : usar_tls_salida,
            usuario,
            casilla_id,
            estado || 'pendiente',
            configId
          ];
        }
        
        await pool.query(query, params);
        
        return res.status(200).json({ 
          mensaje: 'Configuración actualizada correctamente' 
        });
      } catch (error: any) {
        console.error(`Error al actualizar configuración ${configId}:`, error);
        return res.status(500).json({ 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
    case 'DELETE':
      try {
        // Verificar si existe
        const checkResult = await pool.query(
          'SELECT id FROM email_configuraciones WHERE id = $1', 
          [configId]
        );
        
        if (checkResult.rows.length === 0) {
          return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        
        // Eliminar
        await pool.query('DELETE FROM email_configuraciones WHERE id = $1', [configId]);
        
        return res.status(200).json({ 
          mensaje: 'Configuración eliminada correctamente' 
        });
      } catch (error: any) {
        console.error(`Error al eliminar configuración ${configId}:`, error);
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
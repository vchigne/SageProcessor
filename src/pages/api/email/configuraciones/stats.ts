import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }
  
  try {
    // Obtener estadísticas por estado
    const statsByStatusQuery = `
      SELECT 
        estado, 
        COUNT(*) as cantidad
      FROM 
        email_configuraciones
      GROUP BY 
        estado
      ORDER BY 
        estado
    `;
    
    // Obtener estadísticas por propósito
    const statsByPurposeQuery = `
      SELECT 
        proposito, 
        COUNT(*) as cantidad
      FROM 
        email_configuraciones
      GROUP BY 
        proposito
      ORDER BY 
        proposito
    `;
    
    // Obtener cantidad de casillas sin configuración
    const unconfiguredMailboxesQuery = `
      SELECT 
        COUNT(*) as cantidad
      FROM 
        casillas cr
      WHERE 
        NOT EXISTS (
          SELECT 1 
          FROM email_configuraciones ec 
          WHERE ec.casilla_id = cr.id
        )
    `;
    
    // Ejecutar consultas
    const [statusStats, purposeStats, unconfiguredStats] = await Promise.all([
      pool.query(statsByStatusQuery),
      pool.query(statsByPurposeQuery),
      pool.query(unconfiguredMailboxesQuery)
    ]);
    
    // Transformar resultados
    const estadisticas = {
      por_estado: statusStats.rows.reduce((acc: any, row) => {
        acc[row.estado] = parseInt(row.cantidad);
        return acc;
      }, {}),
      
      por_proposito: purposeStats.rows.reduce((acc: any, row) => {
        acc[row.proposito] = parseInt(row.cantidad);
        return acc;
      }, {}),
      
      casillas_sin_configuracion: parseInt(unconfiguredStats.rows[0].cantidad),
      
      total: statusStats.rows.reduce((sum: number, row) => {
        return sum + parseInt(row.cantidad);
      }, 0)
    };
    
    return res.status(200).json(estadisticas);
    
  } catch (error: any) {
    console.error('Error al obtener estadísticas de configuraciones de email:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
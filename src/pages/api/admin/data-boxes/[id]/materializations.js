import { Pool } from 'pg';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';

// Obtener la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID de casilla inválido' });
  }
  
  switch (req.method) {
    case 'GET':
      return getMaterializationsByCasilla(req, res, parseInt(id));
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

// GET: Obtener materializaciones de una casilla específica
async function getMaterializationsByCasilla(req, res, casillaId) {
  try {
    // Verificar que la casilla existe
    const casillaQuery = `SELECT id, nombre FROM casillas WHERE id = $1`;
    const casillaResult = await pool.query(casillaQuery, [casillaId]);
    
    if (casillaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Casilla no encontrada' });
    }
    
    // Consultar materializaciones para esta casilla
    const query = `
      SELECT 
        m.id, 
        m.casilla_id,
        m.nombre,
        m.descripcion,
        m.configuracion,
        m.estado,
        m.ultima_materializacion,
        m.fecha_creacion,
        m.fecha_actualizacion,
        c.nombre AS nombre_casilla
      FROM 
        materializaciones m
      LEFT JOIN 
        casillas c ON m.casilla_id = c.id
      WHERE 
        m.casilla_id = $1
      ORDER BY 
        m.fecha_creacion DESC
    `;
    
    const result = await pool.query(query, [casillaId]);
    
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener materializaciones:', error);
    return res.status(500).json({ 
      message: 'Error interno al obtener materializaciones', 
      error: error.message 
    });
  }
}
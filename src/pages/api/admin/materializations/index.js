import { Pool } from 'pg';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

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

  switch (req.method) {
    case 'GET':
      return getMaterializations(req, res);
    case 'POST':
      return createMaterialization(req, res);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

// GET: Obtener todas las materializaciones o filtrar por casilla_id
async function getMaterializations(req, res) {
  try {
    const { casilla_id } = req.query;
    
    // Consulta base
    let query = `
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
    `;
    
    const params = [];
    
    // Filtrar por casilla_id si se proporciona
    if (casilla_id) {
      query += ` WHERE m.casilla_id = $1`;
      params.push(casilla_id);
    }
    
    query += ` ORDER BY m.fecha_creacion DESC`;
    
    const result = await pool.query(query, params);
    
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener materializaciones:', error);
    return res.status(500).json({ 
      message: 'Error interno al obtener materializaciones', 
      error: error.message 
    });
  }
}

// POST: Crear una nueva materialización
async function createMaterialization(req, res) {
  try {
    const {
      casilla_id,
      nombre,
      descripcion,
      configuracion = {}
    } = req.body;
    
    // Validar datos requeridos
    if (!casilla_id) {
      return res.status(400).json({ message: 'ID de casilla requerido' });
    }
    
    if (!nombre) {
      return res.status(400).json({ message: 'Nombre requerido' });
    }
    
    // Comprobar si la casilla existe
    const casillaQuery = `SELECT id FROM casillas WHERE id = $1`;
    const casillaResult = await pool.query(casillaQuery, [casilla_id]);
    
    if (casillaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Casilla no encontrada' });
    }
    
    // Insertar la nueva materialización
    const insertQuery = `
      INSERT INTO materializaciones (
        casilla_id,
        nombre,
        descripcion,
        configuracion,
        estado,
        fecha_creacion,
        fecha_actualizacion
      ) VALUES (
        $1, $2, $3, $4, 'pendiente', NOW(), NOW()
      ) RETURNING *
    `;
    
    const insertParams = [
      casilla_id,
      nombre,
      descripcion || null,
      configuracion || {}
    ];
    
    const result = await pool.query(insertQuery, insertParams);
    
    // Obtener el nombre de la casilla para incluirlo en la respuesta
    const newMaterialization = result.rows[0];
    
    const casillaNameQuery = `SELECT nombre FROM casillas WHERE id = $1`;
    const casillaNameResult = await pool.query(casillaNameQuery, [newMaterialization.casilla_id]);
    
    if (casillaNameResult.rows.length > 0) {
      newMaterialization.nombre_casilla = casillaNameResult.rows[0].nombre;
    }
    
    return res.status(201).json(newMaterialization);
  } catch (error) {
    console.error('Error al crear materialización:', error);
    return res.status(500).json({ 
      message: 'Error interno al crear materialización', 
      error: error.message 
    });
  }
}
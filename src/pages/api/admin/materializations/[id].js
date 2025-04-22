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

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID de materialización inválido' });
  }
  
  const materializationId = parseInt(id);
  
  switch (req.method) {
    case 'GET':
      return getMaterialization(req, res, materializationId);
    case 'PUT':
      return updateMaterialization(req, res, materializationId);
    case 'PATCH':
      return patchMaterialization(req, res, materializationId);
    case 'DELETE':
      return deleteMaterialization(req, res, materializationId);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

// GET: Obtener una materialización específica
async function getMaterialization(req, res, id) {
  try {
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
        m.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener materialización:', error);
    return res.status(500).json({ 
      message: 'Error interno al obtener materialización', 
      error: error.message 
    });
  }
}

// PUT: Actualizar una materialización
async function updateMaterialization(req, res, id) {
  try {
    // Primero verificar que la materialización existe
    const checkQuery = `SELECT id FROM materializaciones WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    const {
      nombre,
      descripcion,
      configuracion = {},
      estado
    } = req.body;
    
    // Validar datos requeridos
    if (!nombre) {
      return res.status(400).json({ message: 'Nombre requerido' });
    }
    
    // Actualizar la materialización
    const updateQuery = `
      UPDATE materializaciones
      SET 
        nombre = $1,
        descripcion = $2,
        configuracion = $3,
        estado = $4,
        fecha_actualizacion = NOW()
      WHERE id = $5
      RETURNING *
    `;
    
    const updateParams = [
      nombre,
      descripcion || null,
      configuracion || {},
      estado || 'pendiente',
      id
    ];
    
    const updateResult = await pool.query(updateQuery, updateParams);
    
    // Obtener el nombre de la casilla para incluirlo en la respuesta
    const updatedMaterialization = updateResult.rows[0];
    
    const casillaNameQuery = `SELECT nombre FROM casillas WHERE id = $1`;
    const casillaNameResult = await pool.query(casillaNameQuery, [updatedMaterialization.casilla_id]);
    
    if (casillaNameResult.rows.length > 0) {
      updatedMaterialization.nombre_casilla = casillaNameResult.rows[0].nombre;
    }
    
    return res.status(200).json(updatedMaterialization);
  } catch (error) {
    console.error('Error al actualizar materialización:', error);
    return res.status(500).json({ 
      message: 'Error interno al actualizar materialización', 
      error: error.message 
    });
  }
}

// PATCH: Actualizar parcialmente una materialización
async function patchMaterialization(req, res, id) {
  try {
    // Primero verificar que la materialización existe
    const checkQuery = `SELECT * FROM materializaciones WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    const currentData = checkResult.rows[0];
    const updates = {};
    const allowedFields = [
      'nombre', 'descripcion', 'configuracion', 'estado'
    ];
    
    // Recopilar campos para actualizar
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    
    // Si no hay campos para actualizar, devolver los datos actuales
    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ 
        message: 'No hay cambios para aplicar',
        data: currentData
      });
    }
    
    // Construir la consulta de actualización dinámica
    let updateQuery = 'UPDATE materializaciones SET fecha_actualizacion = NOW()';
    const updateParams = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      updateQuery += `, ${key} = $${paramIndex}`;
      updateParams.push(value === null ? null : value);
      paramIndex++;
    }
    
    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    updateParams.push(id);
    
    const updateResult = await pool.query(updateQuery, updateParams);
    
    // Obtener el nombre de la casilla para incluirlo en la respuesta
    const updatedMaterialization = updateResult.rows[0];
    
    const casillaNameQuery = `SELECT nombre FROM casillas WHERE id = $1`;
    const casillaNameResult = await pool.query(casillaNameQuery, [updatedMaterialization.casilla_id]);
    
    if (casillaNameResult.rows.length > 0) {
      updatedMaterialization.nombre_casilla = casillaNameResult.rows[0].nombre;
    }
    
    return res.status(200).json(updatedMaterialization);
  } catch (error) {
    console.error('Error al actualizar materialización:', error);
    return res.status(500).json({ 
      message: 'Error interno al actualizar materialización', 
      error: error.message 
    });
  }
}

// DELETE: Eliminar una materialización
async function deleteMaterialization(req, res, id) {
  try {
    // Primero verificar que la materialización existe
    const checkQuery = `SELECT id FROM materializaciones WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    // Eliminar la materialización
    const deleteQuery = `DELETE FROM materializaciones WHERE id = $1`;
    await pool.query(deleteQuery, [id]);
    
    return res.status(200).json({ 
      message: 'Materialización eliminada correctamente',
      id
    });
  } catch (error) {
    console.error('Error al eliminar materialización:', error);
    return res.status(500).json({ 
      message: 'Error interno al eliminar materialización', 
      error: error.message 
    });
  }
}
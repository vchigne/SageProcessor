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
        m.tipo_materializacion,
        m.connection_id,
        m.cloud_provider_id,
        m.tabla_destino,
        m.schema_destino,
        m.formato_destino,
        m.estrategia_actualizacion,
        m.clave_primaria,
        m.particion_por,
        m.ultima_ejecucion,
        m.activado,
        m.creado_en,
        m.modificado_en,
        db.nombre AS nombre_casilla,
        dc.nombre AS connection_name,
        cp.nombre AS cloud_provider_name
      FROM 
        materializations m
      LEFT JOIN 
        data_boxes db ON m.casilla_id = db.id
      LEFT JOIN 
        database_connections dc ON m.connection_id = dc.id
      LEFT JOIN 
        cloud_providers cp ON m.cloud_provider_id = cp.id
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
    const checkQuery = `SELECT id FROM materializations WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    const {
      nombre,
      descripcion,
      tipo_materializacion,
      connection_id,
      cloud_provider_id,
      tabla_destino,
      schema_destino,
      formato_destino,
      estrategia_actualizacion,
      clave_primaria,
      particion_por,
      activado
    } = req.body;
    
    // Validar datos requeridos
    if (!nombre) {
      return res.status(400).json({ message: 'Nombre requerido' });
    }
    
    if (!tipo_materializacion) {
      return res.status(400).json({ message: 'Tipo de materialización requerido' });
    }
    
    if (!tabla_destino) {
      return res.status(400).json({ message: 'Tabla de destino requerida' });
    }
    
    // Validaciones específicas por tipo
    if (tipo_materializacion === 'database' && !connection_id) {
      return res.status(400).json({ message: 'ID de conexión a base de datos requerido' });
    }
    
    if (tipo_materializacion === 'cloud_datalake' && !cloud_provider_id) {
      return res.status(400).json({ message: 'ID de proveedor de nube requerido' });
    }
    
    // Actualizar la materialización
    const updateQuery = `
      UPDATE materializations
      SET 
        nombre = $1,
        descripcion = $2,
        tipo_materializacion = $3,
        connection_id = $4,
        cloud_provider_id = $5,
        tabla_destino = $6,
        schema_destino = $7,
        formato_destino = $8,
        estrategia_actualizacion = $9,
        clave_primaria = $10,
        particion_por = $11,
        activado = $12,
        modificado_en = NOW()
      WHERE id = $13
      RETURNING *
    `;
    
    const updateParams = [
      nombre,
      descripcion || null,
      tipo_materializacion,
      connection_id || null,
      cloud_provider_id || null,
      tabla_destino,
      schema_destino || null,
      formato_destino || null,
      estrategia_actualizacion || 'upsert',
      clave_primaria || null,
      particion_por || null,
      activado !== undefined ? activado : true,
      id
    ];
    
    const updateResult = await pool.query(updateQuery, updateParams);
    
    // Enriquecer la respuesta con nombres de entidades relacionadas
    const updatedMaterialization = updateResult.rows[0];
    
    if (updatedMaterialization.connection_id) {
      const connectionQuery = `SELECT nombre FROM database_connections WHERE id = $1`;
      const connectionResult = await pool.query(connectionQuery, [updatedMaterialization.connection_id]);
      
      if (connectionResult.rows.length > 0) {
        updatedMaterialization.connection_name = connectionResult.rows[0].nombre;
      }
    }
    
    if (updatedMaterialization.cloud_provider_id) {
      const providerQuery = `SELECT nombre FROM cloud_providers WHERE id = $1`;
      const providerResult = await pool.query(providerQuery, [updatedMaterialization.cloud_provider_id]);
      
      if (providerResult.rows.length > 0) {
        updatedMaterialization.cloud_provider_name = providerResult.rows[0].nombre;
      }
    }
    
    const casillaNameQuery = `SELECT nombre FROM data_boxes WHERE id = $1`;
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
    const checkQuery = `SELECT * FROM materializations WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    const currentData = checkResult.rows[0];
    const updates = {};
    const allowedFields = [
      'nombre', 'descripcion', 'tipo_materializacion', 'connection_id',
      'cloud_provider_id', 'tabla_destino', 'schema_destino', 'formato_destino',
      'estrategia_actualizacion', 'clave_primaria', 'particion_por', 'activado'
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
    let updateQuery = 'UPDATE materializations SET modificado_en = NOW()';
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
    
    // Enriquecer la respuesta con nombres de entidades relacionadas
    const updatedMaterialization = updateResult.rows[0];
    
    if (updatedMaterialization.connection_id) {
      const connectionQuery = `SELECT nombre FROM database_connections WHERE id = $1`;
      const connectionResult = await pool.query(connectionQuery, [updatedMaterialization.connection_id]);
      
      if (connectionResult.rows.length > 0) {
        updatedMaterialization.connection_name = connectionResult.rows[0].nombre;
      }
    }
    
    if (updatedMaterialization.cloud_provider_id) {
      const providerQuery = `SELECT nombre FROM cloud_providers WHERE id = $1`;
      const providerResult = await pool.query(providerQuery, [updatedMaterialization.cloud_provider_id]);
      
      if (providerResult.rows.length > 0) {
        updatedMaterialization.cloud_provider_name = providerResult.rows[0].nombre;
      }
    }
    
    const casillaNameQuery = `SELECT nombre FROM data_boxes WHERE id = $1`;
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
    const checkQuery = `SELECT id FROM materializations WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    // Eliminar la materialización
    const deleteQuery = `DELETE FROM materializations WHERE id = $1`;
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
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { executeSQL } from '@/utils/db';

/**
 * API para gestionar una materialización específica
 */
export default async function handler(req, res) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user.isAdmin) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  switch (req.method) {
    case 'GET':
      return getMaterialization(req, res, id);
    case 'PUT':
      return updateMaterialization(req, res, id);
    case 'PATCH':
      return patchMaterialization(req, res, id);
    case 'DELETE':
      return deleteMaterialization(req, res, id);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

/**
 * Obtener una materialización por ID
 */
async function getMaterialization(req, res, id) {
  try {
    const query = `
      SELECT 
        m.id, 
        m.nombre, 
        m.casilla_id,
        m.tipo_materializacion,
        m.tabla_origen,
        m.connection_id,
        m.tabla_destino,
        m.schema_destino,
        m.estrategia_actualizacion,
        m.columnas_clave,
        m.columnas_particion,
        m.formato_destino,
        m.configuracion_adicional,
        m.activado,
        m.ultima_ejecucion,
        m.errores,
        m.fecha_creacion,
        m.fecha_actualizacion,
        c.nombre as nombre_casilla,
        conn.nombre as connection_name,
        conn.tipo_servidor
      FROM 
        materializacion_configuraciones m
      LEFT JOIN 
        casillas c ON m.casilla_id = c.id
      LEFT JOIN 
        materializacion_db_connections conn ON m.connection_id = conn.id
      WHERE 
        m.id = $1
    `;
    
    const result = await executeSQL(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    // Transformar campos especiales
    const materialization = {
      ...result.rows[0],
      columnas_clave: parseJsonField(result.rows[0].columnas_clave),
      columnas_particion: parseJsonField(result.rows[0].columnas_particion),
      configuracion_adicional: parseJsonField(result.rows[0].configuracion_adicional),
      errores: parseJsonField(result.rows[0].errores)
    };
    
    return res.status(200).json(materialization);
  } catch (error) {
    console.error('Error al obtener materialización:', error);
    return res.status(500).json({ message: 'Error al obtener materialización' });
  }
}

/**
 * Actualizar una materialización completa
 */
async function updateMaterialization(req, res, id) {
  try {
    const { 
      nombre, 
      tipo_materializacion,
      connection_id,
      tabla_destino,
      schema_destino,
      estrategia_actualizacion,
      columnas_clave,
      columnas_particion,
      formato_destino,
      configuracion_adicional,
      activado
    } = req.body;
    
    // Validar campos obligatorios
    if (!nombre || !tipo_materializacion) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    
    // Verificar que la materialización existe
    const checkQuery = 'SELECT id FROM materializacion_configuraciones WHERE id = $1';
    const checkResult = await executeSQL(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    // Actualizar materialización
    const query = `
      UPDATE materializacion_configuraciones 
      SET 
        nombre = $1, 
        tipo_materializacion = $2, 
        connection_id = $3, 
        tabla_destino = $4, 
        schema_destino = $5,
        estrategia_actualizacion = $6,
        columnas_clave = $7,
        columnas_particion = $8,
        formato_destino = $9,
        configuracion_adicional = $10,
        activado = $11,
        fecha_actualizacion = NOW()
      WHERE 
        id = $12
      RETURNING id
    `;
    
    const values = [
      nombre,
      tipo_materializacion,
      connection_id || null,
      tabla_destino || null,
      schema_destino || null,
      estrategia_actualizacion || 'append',
      JSON.stringify(columnas_clave || []),
      JSON.stringify(columnas_particion || []),
      formato_destino || null,
      JSON.stringify(configuracion_adicional || {}),
      activado !== undefined ? activado : true,
      id
    ];
    
    await executeSQL(query, values);
    
    return res.status(200).json({ 
      id: parseInt(id), 
      message: 'Materialización actualizada correctamente' 
    });
  } catch (error) {
    console.error('Error al actualizar materialización:', error);
    return res.status(500).json({ message: 'Error al actualizar materialización' });
  }
}

/**
 * Actualizar parcialmente una materialización (PATCH)
 */
async function patchMaterialization(req, res, id) {
  try {
    // Obtener la materialización actual
    const getQuery = 'SELECT * FROM materializacion_configuraciones WHERE id = $1';
    const getResult = await executeSQL(getQuery, [id]);
    
    if (getResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    const current = getResult.rows[0];
    
    // Preparar campos a actualizar
    const updateFields = [];
    const values = [];
    let paramCounter = 1;
    
    // Iterar sobre los campos recibidos en el PATCH
    for (const [key, value] of Object.entries(req.body)) {
      // Solo permitir actualizar ciertos campos
      if (['nombre', 'activado', 'tabla_destino', 'schema_destino', 
           'estrategia_actualizacion', 'columnas_clave', 'columnas_particion', 
           'formato_destino', 'configuracion_adicional'].includes(key)) {
        
        // Para campos JSON, convertir a string
        if (['columnas_clave', 'columnas_particion', 'configuracion_adicional'].includes(key)) {
          updateFields.push(`${key} = $${paramCounter}`);
          values.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramCounter}`);
          values.push(value);
        }
        
        paramCounter++;
      }
    }
    
    // Si no hay campos para actualizar
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No se proporcionaron campos válidos para actualizar' });
    }
    
    // Añadir fecha de actualización
    updateFields.push(`fecha_actualizacion = NOW()`);
    
    // Construir la consulta
    const query = `
      UPDATE materializacion_configuraciones 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING id
    `;
    
    // Añadir ID a los valores
    values.push(id);
    
    await executeSQL(query, values);
    
    return res.status(200).json({ 
      id: parseInt(id), 
      message: 'Materialización actualizada correctamente' 
    });
  } catch (error) {
    console.error('Error al actualizar materialización:', error);
    return res.status(500).json({ message: 'Error al actualizar materialización' });
  }
}

/**
 * Eliminar una materialización
 */
async function deleteMaterialization(req, res, id) {
  try {
    // Verificar que la materialización existe
    const checkQuery = 'SELECT id FROM materializacion_configuraciones WHERE id = $1';
    const checkResult = await executeSQL(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    // Eliminar materialización
    const query = 'DELETE FROM materializacion_configuraciones WHERE id = $1 RETURNING id';
    await executeSQL(query, [id]);
    
    return res.status(200).json({ 
      id: parseInt(id), 
      message: 'Materialización eliminada correctamente' 
    });
  } catch (error) {
    console.error('Error al eliminar materialización:', error);
    return res.status(500).json({ message: 'Error al eliminar materialización' });
  }
}

/**
 * Parsea un campo JSON de la base de datos
 * 
 * @param {string} jsonField - Campo JSON como string
 * @returns {any} - Valor parseado o valor por defecto
 */
function parseJsonField(jsonField, defaultValue = []) {
  try {
    return jsonField ? JSON.parse(jsonField) : defaultValue;
  } catch (error) {
    console.error('Error al parsear campo JSON:', error);
    return defaultValue;
  }
}
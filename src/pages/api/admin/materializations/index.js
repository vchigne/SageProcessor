import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { executeSQL } from '@/utils/db';

/**
 * API para gestionar materializaciones
 */
export default async function handler(req, res) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user.isAdmin) {
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

/**
 * Obtener lista de materializaciones
 */
async function getMaterializations(req, res) {
  try {
    const { casilla_id } = req.query;
    
    let query = `
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
        c.nombre as nombre_casilla
      FROM 
        materializacion_configuraciones m
      LEFT JOIN 
        casillas c ON m.casilla_id = c.id
    `;
    
    let params = [];
    
    // Filtrar por casilla_id si se proporciona
    if (casilla_id) {
      query += ' WHERE m.casilla_id = $1';
      params.push(casilla_id);
    }
    
    query += ' ORDER BY m.fecha_creacion DESC';
    
    const result = await executeSQL(query, params);
    
    // Transformar campos especiales
    const materializations = result.rows.map(mat => ({
      ...mat,
      columnas_clave: parseJsonField(mat.columnas_clave),
      columnas_particion: parseJsonField(mat.columnas_particion),
      configuracion_adicional: parseJsonField(mat.configuracion_adicional),
      errores: parseJsonField(mat.errores)
    }));
    
    return res.status(200).json(materializations);
  } catch (error) {
    console.error('Error al obtener materializaciones:', error);
    return res.status(500).json({ message: 'Error al obtener materializaciones' });
  }
}

/**
 * Crear nueva materialización
 */
async function createMaterialization(req, res) {
  try {
    const { 
      nombre, 
      casilla_id,
      tipo_materializacion,
      tabla_origen,
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
    if (!nombre || !casilla_id || !tipo_materializacion || !tabla_origen) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    
    // Validaciones específicas según tipo de materialización
    if (tipo_materializacion === 'database') {
      if (!connection_id || !tabla_destino) {
        return res.status(400).json({ 
          message: 'Para materialización en base de datos se requiere connection_id y tabla_destino' 
        });
      }
    } else if (tipo_materializacion === 'cloud_datalake' || tipo_materializacion === 'local') {
      if (!formato_destino) {
        return res.status(400).json({ 
          message: 'Para materialización en data lake o local se requiere formato_destino' 
        });
      }
    }
    
    // Verificar que la casilla existe
    const casillaQuery = 'SELECT id FROM casillas WHERE id = $1';
    const casillaResult = await executeSQL(casillaQuery, [casilla_id]);
    
    if (casillaResult.rows.length === 0) {
      return res.status(400).json({ message: 'La casilla especificada no existe' });
    }
    
    // Verificar que la conexión existe (si aplica)
    if (connection_id) {
      const connectionQuery = 'SELECT id FROM materializacion_db_connections WHERE id = $1';
      const connectionResult = await executeSQL(connectionQuery, [connection_id]);
      
      if (connectionResult.rows.length === 0) {
        return res.status(400).json({ message: 'La conexión especificada no existe' });
      }
    }
    
    // Insertar la nueva materialización
    const query = `
      INSERT INTO materializacion_configuraciones (
        nombre, 
        casilla_id,
        tipo_materializacion,
        tabla_origen,
        connection_id,
        tabla_destino,
        schema_destino,
        estrategia_actualizacion,
        columnas_clave,
        columnas_particion,
        formato_destino,
        configuracion_adicional,
        activado
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;
    
    const values = [
      nombre,
      casilla_id,
      tipo_materializacion,
      tabla_origen,
      connection_id || null,
      tabla_destino || null,
      schema_destino || null,
      estrategia_actualizacion || 'append',
      JSON.stringify(columnas_clave || []),
      JSON.stringify(columnas_particion || []),
      formato_destino || null,
      JSON.stringify(configuracion_adicional || {}),
      activado !== undefined ? activado : true
    ];
    
    const result = await executeSQL(query, values);
    const materializationId = result.rows[0].id;
    
    // Obtener la materialización completa para devolver
    const getQuery = `
      SELECT 
        id, 
        nombre, 
        casilla_id,
        tipo_materializacion,
        tabla_origen,
        connection_id,
        tabla_destino,
        schema_destino,
        estrategia_actualizacion,
        columnas_clave,
        columnas_particion,
        formato_destino,
        configuracion_adicional,
        activado,
        fecha_creacion
      FROM 
        materializacion_configuraciones
      WHERE 
        id = $1
    `;
    
    const getResult = await executeSQL(getQuery, [materializationId]);
    
    if (getResult.rows.length === 0) {
      return res.status(500).json({ message: 'Error al recuperar la materialización creada' });
    }
    
    // Transformar campos especiales
    const materialization = {
      ...getResult.rows[0],
      columnas_clave: parseJsonField(getResult.rows[0].columnas_clave),
      columnas_particion: parseJsonField(getResult.rows[0].columnas_particion),
      configuracion_adicional: parseJsonField(getResult.rows[0].configuracion_adicional)
    };
    
    return res.status(201).json(materialization);
  } catch (error) {
    console.error('Error al crear materialización:', error);
    return res.status(500).json({ message: 'Error al crear materialización' });
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
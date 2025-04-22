import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { executeSQL } from '@/utils/db';

/**
 * API para gestionar materializaciones de una casilla específica
 */
export default async function handler(req, res) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user.isAdmin) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID de casilla inválido' });
  }

  // Verificar que la casilla existe
  try {
    const casillaQuery = 'SELECT id FROM casillas WHERE id = $1';
    const casillaResult = await executeSQL(casillaQuery, [id]);
    
    if (casillaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Casilla no encontrada' });
    }
  } catch (error) {
    console.error('Error al verificar casilla:', error);
    return res.status(500).json({ message: 'Error al verificar la existencia de la casilla' });
  }

  switch (req.method) {
    case 'GET':
      return getMaterializationsByCasilla(req, res, id);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

/**
 * Obtener materializaciones de una casilla específica
 */
async function getMaterializationsByCasilla(req, res, casillaId) {
  try {
    // Consultar materializaciones para la casilla
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
        c.nombre as connection_name,
        c.tipo_servidor
      FROM 
        materializacion_configuraciones m
      LEFT JOIN 
        materializacion_db_connections c ON m.connection_id = c.id
      WHERE 
        m.casilla_id = $1
      ORDER BY 
        m.fecha_creacion DESC
    `;
    
    const result = await executeSQL(query, [casillaId]);
    
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
    console.error('Error al obtener materializaciones de la casilla:', error);
    return res.status(500).json({ message: 'Error al obtener materializaciones de la casilla' });
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
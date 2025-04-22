import { Pool } from 'pg';

// Obtener la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend

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
    const casillaQuery = `SELECT id, nombre FROM data_boxes WHERE id = $1`;
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
        m.casilla_id = $1
      ORDER BY 
        m.creado_en DESC
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
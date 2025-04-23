import { Pool, Client } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper para ejecutar consultas SQL
async function executeSQL(query, params = []) {
  try {
    return await pool.query(query, params);
  } catch (error) {
    console.error('Error ejecutando SQL:', error);
    throw error;
  }
}

/**
 * API para listar las bases de datos disponibles en una conexión
 */
export default async function handler(req, res) {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { id } = req.query;
  
  // Validar que el ID sea un número
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID inválido' });
  }
  
  try {
    // Obtener información de la conexión y su secreto asociado
    const query = `
      SELECT 
        c.id, 
        c.nombre, 
        c.base_datos, 
        c.esquema,
        c.configuracion,
        s.id as secret_id,
        s.tipo,
        s.servidor,
        s.puerto,
        s.usuario,
        s.contrasena,
        s.opciones_conexion as secret_options
      FROM 
        database_connections c
      JOIN 
        db_secrets s ON c.secret_id = s.id
      WHERE 
        c.id = $1
    `;
    
    const result = await executeSQL(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conexión no encontrada' });
    }
    
    const connection = result.rows[0];
    
    // Redirigir a la API de bases de datos del secreto
    const secretId = connection.secret_id;
    
    // Reenviar la solicitud a la API de secretos para obtener las bases de datos
    try {
      // Hacer una solicitud interna a /api/admin/db-secrets/{secretId}/databases
      // Esto se hace a nivel de servidor para evitar CORS
      const response = await fetch(`${process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:5000'}/api/admin/db-secrets/${secretId}/databases`);
      const data = await response.json();
      
      return res.status(response.status).json(data);
    } catch (error) {
      console.error('Error al obtener bases de datos:', error);
      return res.status(500).json({ 
        message: 'Error al obtener bases de datos', 
        error: error.message 
      });
    }
  } catch (error) {
    console.error('Error al obtener información de conexión:', error);
    return res.status(500).json({ 
      message: 'Error al obtener información de conexión', 
      error: error.message 
    });
  }
}
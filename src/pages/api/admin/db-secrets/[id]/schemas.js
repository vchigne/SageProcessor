import { Pool, Client } from 'pg';

// Pool de conexión para BD local
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
 * API para listar esquemas de una base de datos PostgreSQL
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID de secreto inválido' });
  }

  try {
    // Obtener información del secreto
    const secret = await getSecret(parseInt(id));
    
    if (!secret) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    if (secret.tipo !== 'postgresql') {
      return res.status(400).json({ 
        message: 'Esta operación solo está disponible para bases de datos PostgreSQL' 
      });
    }
    
    // Listar esquemas
    const schemas = await listPostgresSchemas(secret);
    
    return res.status(200).json({ schemas });
  } catch (error) {
    console.error('Error al listar esquemas:', error);
    return res.status(500).json({ 
      message: 'Error al listar esquemas: ' + error.message 
    });
  }
}

/**
 * Obtiene un secreto de base de datos por ID
 */
async function getSecret(id) {
  try {
    const query = 'SELECT * FROM db_secrets WHERE id = $1';
    const result = await executeSQL(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error al obtener secreto:', error);
    throw error;
  }
}

/**
 * Lista los esquemas de una base de datos PostgreSQL
 */
async function listPostgresSchemas(secret) {
  // Siempre usar la base de datos postgres para esta consulta 
  // para evitar errores de conexión a bases de datos inexistentes
  const client = new Client({
    host: secret.servidor,
    port: secret.puerto,
    user: secret.usuario,
    password: secret.contrasena,
    database: 'postgres', // Siempre usar 'postgres' como base de datos para esta consulta
    // Timeout de conexión
    connectionTimeoutMillis: 5000,
  });
  
  try {
    await client.connect();
    
    // Consulta para listar esquemas
    const schemaQuery = `
      SELECT 
        schema_name 
      FROM 
        information_schema.schemata 
      WHERE 
        schema_name NOT LIKE 'pg_%' 
        AND schema_name != 'information_schema'
      ORDER BY 
        schema_name
    `;
    
    const result = await client.query(schemaQuery);
    
    return result.rows.map(row => row.schema_name);
  } catch (error) {
    console.error('Error al listar esquemas PostgreSQL:', error);
    throw error;
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignorar errores al cerrar la conexión
    }
  }
}
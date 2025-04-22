import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { executeSQL } from '@/utils/db';

/**
 * API para gestionar secretos de bases de datos
 */
export default async function handler(req, res) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user.isAdmin) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  switch (req.method) {
    case 'GET':
      return getDBSecrets(req, res);
    case 'POST':
      return createDBSecret(req, res);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

/**
 * Obtener lista de secretos de bases de datos
 */
async function getDBSecrets(req, res) {
  try {
    // Consultar secretos con recuento de bases de datos asociadas
    const query = `
      SELECT 
        s.id, 
        s.nombre, 
        s.descripcion, 
        s.tipo_servidor,
        s.activo,
        s.fecha_creacion,
        (
          SELECT COUNT(*) 
          FROM materializacion_db_connections 
          WHERE secret_id = s.id
        ) as database_count
      FROM 
        materializacion_db_secrets s
      ORDER BY 
        s.fecha_creacion DESC
    `;
    
    const result = await executeSQL(query);
    
    // No exponer información sensible
    const secrets = result.rows.map(secret => ({
      ...secret,
      configuracion: undefined, // No enviar configuración con credenciales
    }));
    
    return res.status(200).json(secrets);
  } catch (error) {
    console.error('Error al obtener secretos de BD:', error);
    return res.status(500).json({ message: 'Error al obtener secretos de bases de datos' });
  }
}

/**
 * Crear nuevo secreto de base de datos
 */
async function createDBSecret(req, res) {
  try {
    const { nombre, descripcion, tipo_servidor, configuracion, activo } = req.body;
    
    // Validar campos obligatorios
    if (!nombre || !tipo_servidor || !configuracion) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    
    // Insertar el nuevo secreto
    const query = `
      INSERT INTO materializacion_db_secrets (
        nombre, 
        descripcion, 
        tipo_servidor, 
        configuracion, 
        activo
      ) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const values = [
      nombre,
      descripcion || null,
      tipo_servidor,
      JSON.stringify(configuracion),
      activo !== undefined ? activo : true
    ];
    
    const result = await executeSQL(query, values);
    const secretId = result.rows[0].id;
    
    return res.status(201).json({ 
      id: secretId, 
      message: 'Secreto de base de datos creado correctamente' 
    });
  } catch (error) {
    console.error('Error al crear secreto de BD:', error);
    return res.status(500).json({ message: 'Error al crear secreto de base de datos' });
  }
}
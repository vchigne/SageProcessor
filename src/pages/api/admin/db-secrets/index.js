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
        s.tipo,
        s.estado,
        s.ultimo_test,
        s.fecha_creacion,
        (
          SELECT COUNT(*) 
          FROM database_connections 
          WHERE secret_id = s.id
        ) as database_count
      FROM 
        db_secrets s
      ORDER BY 
        s.fecha_creacion DESC
    `;
    
    const result = await executeSQL(query);
    
    // No exponer información sensible
    const secrets = result.rows.map(secret => ({
      ...secret,
      contrasena: undefined, // No enviar credenciales
    }));
    
    return res.status(200).json(secrets);
  } catch (error) {
    console.error('Error al obtener secretos de BD:', error);
    return res.status(500).json({ message: 'Error al obtener secretos de bases de datos' });
  }
}

/**
 * Crear un nuevo secreto de base de datos
 */
async function createDBSecret(req, res) {
  try {
    const { 
      nombre, 
      descripcion, 
      tipo, 
      servidor, 
      puerto, 
      usuario, 
      contrasena,
      basedatos,
      opciones_conexion
    } = req.body;
    
    // Validaciones básicas
    if (!nombre || !tipo || !servidor || !puerto || !usuario || !contrasena) {
      return res.status(400).json({ 
        message: 'Faltan campos obligatorios: nombre, tipo, servidor, puerto, usuario, contraseña' 
      });
    }

    // Validar que el tipo sea uno de los permitidos
    const tiposPermitidos = ['postgresql', 'mysql', 'mssql', 'duckdb'];
    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({ 
        message: `Tipo de base de datos no válido. Debe ser uno de: ${tiposPermitidos.join(', ')}` 
      });
    }
    
    // Insertar nuevo secreto
    const query = `
      INSERT INTO db_secrets (
        nombre, 
        descripcion, 
        tipo, 
        servidor, 
        puerto, 
        usuario, 
        contrasena,
        basedatos,
        opciones_conexion,
        estado,
        fecha_creacion,
        fecha_actualizacion
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING id
    `;
    
    const valores = [
      nombre,
      descripcion || '',
      tipo,
      servidor,
      puerto,
      usuario,
      contrasena,
      basedatos || '',
      opciones_conexion ? JSON.stringify(opciones_conexion) : '{}',
      'pendiente'
    ];
    
    const result = await executeSQL(query, valores);
    
    return res.status(201).json({ 
      id: result.rows[0].id,
      message: 'Secreto de base de datos creado correctamente' 
    });
  } catch (error) {
    console.error('Error al crear secreto de BD:', error);
    
    // Verificar si es un error de nombre duplicado
    if (error.code === '23505' && error.constraint.includes('nombre')) {
      return res.status(400).json({ 
        message: 'Ya existe un secreto con ese nombre' 
      });
    }
    
    return res.status(500).json({ 
      message: 'Error al crear secreto de base de datos' 
    });
  }
}
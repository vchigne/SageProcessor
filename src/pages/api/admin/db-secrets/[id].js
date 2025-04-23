import { Pool } from 'pg';

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
 * API para gestionar un secreto de base de datos específico
 */
export default async function handler(req, res) {
  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend
  
  const { id } = req.query;
  
  // Validar que el ID sea un número
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID inválido' });
  }
  
  switch (req.method) {
    case 'GET':
      return getDBSecret(req, res, id);
    case 'PUT':
      return updateDBSecret(req, res, id);
    case 'DELETE':
      return deleteDBSecret(req, res, id);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

/**
 * Obtener un secreto de base de datos específico
 */
async function getDBSecret(req, res, id) {
  try {
    const query = `
      SELECT 
        id, 
        nombre, 
        descripcion, 
        tipo, 
        servidor, 
        puerto, 
        usuario,
        basedatos,
        opciones_conexion,
        estado,
        ultimo_test,
        fecha_creacion,
        fecha_actualizacion
      FROM 
        db_secrets 
      WHERE 
        id = $1
    `;
    
    const result = await executeSQL(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    // No enviar la contraseña
    const secret = {
      ...result.rows[0],
      contrasena: '', // No enviar la contraseña real
    };
    
    return res.status(200).json(secret);
  } catch (error) {
    console.error('Error al obtener secreto de BD:', error);
    return res.status(500).json({ message: 'Error al obtener secreto de base de datos' });
  }
}

/**
 * Actualizar un secreto de base de datos
 */
async function updateDBSecret(req, res, id) {
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
    if (!nombre || !tipo || !servidor || !usuario) {
      return res.status(400).json({ 
        message: 'Faltan campos obligatorios: nombre, tipo, servidor, usuario' 
      });
    }
    
    // Asignar valores predeterminados según el tipo de base de datos
    let puertoFinal = puerto;
    if (!puertoFinal) {
      switch (tipo) {
        case 'postgresql':
          puertoFinal = '5432';
          break;
        case 'mysql':
          puertoFinal = '3306';
          break;
        case 'mssql':
          puertoFinal = '1433';
          break;
        case 'duckdb':
          puertoFinal = '0'; // DuckDB es embebido, no usa puerto
          break;
        default:
          puertoFinal = '0';
      }
    }
    
    // Validar que el tipo sea uno de los permitidos
    const tiposPermitidos = ['postgresql', 'mysql', 'mssql', 'duckdb'];
    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({ 
        message: `Tipo de base de datos no válido. Debe ser uno de: ${tiposPermitidos.join(', ')}` 
      });
    }
    
    // Verificar si existe el secreto
    const checkQuery = 'SELECT id FROM db_secrets WHERE id = $1';
    const checkResult = await executeSQL(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    // Definir campos y valores a actualizar
    let fields = [
      'nombre = $1',
      'descripcion = $2',
      'tipo = $3',
      'servidor = $4',
      'puerto = $5',
      'usuario = $6',
      'basedatos = $7',
      'opciones_conexion = $8',
      'fecha_actualizacion = NOW()',
      'estado = $9'
    ];
    
    let values = [
      nombre,
      descripcion || '',
      tipo,
      servidor,
      puertoFinal, // Usamos el puerto con valor predeterminado si no se especificó
      usuario,
      basedatos || '',
      opciones_conexion ? JSON.stringify(opciones_conexion) : '{}',
      'pendiente' // Resetear estado a pendiente después de actualizar
    ];
    
    // Solo actualizar contraseña si se proporciona una nueva
    if (contrasena) {
      fields.push('contrasena = $' + (values.length + 1));
      values.push(contrasena);
    }
    
    // Agregar el ID al final de los valores
    values.push(id);
    
    // Actualizar secreto
    const updateQuery = `
      UPDATE db_secrets 
      SET ${fields.join(', ')} 
      WHERE id = $${values.length}
      RETURNING id
    `;
    
    await executeSQL(updateQuery, values);
    
    return res.status(200).json({ 
      message: 'Secreto de base de datos actualizado correctamente' 
    });
  } catch (error) {
    console.error('Error al actualizar secreto de BD:', error);
    
    // Verificar si es un error de nombre duplicado
    if (error.code === '23505' && error.constraint.includes('nombre')) {
      return res.status(400).json({ 
        message: 'Ya existe un secreto con ese nombre' 
      });
    }
    
    return res.status(500).json({ 
      message: 'Error al actualizar secreto de base de datos' 
    });
  }
}

/**
 * Eliminar un secreto de base de datos
 */
async function deleteDBSecret(req, res, id) {
  try {
    // Verificar si el secreto está siendo utilizado por alguna conexión
    const checkUsageQuery = `
      SELECT COUNT(*) as count
      FROM database_connections
      WHERE secret_id = $1
    `;
    
    const usageResult = await executeSQL(checkUsageQuery, [id]);
    
    if (usageResult.rows[0].count > 0) {
      return res.status(400).json({ 
        message: 'No se puede eliminar el secreto porque está siendo utilizado por conexiones de bases de datos' 
      });
    }
    
    // Eliminar el secreto
    const deleteQuery = 'DELETE FROM db_secrets WHERE id = $1 RETURNING id';
    const result = await executeSQL(deleteQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    return res.status(200).json({ 
      message: 'Secreto de base de datos eliminado correctamente' 
    });
  } catch (error) {
    console.error('Error al eliminar secreto de BD:', error);
    
    if (error.code === '23503') { // Error de clave foránea
      return res.status(400).json({ 
        message: 'No se puede eliminar el secreto porque está siendo referenciado por otras entidades' 
      });
    }
    
    return res.status(500).json({ 
      message: 'Error al eliminar secreto de base de datos' 
    });
  }
}
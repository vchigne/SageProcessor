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

  switch (req.method) {
    case 'GET':
      return getMaterializations(req, res);
    case 'POST':
      return createMaterialization(req, res);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

// GET: Obtener todas las materializaciones o filtrar por casilla_id
async function getMaterializations(req, res) {
  try {
    const { casilla_id } = req.query;
    
    // Consulta base
    let query = `
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
    `;
    
    const params = [];
    
    // Filtrar por casilla_id si se proporciona
    if (casilla_id) {
      query += ` WHERE m.casilla_id = $1`;
      params.push(casilla_id);
    }
    
    query += ` ORDER BY m.creado_en DESC`;
    
    const result = await pool.query(query, params);
    
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener materializaciones:', error);
    return res.status(500).json({ 
      message: 'Error interno al obtener materializaciones', 
      error: error.message 
    });
  }
}

// POST: Crear una nueva materialización
async function createMaterialization(req, res) {
  try {
    const {
      casilla_id,
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
      activado = true
    } = req.body;
    
    // Validar datos requeridos
    if (!casilla_id) {
      return res.status(400).json({ message: 'ID de casilla requerido' });
    }
    
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
    
    // Comprobar si la casilla existe
    const casillaQuery = `SELECT id FROM data_boxes WHERE id = $1`;
    const casillaResult = await pool.query(casillaQuery, [casilla_id]);
    
    if (casillaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Casilla no encontrada' });
    }
    
    // Comprobar connection_id si es tipo database
    if (tipo_materializacion === 'database' && connection_id) {
      const connectionQuery = `SELECT id FROM database_connections WHERE id = $1`;
      const connectionResult = await pool.query(connectionQuery, [connection_id]);
      
      if (connectionResult.rows.length === 0) {
        return res.status(404).json({ message: 'Conexión de base de datos no encontrada' });
      }
    }
    
    // Comprobar cloud_provider_id si es tipo cloud_datalake
    if (tipo_materializacion === 'cloud_datalake' && cloud_provider_id) {
      const providerQuery = `SELECT id FROM cloud_providers WHERE id = $1`;
      const providerResult = await pool.query(providerQuery, [cloud_provider_id]);
      
      if (providerResult.rows.length === 0) {
        return res.status(404).json({ message: 'Proveedor de nube no encontrado' });
      }
    }
    
    // Insertar la nueva materialización
    const insertQuery = `
      INSERT INTO materializations (
        casilla_id,
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
        activado,
        creado_en,
        modificado_en
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
      ) RETURNING *
    `;
    
    const insertParams = [
      casilla_id,
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
      activado
    ];
    
    const result = await pool.query(insertQuery, insertParams);
    
    // Enriquecer la respuesta con nombres de entidades relacionadas
    const newMaterialization = result.rows[0];
    
    if (newMaterialization.connection_id) {
      const connectionQuery = `SELECT nombre FROM database_connections WHERE id = $1`;
      const connectionResult = await pool.query(connectionQuery, [newMaterialization.connection_id]);
      
      if (connectionResult.rows.length > 0) {
        newMaterialization.connection_name = connectionResult.rows[0].nombre;
      }
    }
    
    if (newMaterialization.cloud_provider_id) {
      const providerQuery = `SELECT nombre FROM cloud_providers WHERE id = $1`;
      const providerResult = await pool.query(providerQuery, [newMaterialization.cloud_provider_id]);
      
      if (providerResult.rows.length > 0) {
        newMaterialization.cloud_provider_name = providerResult.rows[0].nombre;
      }
    }
    
    const casillaNameQuery = `SELECT nombre FROM data_boxes WHERE id = $1`;
    const casillaNameResult = await pool.query(casillaNameQuery, [newMaterialization.casilla_id]);
    
    if (casillaNameResult.rows.length > 0) {
      newMaterialization.nombre_casilla = casillaNameResult.rows[0].nombre;
    }
    
    return res.status(201).json(newMaterialization);
  } catch (error) {
    console.error('Error al crear materialización:', error);
    return res.status(500).json({ 
      message: 'Error interno al crear materialización', 
      error: error.message 
    });
  }
}
import { conectarDB } from '../../../../utils/db';

export default async function handler(req, res) {
  // Solo aceptamos POST para crear nuevas materializaciones
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { nombre, descripcion, casilla_id, configuracion } = req.body;
    
    // Validar campos obligatorios
    if (!nombre || !casilla_id || !configuracion) {
      return res.status(400).json({ message: 'Faltan campos requeridos: nombre, casilla_id, configuracion' });
    }

    // Validar que la casilla_id es un número
    if (isNaN(parseInt(casilla_id))) {
      return res.status(400).json({ message: 'ID de casilla inválido' });
    }

    // Validar configuración mínima
    if (!configuracion.formato || !configuracion.columnas || !configuracion.destino || !configuracion.tablaDestino) {
      return res.status(400).json({ 
        message: 'La configuración debe incluir: formato, columnas, destino, tablaDestino' 
      });
    }

    const conn = await conectarDB();
    
    // Verificar que la casilla existe
    const casillaQuery = `SELECT * FROM casillas WHERE id = $1`;
    const casillaResult = await conn.query(casillaQuery, [casilla_id]);
    
    if (casillaResult.rows.length === 0) {
      return res.status(404).json({ message: 'La casilla especificada no existe' });
    }
    
    // Insertar la nueva materialización
    const query = `
      INSERT INTO materializaciones (
        nombre, 
        descripcion, 
        casilla_id, 
        configuracion,
        fecha_creacion,
        fecha_actualizacion
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;
    
    const result = await conn.query(query, [
      nombre,
      descripcion || '',
      casilla_id,
      configuracion
    ]);
    
    // Convertir configuración de JSONB a objeto JavaScript
    const materializacion = {
      ...result.rows[0],
      configuracion: result.rows[0].configuracion || {}
    };
    
    return res.status(201).json(materializacion);
  } catch (error) {
    console.error('Error al crear materialización:', error);
    return res.status(500).json({ message: 'Error al crear materialización', error: error.message });
  }
}
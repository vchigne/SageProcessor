import { pool } from '../../../../utils/db';

export default async function handler(req, res) {
  // POST - Crear nueva materialización
  if (req.method === 'POST') {
    try {
      const { nombre, descripcion, casilla_id, configuracion } = req.body;
      
      // Validar campos requeridos
      if (!nombre || !casilla_id || !configuracion) {
        return res.status(400).json({ message: 'Faltan campos requeridos' });
      }
      
      // Validar formato de los datos
      if (!configuracion.columnas || !Array.isArray(configuracion.columnas) || configuracion.columnas.length === 0) {
        return res.status(400).json({ message: 'Debe seleccionar al menos una columna' });
      }
      
      if (!configuracion.formato) {
        return res.status(400).json({ message: 'El formato es requerido' });
      }
      
      if (!configuracion.destino) {
        return res.status(400).json({ message: 'El destino es requerido' });
      }
      
      if (!configuracion.tablaDestino) {
        return res.status(400).json({ message: 'El nombre de la tabla/archivo de destino es requerido' });
      }
      
      // Insertar nueva materialización
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
      
      const { rows } = await pool.query(query, [
        nombre,
        descripcion || '',
        casilla_id,
        configuracion
      ]);
      
      // Convertir configuración de JSONB a objeto JavaScript
      const materialization = {
        ...rows[0],
        configuracion: rows[0].configuracion || {}
      };
      
      return res.status(201).json(materialization);
    } catch (error) {
      console.error('Error al crear materialización:', error);
      return res.status(500).json({ message: 'Error al crear materialización', error: error.message });
    }
  }
  
  // GET - Listar todas las materializaciones
  else if (req.method === 'GET') {
    try {
      const query = `
        SELECT * FROM materializaciones
        ORDER BY id ASC
      `;
      
      const { rows } = await pool.query(query);
      
      // Convertir configuración de JSONB a objeto JavaScript para cada materialización
      const materializations = rows.map(row => ({
        ...row,
        configuracion: row.configuracion || {}
      }));
      
      return res.status(200).json(materializations);
    } catch (error) {
      console.error('Error al obtener materializaciones:', error);
      return res.status(500).json({ message: 'Error al obtener materializaciones', error: error.message });
    }
  }
  
  // Método no soportado
  else {
    return res.status(405).json({ message: 'Método no permitido' });
  }
}
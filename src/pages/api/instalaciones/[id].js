import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  const { method } = req
  const { id } = req.query

  try {
    switch (method) {
      case 'PUT':
        const { organizacion_id, pais_id, producto_id } = req.body

        if (!organizacion_id || !pais_id || !producto_id) {
          return res.status(400).json({ 
            error: 'Organización, país y producto son requeridos' 
          })
        }

        // Primero obtenemos los nombres para construir el nombre completo
        const nombresQuery = await pool.query(`
          SELECT 
            o.nombre as organizacion,
            p.nombre as producto,
            pa.nombre as pais
          FROM organizaciones o, productos p, paises pa
          WHERE o.id = $1 AND p.id = $2 AND pa.id = $3
        `, [organizacion_id, producto_id, pais_id]);
        
        if (nombresQuery.rows.length === 0) {
          return res.status(400).json({ 
            error: 'No se encontraron los registros de organización, producto o país' 
          });
        }
        
        // Construir el nombre completo
        const { organizacion, producto, pais } = nombresQuery.rows[0];
        const nombreCompleto = `${producto} - ${organizacion} (${pais})`;
        
        // Actualizar la instalación con el nombre completo
        const result = await pool.query(
          `UPDATE instalaciones 
           SET organizacion_id = $1, pais_id = $2, producto_id = $3, nombre = $4 
           WHERE id = $5 RETURNING *`,
          [organizacion_id, pais_id, producto_id, nombreCompleto, id]
        )

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Instalación no encontrada' })
        }

        return res.status(200).json(result.rows[0])

      default:
        res.setHeader('Allow', ['PUT'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error in API instalaciones:', error)
    return res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
}

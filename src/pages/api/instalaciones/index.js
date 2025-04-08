import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  const { method } = req

  try {
    switch (method) {
      case 'GET':
        const { rows } = await pool.query(`
          SELECT 
            i.id,
            i.organizacion_id,
            i.pais_id,
            i.producto_id,
            i.nombre,
            o.nombre as organizacion,
            p.nombre as producto,
            pais.nombre as pais
          FROM instalaciones i
          JOIN organizaciones o ON i.organizacion_id = o.id
          JOIN productos p ON i.producto_id = p.id
          JOIN paises pais ON i.pais_id = pais.id
          ORDER BY i.nombre, o.nombre, p.nombre
        `)
        return res.status(200).json(rows)

      case 'POST':
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
        
        // Crear la instalación con el nombre completo
        const result = await pool.query(
          'INSERT INTO instalaciones (organizacion_id, pais_id, producto_id, nombre) VALUES ($1, $2, $3, $4) RETURNING *',
          [organizacion_id, pais_id, producto_id, nombreCompleto]
        )
        return res.status(201).json(result.rows[0])

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error en API instalaciones:', error)
    return res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
}
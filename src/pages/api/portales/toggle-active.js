import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  const { method } = req

  // Solo permitimos PUT
  if (method !== 'PUT') {
    res.setHeader('Allow', ['PUT'])
    return res.status(405).end(`Method ${method} Not Allowed`)
  }

  try {
    const { id, activo } = req.body

    if (id === undefined || activo === undefined) {
      return res.status(400).json({
        error: 'Se requiere el ID del portal y el estado activo/inactivo'
      })
    }

    // Actualizar el estado del portal
    const query = `
      UPDATE portales
      SET activo = $1
      WHERE id = $2
      RETURNING id, uuid, nombre, activo
    `
    
    const result = await pool.query(query, [activo, id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal no encontrado' })
    }

    return res.status(200).json(result.rows[0])
  } catch (error) {
    console.error('Error al cambiar estado del portal:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}
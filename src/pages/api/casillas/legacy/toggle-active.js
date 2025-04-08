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
    const { id, is_active } = req.body

    if (id === undefined || is_active === undefined) {
      return res.status(400).json({
        error: 'Se requiere el ID de la casilla y el estado activo/inactivo'
      })
    }

    // Actualizar el estado de la casilla
    const query = `
      UPDATE casillas
      SET is_active = $1
      WHERE id = $2
      RETURNING id, nombre_yaml, is_active
    `
    
    const result = await pool.query(query, [is_active, id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Casilla no encontrada' })
    }

    return res.status(200).json(result.rows[0])
  } catch (error) {
    console.error('Error al cambiar estado de casilla:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}
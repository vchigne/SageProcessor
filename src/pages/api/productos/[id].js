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
        const { nombre } = req.body

        if (!nombre) {
          return res.status(400).json({ 
            error: 'El nombre es requerido' 
          })
        }

        const result = await pool.query(
          'UPDATE productos SET nombre = $1 WHERE id = $2 RETURNING *',
          [nombre, id]
        )

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Producto no encontrado' })
        }

        return res.status(200).json(result.rows[0])

      default:
        res.setHeader('Allow', ['PUT'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error in API productos:', error)
    return res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
}

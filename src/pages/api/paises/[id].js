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
        const { codigo_iso, nombre, es_territorio_personalizado } = req.body

        if (!codigo_iso || !nombre) {
          return res.status(400).json({ 
            error: 'El código ISO y nombre son requeridos' 
          })
        }

        const result = await pool.query(
          `UPDATE paises 
           SET codigo_iso = $1, nombre = $2, es_territorio_personalizado = $3 
           WHERE id = $4 RETURNING *`,
          [codigo_iso, nombre, es_territorio_personalizado, id]
        )

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'País no encontrado' })
        }

        return res.status(200).json(result.rows[0])

      default:
        res.setHeader('Allow', ['PUT'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error in API paises:', error)
    return res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
}

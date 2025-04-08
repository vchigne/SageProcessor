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
          SELECT id, nombre, creado_en
          FROM organizaciones 
          ORDER BY nombre
        `)
        return res.status(200).json(rows)

      case 'POST':
        const { nombre } = req.body

        if (!nombre) {
          return res.status(400).json({ error: 'El nombre es requerido' })
        }

        const result = await pool.query(
          'INSERT INTO organizaciones (nombre, creado_en) VALUES ($1, NOW()) RETURNING *',
          [nombre]
        )
        return res.status(201).json(result.rows[0])

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error in API organizaciones:', error)
    return res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
}
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
          SELECT id, codigo_iso, nombre, es_territorio_personalizado
          FROM paises 
          ORDER BY nombre
        `)
        return res.status(200).json(rows)

      case 'POST':
        const { codigo_iso, nombre, es_territorio_personalizado = false } = req.body

        if (!codigo_iso || !nombre) {
          return res.status(400).json({ 
            error: 'El código ISO y nombre son requeridos' 
          })
        }

        const result = await pool.query(
          `INSERT INTO paises (codigo_iso, nombre, es_territorio_personalizado) 
           VALUES ($1, $2, $3) RETURNING *`,
          [codigo_iso, nombre, es_territorio_personalizado]
        )
        return res.status(201).json(result.rows[0])

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error in API paises:', error)
    return res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
}

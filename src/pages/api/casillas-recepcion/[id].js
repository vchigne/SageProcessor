import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  const { method } = req
  const { id } = req.query

  try {
    switch (method) {
      case 'GET':
        const { rows } = await pool.query(`
          SELECT 
            cr.id,
            cr.nombre_yaml,
            cr.email_casilla,
            cr.instalacion_id,
            cr.api_endpoint,
            cr.api_key,
            o.nombre as organizacion,
            p.nombre as producto,
            pais.nombre as pais
          FROM casillas cr
          LEFT JOIN instalaciones i ON cr.instalacion_id = i.id 
          LEFT JOIN organizaciones o ON i.organizacion_id = o.id
          LEFT JOIN productos p ON i.producto_id = p.id
          LEFT JOIN paises pais ON i.pais_id = pais.id
          WHERE cr.id = $1 AND cr.is_active = true
        `, [id])

        if (rows.length === 0) {
          return res.status(404).json({ error: 'Casilla no encontrada' })
        }

        return res.status(200).json(rows[0])

      default:
        res.setHeader('Allow', ['GET'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error en API casillas-recepcion:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}

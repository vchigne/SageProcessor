import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  const { method } = req

  // Solo permitimos GET
  if (method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end(`Method ${method} Not Allowed`)
  }

  try {
    const { id } = req.query

    if (!id) {
      return res.status(400).json({
        error: 'Se requiere el ID del portal'
      })
    }

    // Obtener la información del portal
    const query = `
      SELECT 
        id,
        uuid,
        nombre
      FROM portales
      WHERE id = $1
    `
    
    const result = await pool.query(query, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal no encontrado' })
    }

    // Construir el enlace
    const portal = result.rows[0]
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'
    const portalLink = `${baseUrl}/portal-externo/${portal.uuid}`

    return res.status(200).json({ 
      id: portal.id,
      uuid: portal.uuid,
      nombre: portal.nombre,
      portal_link: portalLink
    })
  } catch (error) {
    console.error('Error al obtener enlace del portal:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}
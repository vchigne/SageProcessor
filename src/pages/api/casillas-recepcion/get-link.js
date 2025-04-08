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
        error: 'Se requiere el ID de la casilla'
      })
    }

    // Obtener la instalación asociada con la casilla
    const query = `
      SELECT 
        cr.id as casilla_id,
        cr.nombre_yaml,
        p.uuid as portal_uuid
      FROM casillas cr
      JOIN instalaciones i ON cr.instalacion_id = i.id
      JOIN portales p ON i.id = p.instalacion_id
      WHERE cr.id = $1
    `
    
    const result = await pool.query(query, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Casilla no encontrada o no asociada a un portal' })
    }

    // Construir el enlace
    const casilla = result.rows[0]
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'
    const portalLink = `${baseUrl}/portal-externo/${casilla.portal_uuid}`

    return res.status(200).json({ 
      casilla_id: casilla.casilla_id,
      nombre_yaml: casilla.nombre_yaml,
      portal_uuid: casilla.portal_uuid,
      portal_link: portalLink
    })
  } catch (error) {
    console.error('Error al obtener enlace de casilla:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  const { method } = req
  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Se requiere el ID del responsable' })
  }

  try {
    switch (method) {
      case 'GET':
        const { rows } = await pool.query(`
          SELECT 
            id,
            emisor_id,
            casilla_recepcion_id as casilla_id,
            responsable_nombre,
            responsable_email,
            responsable_telefono,
            configuracion_frecuencia,
            frecuencia_tipo_id,
            responsable_activo as activo,
            created_at,
            updated_at
          FROM emisores_por_casilla 
          WHERE id = $1 AND responsable_nombre IS NOT NULL
        `, [id])
        
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Responsable no encontrado' })
        }
        
        return res.status(200).json(rows[0])

      case 'PUT':
        const {
          responsable_nombre,
          responsable_email,
          responsable_telefono,
          emisor_id,
          casilla_id,
          configuracion_frecuencia,
          frecuencia_tipo_id,
          activo
        } = req.body

        // Validar los datos requeridos
        if (!responsable_nombre || !responsable_email || !emisor_id || !casilla_id) {
          return res.status(400).json({ 
            error: 'Faltan campos requeridos' 
          })
        }

        try {
          const { rows: [updatedResponsable] } = await pool.query(
            `UPDATE emisores_por_casilla SET
              responsable_nombre = $1,
              responsable_email = $2,
              responsable_telefono = $3,
              emisor_id = $4,
              casilla_recepcion_id = $5,
              configuracion_frecuencia = $6,
              frecuencia_tipo_id = $7,
              responsable_activo = $8,
              updated_at = NOW()
            WHERE id = $9
            RETURNING 
              id, 
              emisor_id, 
              casilla_recepcion_id as casilla_id, 
              responsable_nombre,
              responsable_email,
              responsable_telefono,
              configuracion_frecuencia,
              frecuencia_tipo_id,
              responsable_activo as activo,
              created_at,
              updated_at`,
            [
              responsable_nombre,
              responsable_email,
              responsable_telefono || null,
              emisor_id,
              casilla_id,
              configuracion_frecuencia,
              frecuencia_tipo_id,
              activo !== undefined ? activo : true,
              id
            ]
          )

          if (!updatedResponsable) {
            return res.status(404).json({ error: 'Responsable no encontrado' })
          }

          console.log('Responsable actualizado:', updatedResponsable)
          return res.status(200).json(updatedResponsable)
        } catch (dbError) {
          console.error('Error detallado:', dbError)
          return res.status(400).json({ 
            error: 'Error al actualizar el responsable. ' + (dbError.message || 'Verifique los datos e intente nuevamente.')
          })
        }

      case 'DELETE':
        await pool.query(
          'UPDATE emisores_por_casilla SET responsable_activo = false, updated_at = NOW() WHERE id = $1',
          [id]
        )
        return res.status(200).json({ message: 'Responsable desactivado exitosamente' })

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error en API responsables/[id]:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor al procesar la solicitud' 
    })
  }
}
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
          SELECT 
            me.id,
            me.emisor_id,
            me.casilla_recepcion_id as casilla_id,
            me.responsable_nombre,
            me.responsable_email,
            me.responsable_telefono,
            me.configuracion_frecuencia,
            me.frecuencia_tipo_id,
            me.responsable_activo as activo,
            me.created_at,
            me.updated_at,
            e.nombre as emisor,
            cr.nombre_yaml as casilla,
            o.nombre as organizacion,
            i.id as instalacion_id,
            p.nombre as producto,
            pais.nombre as pais
          FROM emisores_por_casilla me
          JOIN emisores e ON me.emisor_id = e.id
          JOIN casillas cr ON me.casilla_recepcion_id = cr.id
          JOIN organizaciones o ON e.organizacion_id = o.id
          JOIN instalaciones i ON cr.instalacion_id = i.id
          JOIN paises pais ON i.pais_id = pais.id
          JOIN productos p ON i.producto_id = p.id
          WHERE me.responsable_nombre IS NOT NULL
          AND me.responsable_activo = true
          ORDER BY me.created_at DESC
        `)
        return res.status(200).json(rows)

      case 'POST':
        const {
          responsable_nombre,
          responsable_email,
          responsable_telefono,
          emisor_id,
          casilla_id,
          configuracion_frecuencia,
          frecuencia_tipo_id,
          metodo_envio = 'email',  // Valor por defecto
          parametros = {},         // Valor por defecto
          activo = true
        } = req.body

        // Validar los datos requeridos
        if (!responsable_nombre || !responsable_email || !emisor_id || !casilla_id) {
          return res.status(400).json({ 
            error: 'Faltan campos requeridos' 
          })
        }

        try {
          // Verificar si ya existe un registro para este emisor y casilla
          const { rows: existingRecords } = await pool.query(
            `SELECT id FROM emisores_por_casilla 
             WHERE emisor_id = $1 AND casilla_recepcion_id = $2`,
            [emisor_id, casilla_id]
          )
          
          let newResponsable;
          
          if (existingRecords.length > 0) {
            // Actualizar el registro existente
            const { rows: [updated] } = await pool.query(
              `UPDATE emisores_por_casilla SET
                responsable_nombre = $1,
                responsable_email = $2,
                responsable_telefono = $3,
                configuracion_frecuencia = $4,
                frecuencia_tipo_id = $5,
                responsable_activo = $6,
                updated_at = NOW()
               WHERE emisor_id = $7 AND casilla_recepcion_id = $8
               RETURNING *`,
              [
                responsable_nombre,
                responsable_email,
                responsable_telefono || null,
                configuracion_frecuencia,
                frecuencia_tipo_id,
                activo,
                emisor_id,
                casilla_id
              ]
            )
            newResponsable = updated;
          } else {
            // Crear un nuevo registro
            const { rows: [created] } = await pool.query(
              `INSERT INTO emisores_por_casilla (
                emisor_id,
                casilla_recepcion_id,
                metodo_envio,
                parametros,
                responsable_nombre,
                responsable_email,
                responsable_telefono,
                configuracion_frecuencia,
                frecuencia_tipo_id,
                responsable_activo
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              RETURNING *`,
              [
                emisor_id,
                casilla_id,
                metodo_envio,
                parametros,
                responsable_nombre,
                responsable_email,
                responsable_telefono || null,
                configuracion_frecuencia,
                frecuencia_tipo_id,
                activo
              ]
            )
            newResponsable = created;
          }

          console.log('Responsable guardado:', newResponsable)
          return res.status(201).json(newResponsable)
        } catch (dbError) {
          console.error('Error detallado:', dbError)
          return res.status(400).json({ 
            error: 'Error al guardar el responsable. ' + (dbError.message || 'Verifique los datos e intente nuevamente.')
          })
        }

      case 'DELETE':
        const responsableId = req.query.id
        await pool.query(
          'UPDATE emisores_por_casilla SET responsable_activo = false, updated_at = NOW() WHERE id = $1',
          [responsableId]
        )
        return res.status(200).json({ message: 'Responsable desactivado exitosamente' })

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error en API responsables:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor al procesar la solicitud' 
    })
  }
}
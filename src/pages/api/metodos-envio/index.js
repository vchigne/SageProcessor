import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  const { method } = req

  try {
    switch (method) {
      case 'GET':
        const { casilla_id, emisor_id } = req.query

        // Si se proporciona casilla_id y emisor_id, obtener métodos específicos
        if (casilla_id && emisor_id) {
          const { rows } = await pool.query(`
            SELECT 
              me.*,
              e.nombre as emisor_nombre,
              cr.nombre_yaml,
              cr.email_casilla,
              cr.api_endpoint,
              cr.api_key
            FROM emisores_por_casilla me
            JOIN emisores e ON me.emisor_id = e.id
            JOIN casillas cr ON me.casilla_id = cr.id
            WHERE me.casilla_id = $1 AND me.emisor_id = $2
          `, [casilla_id, emisor_id])
          return res.status(200).json(rows)
        }

        // Si solo se proporciona casilla_id, obtener todos los métodos de la casilla
        if (casilla_id) {
          const { rows } = await pool.query(`
            SELECT 
              me.*,
              e.nombre as emisor_nombre,
              cr.nombre_yaml,
              cr.email_casilla,
              cr.api_endpoint,
              cr.api_key
            FROM emisores_por_casilla me
            JOIN emisores e ON me.emisor_id = e.id
            JOIN casillas cr ON me.casilla_id = cr.id
            WHERE me.casilla_id = $1
          `, [casilla_id])
          return res.status(200).json(rows)
        }

        // Si no hay casilla_id, obtener conteo de emisores por casilla
        const { rows } = await pool.query(`
          SELECT 
            cr.id as casilla_id,
            COUNT(DISTINCT me.emisor_id) as emisores_count
          FROM casillas cr
          LEFT JOIN emisores_por_casilla me ON cr.id = me.casilla_id
          GROUP BY cr.id
        `)

        return res.status(200).json(rows)

      case 'POST':
        const { 
          casilla_id: casillaId, 
          emisor_id: emisorId, 
          metodos,
          responsable_nombre,
          responsable_email,
          responsable_telefono,
          configuracion_frecuencia
        } = req.body

        // Validar datos requeridos para los métodos
        if (!casillaId || !emisorId || !metodos || !Array.isArray(metodos)) {
          return res.status(400).json({ 
            error: 'Faltan campos requeridos o formato inválido' 
          })
        }

        // Comenzar transacción
        const client = await pool.connect()
        try {
          await client.query('BEGIN')

          // Buscar si ya hay un registro para este emisor-casilla
          const { rows: existingMethods } = await client.query(
            'SELECT id, responsable_nombre, configuracion_frecuencia FROM emisores_por_casilla WHERE casilla_id = $1 AND emisor_id = $2',
            [casillaId, emisorId]
          )

          // Verificar si hay datos existentes
          const hasExistingData = existingMethods.length > 0;

          // Eliminar métodos existentes
          await client.query(
            'DELETE FROM emisores_por_casilla WHERE casilla_id = $1 AND emisor_id = $2',
            [casillaId, emisorId]
          )

          // Insertar nuevos métodos con datos adicionales
          for (const { metodo, parametros } of metodos) {
            await client.query(
              `INSERT INTO emisores_por_casilla (
                casilla_id,
                emisor_id,
                metodo_envio,
                parametros,
                responsable_nombre,
                responsable_email,
                responsable_telefono,
                configuracion_frecuencia
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                casillaId, 
                emisorId, 
                metodo, 
                parametros,
                responsable_nombre || null,
                responsable_email || null,
                responsable_telefono || null,
                configuracion_frecuencia || null
              ]
            )
          }

          await client.query('COMMIT')
          return res.status(200).json({ message: 'Métodos de envío actualizados exitosamente' })
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally {
          client.release()
        }

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error en API metodos-envio:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor al procesar la solicitud' 
    })
  }
}
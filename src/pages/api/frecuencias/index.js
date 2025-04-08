import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  const { method } = req

  try {
    switch (method) {
      case 'GET':
        const { tipo } = req.query
        if (tipo === 'frecuencias') {
          const { rows } = await pool.query(
            'SELECT * FROM frecuencias_tipo WHERE activo = true ORDER BY nombre'
          )
          return res.status(200).json(rows)
        } else {
          const { rows } = await pool.query(`
            SELECT 
              me.id, 
              me.emisor_id, 
              me.casilla_id, 
              me.responsable_nombre, 
              me.responsable_email, 
              me.responsable_telefono,
              me.configuracion_frecuencia, 
              me.frecuencia_tipo_id,
              me.responsable_activo as activo,
              me.created_at,
              me.updated_at,
              ft.nombre as frecuencia_nombre, 
              e.nombre as emisor_nombre, 
              cr.nombre_yaml as casilla_nombre
            FROM emisores_por_casilla me
            LEFT JOIN frecuencias_tipo ft ON me.frecuencia_tipo_id = ft.id
            JOIN emisores e ON me.emisor_id = e.id
            JOIN casillas cr ON me.casilla_id = cr.id
            WHERE me.responsable_nombre IS NOT NULL
            AND me.responsable_activo = true
            ORDER BY e.nombre, cr.nombre_yaml
          `)
          return res.status(200).json(rows)
        }

      case 'POST':
        const { body } = req
        if (body.tipo === 'frecuencia') {
          const { nombre, descripcion } = body
          const { rows: [newFrecuencia] } = await pool.query(
            'INSERT INTO frecuencias_tipo (nombre, descripcion) VALUES ($1, $2) RETURNING *',
            [nombre, descripcion]
          )
          return res.status(201).json(newFrecuencia)
        } else {
          const { 
            emisor_id, 
            casilla_id, 
            responsable_nombre, 
            responsable_email,
            responsable_telefono,
            frecuencia_tipo_id,
            configuracion_frecuencia,
            metodo_envio = 'email',  // Valor por defecto
            parametros = {}          // Valor por defecto
          } = body
          
          // Verificar si ya existe un registro para este emisor y casilla
          const { rows: existingRecords } = await pool.query(
            `SELECT id FROM emisores_por_casilla 
             WHERE emisor_id = $1 AND casilla_id = $2`,
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
                responsable_activo = true,
                updated_at = NOW()
               WHERE emisor_id = $6 AND casilla_id = $7
               RETURNING *`,
              [
                responsable_nombre,
                responsable_email,
                responsable_telefono || null,
                configuracion_frecuencia,
                frecuencia_tipo_id,
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
                casilla_id,
                metodo_envio,
                parametros,
                responsable_nombre,
                responsable_email,
                responsable_telefono,
                configuracion_frecuencia,
                frecuencia_tipo_id,
                responsable_activo
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
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
                frecuencia_tipo_id
              ]
            )
            newResponsable = created;
          }
          
          return res.status(201).json(newResponsable)
        }

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error en API de frecuencias:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Lista de tipos de emisor permitidos
const TIPOS_EMISOR_PERMITIDOS = [
  'interno',
  'corporativo',
  'distribuidora',
  'bot',
  'cadena mt',
  'eccomerce',
  'erp',
  'otros'
];

export default async function handler(req, res) {
  const { method } = req

  try {
    switch (method) {
      case 'GET':
        const { rows } = await pool.query(`
          SELECT 
            id, 
            nombre, 
            tipo_emisor,
            email_corporativo,
            telefono,
            organizacion_id,
            creado_en,
            COALESCE(activo, true) as activo
          FROM emisores 
          ORDER BY nombre
        `)
        return res.status(200).json(rows)

      case 'POST':
        const { 
          nombre, 
          tipo_emisor,
          email_corporativo,
          telefono,
          organizacion_id,
          activo = true
        } = req.body

        // Validar que el tipo_emisor sea uno de los permitidos
        const tipo_emisor_normalizado = tipo_emisor.toLowerCase();
        if (!TIPOS_EMISOR_PERMITIDOS.includes(tipo_emisor_normalizado)) {
          return res.status(400).json({ 
            error: `Tipo de emisor no válido. Debe ser uno de: ${TIPOS_EMISOR_PERMITIDOS.join(', ')}` 
          });
        }

        const { rows: [newEmisor] } = await pool.query(
          `INSERT INTO emisores (
            nombre, 
            tipo_emisor,
            email_corporativo,
            telefono,
            organizacion_id,
            activo
          ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [nombre, tipo_emisor_normalizado, email_corporativo, telefono, organizacion_id, activo]
        )
        return res.status(201).json(newEmisor)

      case 'PUT':
        const { id, ...updateData } = req.body

        // Validar tipo_emisor si se está actualizando
        if (updateData.tipo_emisor) {
          const tipo_actualizado = updateData.tipo_emisor.toLowerCase();
          if (!TIPOS_EMISOR_PERMITIDOS.includes(tipo_actualizado)) {
            return res.status(400).json({ 
              error: `Tipo de emisor no válido. Debe ser uno de: ${TIPOS_EMISOR_PERMITIDOS.join(', ')}` 
            });
          }
          updateData.tipo_emisor = tipo_actualizado;
        }

        const { rows: [updatedEmisor] } = await pool.query(
          `UPDATE emisores 
           SET nombre = $1, 
               tipo_emisor = $2,
               email_corporativo = $3,
               telefono = $4,
               organizacion_id = $5,
               activo = $6
           WHERE id = $7
           RETURNING *`,
          [
            updateData.nombre,
            updateData.tipo_emisor,
            updateData.email_corporativo,
            updateData.telefono,
            updateData.organizacion_id,
            updateData.activo,
            id
          ]
        )
        if (!updatedEmisor) {
          return res.status(404).json({ error: 'Emisor not found' })
        }
        return res.status(200).json(updatedEmisor)

      case 'DELETE':
        const { id: deleteId } = req.query
        const { rowCount } = await pool.query(
          'DELETE FROM emisores WHERE id = $1',
          [deleteId]
        )
        if (rowCount === 0) {
          return res.status(404).json({ error: 'Emisor not found' })
        }
        return res.status(200).json({ message: 'Emisor deleted successfully' })

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error in API emisores:', error)
    return res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
}
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

// Tipos de origen de datos permitidos
const TIPOS_ORIGEN_PERMITIDOS = ['sftp', 'bucket', null];

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
            COALESCE(activo, true) as activo,
            codigo_interno,
            codigo_agente_merlin,
            tipo_origen,
            sftp_servidor,
            sftp_puerto,
            sftp_usuario,
            sftp_directorio,
            cloud_secret_id,
            bucket_nombre
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
          activo = true,
          codigo_interno,
          codigo_agente_merlin,
          tipo_origen,
          sftp_servidor,
          sftp_puerto = 22,
          sftp_usuario,
          sftp_clave,
          sftp_directorio,
          cloud_secret_id,
          bucket_nombre
        } = req.body

        // Validar que el tipo_emisor sea uno de los permitidos
        const tipo_emisor_normalizado = tipo_emisor.toLowerCase();
        if (!TIPOS_EMISOR_PERMITIDOS.includes(tipo_emisor_normalizado)) {
          return res.status(400).json({ 
            error: `Tipo de emisor no válido. Debe ser uno de: ${TIPOS_EMISOR_PERMITIDOS.join(', ')}` 
          });
        }
        
        // Validar el código interno (solo letras minúsculas, números, puntos)
        if (codigo_interno && !/^[a-z0-9.-]+$/.test(codigo_interno)) {
          return res.status(400).json({
            error: 'Código interno inválido. Use solo letras minúsculas, números, puntos y guiones.'
          });
        }
        
        // Validar tipo de origen si está presente
        if (tipo_origen) {
          // Dividir el tipo_origen si contiene varios valores separados por comas
          const tiposOrigen = tipo_origen.split(',').filter(Boolean);
          
          // Verificar que todos los tipos sean válidos
          for (const tipo of tiposOrigen) {
            if (!TIPOS_ORIGEN_PERMITIDOS.includes(tipo)) {
              return res.status(400).json({
                error: `Tipo de origen no válido: ${tipo}. Debe ser uno de: ${TIPOS_ORIGEN_PERMITIDOS.filter(t => t !== null).join(', ')} o nulo`
              });
            }
          }
          
          // Validar que si incluye 'sftp', se proporcionen los campos necesarios
          if (tiposOrigen.includes('sftp') && (!sftp_servidor || !sftp_usuario)) {
            return res.status(400).json({
              error: 'Para origen SFTP se requiere al menos servidor y usuario'
            });
          }
          
          // Validar que si incluye 'bucket', se proporcionen los campos necesarios
          if (tiposOrigen.includes('bucket') && (!cloud_secret_id || !bucket_nombre)) {
            return res.status(400).json({
              error: 'Para origen bucket se requiere ID de secreto cloud y nombre de bucket'
            });
          }
        }

        const { rows: [newEmisor] } = await pool.query(
          `INSERT INTO emisores (
            nombre, 
            tipo_emisor,
            email_corporativo,
            telefono,
            organizacion_id,
            activo,
            codigo_interno,
            codigo_agente_merlin,
            tipo_origen,
            sftp_servidor,
            sftp_puerto,
            sftp_usuario,
            sftp_clave,
            sftp_directorio,
            cloud_secret_id,
            bucket_nombre
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
          [
            nombre, 
            tipo_emisor_normalizado, 
            email_corporativo, 
            telefono, 
            organizacion_id, 
            activo,
            codigo_interno,
            codigo_agente_merlin,
            tipo_origen,
            sftp_servidor,
            sftp_puerto,
            sftp_usuario,
            sftp_clave,
            sftp_directorio,
            cloud_secret_id,
            bucket_nombre
          ]
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
        
        // Validar el código interno (solo letras minúsculas, números, puntos)
        if (updateData.codigo_interno && !/^[a-z0-9.-]+$/.test(updateData.codigo_interno)) {
          return res.status(400).json({
            error: 'Código interno inválido. Use solo letras minúsculas, números, puntos y guiones.'
          });
        }
        
        // Validar tipo de origen si está presente
        if (updateData.tipo_origen) {
          // Dividir el tipo_origen si contiene varios valores separados por comas
          const tiposOrigen = updateData.tipo_origen.split(',').filter(Boolean);
          
          // Verificar que todos los tipos sean válidos
          for (const tipo of tiposOrigen) {
            if (!TIPOS_ORIGEN_PERMITIDOS.includes(tipo)) {
              return res.status(400).json({
                error: `Tipo de origen no válido: ${tipo}. Debe ser uno de: ${TIPOS_ORIGEN_PERMITIDOS.filter(t => t !== null).join(', ')} o nulo`
              });
            }
          }
          
          // Validar que si incluye 'sftp', se proporcionen los campos necesarios
          if (tiposOrigen.includes('sftp') && 
              (!updateData.sftp_servidor || !updateData.sftp_usuario)) {
            return res.status(400).json({
              error: 'Para origen SFTP se requiere al menos servidor y usuario'
            });
          }
          
          // Validar que si incluye 'bucket', se proporcionen los campos necesarios
          if (tiposOrigen.includes('bucket') && 
              (!updateData.cloud_secret_id || !updateData.bucket_nombre)) {
            return res.status(400).json({
              error: 'Para origen bucket se requiere ID de secreto cloud y nombre de bucket'
            });
          }
        }

        const { rows: [updatedEmisor] } = await pool.query(
          `UPDATE emisores 
           SET nombre = $1, 
               tipo_emisor = $2,
               email_corporativo = $3,
               telefono = $4,
               organizacion_id = $5,
               activo = $6,
               codigo_interno = $7,
               codigo_agente_merlin = $8,
               tipo_origen = $9,
               sftp_servidor = $10,
               sftp_puerto = $11,
               sftp_usuario = $12,
               sftp_clave = $13,
               sftp_directorio = $14,
               cloud_secret_id = $15,
               bucket_nombre = $16
           WHERE id = $17
           RETURNING *`,
          [
            updateData.nombre,
            updateData.tipo_emisor,
            updateData.email_corporativo,
            updateData.telefono,
            updateData.organizacion_id,
            updateData.activo,
            updateData.codigo_interno,
            updateData.codigo_agente_merlin,
            updateData.tipo_origen,
            updateData.sftp_servidor,
            updateData.sftp_puerto || 22,
            updateData.sftp_usuario,
            updateData.sftp_clave,
            updateData.sftp_directorio,
            updateData.cloud_secret_id,
            updateData.bucket_nombre,
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
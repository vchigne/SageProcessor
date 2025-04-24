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
          console.log(`Consultando métodos para casilla_id=${casilla_id} y emisor_id=${emisor_id}`);
          const { rows } = await pool.query(`
            SELECT 
              me.*,
              e.nombre as emisor_nombre,
              e.tipo_origen,
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

      case 'POST': {
        const { 
          casilla_id: casillaId, 
          emisor_id: emisorId, 
          metodos,
          responsable_nombre,
          responsable_email,
          responsable_telefono,
          configuracion_frecuencia,
          emisor_sftp_subdirectorio,
          emisor_bucket_prefijo
        } = req.body;

        console.log('POST metodos-envio: recibiendo datos', { 
          casillaId, 
          emisorId,
          metodos: metodos?.length || 0,
          tiene_emisor_sftp_subdirectorio: !!emisor_sftp_subdirectorio,
          tiene_emisor_bucket_prefijo: !!emisor_bucket_prefijo,
          emisor_sftp_subdirectorio,
          emisor_bucket_prefijo
        });

        // Validar datos requeridos básicos
        if (!casillaId || !emisorId) {
          console.error('Faltan campos requeridos', { casillaId, emisorId });
          return res.status(400).json({ 
            error: 'Faltan campos requeridos: casilla_id y emisor_id son obligatorios' 
          });
        }
        
        // Asegurar que metodos sea un array
        const metodosArray = Array.isArray(metodos) ? metodos : [];

        // Comenzar transacción
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Buscar si ya hay un registro para este emisor-casilla
          const { rows: existingMethods } = await client.query(
            'SELECT id, responsable_nombre, configuracion_frecuencia FROM emisores_por_casilla WHERE casilla_id = $1 AND emisor_id = $2',
            [casillaId, emisorId]
          );

          // Verificar si hay datos existentes
          const hasExistingData = existingMethods.length > 0;
          console.log(`${hasExistingData ? 'Encontrados' : 'No encontrados'} registros existentes para casilla=${casillaId}, emisor=${emisorId}`);

          // Eliminar métodos existentes
          const deleteResult = await client.query(
            'DELETE FROM emisores_por_casilla WHERE casilla_id = $1 AND emisor_id = $2',
            [casillaId, emisorId]
          );
          console.log(`Eliminados ${deleteResult.rowCount} métodos existentes`);

          // Insertar nuevos métodos con datos adicionales
          const insertedRows = [];
          
          // Si no hay métodos seleccionados pero hay datos de subdirectorio o prefijo,
          // crear registros específicos para guardar esos datos
          if (metodosArray.length === 0) {
            // Crear registro para subdirectorio SFTP si existe
            if (emisor_sftp_subdirectorio) {
              console.log(`No hay métodos seleccionados, pero hay datos de subdirectorio SFTP. Creando registro con método 'SFTP tipo 2'.`);
              const sftpResult = await client.query(
                `INSERT INTO emisores_por_casilla (
                  casilla_id,
                  emisor_id,
                  metodo_envio,
                  parametros,
                  responsable_nombre,
                  responsable_email,
                  responsable_telefono,
                  configuracion_frecuencia,
                  emisor_sftp_subdirectorio,
                  emisor_bucket_prefijo
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [
                  casillaId, 
                  emisorId, 
                  'SFTP tipo 2', // Nuevo tipo para SFTP propio
                  {}, // Sin parámetros específicos
                  responsable_nombre || null,
                  responsable_email || null,
                  responsable_telefono || null,
                  configuracion_frecuencia || null,
                  emisor_sftp_subdirectorio,
                  null // Sin prefijo de bucket
                ]
              );
              insertedRows.push(sftpResult.rows[0]);
            }
            
            // Crear registro para prefijo de bucket si existe
            if (emisor_bucket_prefijo) {
              console.log(`No hay métodos seleccionados, pero hay datos de prefijo de bucket. Creando registro con método 'cloud'.`);
              const cloudResult = await client.query(
                `INSERT INTO emisores_por_casilla (
                  casilla_id,
                  emisor_id,
                  metodo_envio,
                  parametros,
                  responsable_nombre,
                  responsable_email,
                  responsable_telefono,
                  configuracion_frecuencia,
                  emisor_sftp_subdirectorio,
                  emisor_bucket_prefijo
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [
                  casillaId, 
                  emisorId, 
                  'cloud', // Nuevo tipo para bucket en la nube
                  {}, // Sin parámetros específicos
                  responsable_nombre || null,
                  responsable_email || null,
                  responsable_telefono || null,
                  configuracion_frecuencia || null,
                  null, // Sin subdirectorio SFTP
                  emisor_bucket_prefijo
                ]
              );
              insertedRows.push(cloudResult.rows[0]);
            }
          }
          
          // Insertar los métodos seleccionados normalmente
          for (const { metodo, parametros } of metodosArray) {
            console.log(`Insertando método ${metodo} con subdirectorio=${emisor_sftp_subdirectorio}, prefijo=${emisor_bucket_prefijo}`);
            const result = await client.query(
              `INSERT INTO emisores_por_casilla (
                casilla_id,
                emisor_id,
                metodo_envio,
                parametros,
                responsable_nombre,
                responsable_email,
                responsable_telefono,
                configuracion_frecuencia,
                emisor_sftp_subdirectorio,
                emisor_bucket_prefijo
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
              [
                casillaId, 
                emisorId, 
                metodo, 
                parametros,
                responsable_nombre || null,
                responsable_email || null,
                responsable_telefono || null,
                configuracion_frecuencia || null,
                emisor_sftp_subdirectorio || null,
                emisor_bucket_prefijo || null
              ]
            );
            insertedRows.push(result.rows[0]);
          }

          await client.query('COMMIT');
          console.log(`Insertados ${insertedRows.length} métodos nuevos con IDs:`, insertedRows);
          return res.status(200).json({ message: 'Métodos de envío actualizados exitosamente', insertedRows });
        } catch (error) {
          await client.query('ROLLBACK');
          console.error('Error en transacción de métodos-envio:', error);
          throw error;
        } finally {
          client.release();
        }
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
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  const { method } = req
  const { uuid } = req.query

  try {
    switch (method) {
      case 'GET':
        // Primero obtenemos la información del portal y verificamos que exista y esté activo
        const portalQuery = `
          SELECT 
            id,
            instalacion_id,
            activo
          FROM portales
          WHERE uuid = $1
        `
        const portalResult = await pool.query(portalQuery, [uuid])
        
        // Verificar si el portal existe
        if (portalResult.rows.length === 0) {
          return res.status(404).json({ error: 'Portal no encontrado' })
        }
        
        // Verificar si el portal está activo
        if (!portalResult.rows[0].activo) {
          return res.status(403).json({ error: 'Portal inactivo' })
        }
        
        const instalacionId = portalResult.rows[0].instalacion_id
        
        // Obtenemos las casillas filtradas por la instalación
        // También incluimos información adicional del archivo YAML cuando está disponible
        const casillasQuery = `
          SELECT 
            cr.id,
            cr.nombre_yaml,
            cr.nombre,
            cr.descripcion,
            cr.email_casilla,
            cr.api_endpoint,
            cr.api_key,
            cr.yaml_contenido,
            i.id as instalacion_id,
            o.nombre as organizacion_nombre,
            p.nombre as producto_nombre,
            pais.nombre as pais_nombre
          FROM casillas cr
          JOIN instalaciones i ON cr.instalacion_id = i.id
          JOIN organizaciones o ON i.organizacion_id = o.id
          JOIN productos p ON i.producto_id = p.id
          JOIN paises pais ON i.pais_id = pais.id
          WHERE cr.is_active = true AND cr.instalacion_id = $1
        `
        const { rows: casillas } = await pool.query(casillasQuery, [instalacionId])

        // Para cada casilla, obtenemos sus emisores con sus métodos de envío
        const casillasConEmisores = await Promise.all(
          casillas.map(async (casilla) => {
            const emisoresQuery = `
              SELECT DISTINCT
                e.id as emisor_id,
                e.nombre as emisor_nombre,
                array_agg(me.metodo_envio) as metodos_envio
              FROM emisores_por_casilla me
              JOIN emisores e ON me.emisor_id = e.id
              WHERE me.casilla_id = $1
              GROUP BY e.id, e.nombre
            `
            const { rows: emisores } = await pool.query(emisoresQuery, [casilla.id])
            
            // Obtener los responsables para cada emisor de esta casilla
            const emisoresConResponsables = await Promise.all(
              emisores.map(async (emisor) => {
                // Obtener el historial de envíos recientes para este emisor y casilla
                // Para cada emisor específico, obtener solo su historial
                const historialQuery = `
                  SELECT 
                    ey.id,
                    ey.fecha_ejecucion,
                    ey.estado,
                    ey.metodo_envio,
                    ey.errores_detectados,
                    ey.warnings_detectados
                  FROM ejecuciones_yaml ey
                  WHERE 
                    ey.casilla_id = $1 AND ey.emisor_id = $2
                  ORDER BY ey.fecha_ejecucion DESC
                  LIMIT 5
                `;
                
                const { rows: historialEnvios } = await pool.query(historialQuery, [
                  casilla.id,
                  emisor.emisor_id
                ]);
                
                const responsablesQuery = `
                  SELECT 
                    er.id,
                    er.responsable_nombre as nombre,
                    er.responsable_email as email,
                    er.responsable_telefono as telefono,
                    COALESCE(ft.nombre, er.configuracion_frecuencia->>'tipo') as frecuencia_tipo,
                    er.configuracion_frecuencia->>'hora' as frecuencia_hora,
                    er.configuracion_frecuencia->'dias_semana' as frecuencia_dias_semana,
                    er.configuracion_frecuencia->'dias_mes' as frecuencia_dias_mes,
                    er.configuracion_frecuencia as configuracion_frecuencia_completa,
                    (
                      SELECT MAX(fecha_ejecucion) 
                      FROM ejecuciones_yaml ey
                      WHERE ey.casilla_id = cr.id 
                        AND (
                          ey.emisor_id = er.emisor_id
                          OR ey.emisor_id IS NULL
                        )
                    ) as ultimo_envio,
                    CASE 
                      WHEN (
                        SELECT COUNT(*) FROM ejecuciones_yaml ey
                        WHERE ey.casilla_id = cr.id
                          AND (
                            ey.emisor_id = er.emisor_id
                            OR ey.emisor_id IS NULL
                          )
                      ) = 0 THEN false
                      WHEN er.frecuencia_tipo_id IS NULL THEN false
                      ELSE (
                        CASE
                          -- Para frecuencia diaria
                          WHEN ft.nombre = 'Diario' THEN 
                            EXTRACT(EPOCH FROM (NOW() - (
                              SELECT MAX(fecha_ejecucion) 
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                                AND (
                                  ey.emisor_id = er.emisor_id
                                  OR ey.emisor_id IS NULL
                                )
                            ))) / 3600 > 24
                          -- Para frecuencia semanal (aproximación simplificada)
                          WHEN ft.nombre = 'Semanal' THEN 
                            EXTRACT(EPOCH FROM (NOW() - (
                              SELECT MAX(fecha_ejecucion) 
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                                AND (
                                  ey.emisor_id = er.emisor_id
                                  OR ey.emisor_id IS NULL
                                )
                            ))) / 3600 > 24 * 7
                          -- Para frecuencia mensual (aproximación simplificada)
                          WHEN ft.nombre = 'Mensual' THEN 
                            EXTRACT(EPOCH FROM (NOW() - (
                              SELECT MAX(fecha_ejecucion) 
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                                AND (
                                  ey.emisor_id = er.emisor_id
                                  OR ey.emisor_id IS NULL
                                )
                            ))) / 3600 > 24 * 30
                          ELSE false
                        END
                      )
                    END as estado_retraso,
                    CASE 
                      WHEN er.frecuencia_tipo_id IS NULL THEN 0
                      ELSE (
                        CASE
                          -- Para frecuencia diaria, calcular horas de retraso
                          WHEN ft.nombre = 'Diario' AND (
                            SELECT COUNT(*) FROM ejecuciones_yaml ey
                            WHERE ey.casilla_id = cr.id
                              AND (
                                ey.emisor_id = er.emisor_id
                                OR ey.emisor_id IS NULL
                              )
                          ) > 0 THEN 
                            GREATEST(0, EXTRACT(EPOCH FROM (NOW() - (
                              SELECT MAX(fecha_ejecucion) 
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                                AND (
                                  ey.emisor_id = er.emisor_id
                                  OR ey.emisor_id IS NULL
                                )
                            ))) / 3600 - 24)
                          -- Para frecuencia semanal
                          WHEN ft.nombre = 'Semanal' AND (
                            SELECT COUNT(*) FROM ejecuciones_yaml ey
                            WHERE ey.casilla_id = cr.id
                              AND (
                                ey.emisor_id = er.emisor_id
                                OR ey.emisor_id IS NULL
                              )
                          ) > 0 THEN 
                            GREATEST(0, EXTRACT(EPOCH FROM (NOW() - (
                              SELECT MAX(fecha_ejecucion) 
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                                AND (
                                  ey.emisor_id = er.emisor_id
                                  OR ey.emisor_id IS NULL
                                )
                            ))) / 3600 - 24 * 7)
                          -- Para frecuencia mensual
                          WHEN ft.nombre = 'Mensual' AND (
                            SELECT COUNT(*) FROM ejecuciones_yaml ey
                            WHERE ey.casilla_id = cr.id
                              AND (
                                ey.emisor_id = er.emisor_id
                                OR ey.emisor_id IS NULL
                              )
                          ) > 0 THEN 
                            GREATEST(0, EXTRACT(EPOCH FROM (NOW() - (
                              SELECT MAX(fecha_ejecucion) 
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                                AND (
                                  ey.emisor_id = er.emisor_id
                                  OR ey.emisor_id IS NULL
                                )
                            ))) / 3600 - 24 * 30)
                          ELSE 0
                        END
                      )
                    END as tiempo_retraso
                  FROM emisores_por_casilla er
                  LEFT JOIN frecuencias_tipo ft ON er.frecuencia_tipo_id = ft.id
                  JOIN casillas cr ON er.casilla_id = cr.id
                  WHERE er.emisor_id = $1 AND er.casilla_id = $2 AND er.responsable_activo = true
                `
                const { rows: responsables } = await pool.query(responsablesQuery, [emisor.emisor_id, casilla.id])
                
                return {
                  ...emisor,
                  responsables: responsables,
                  historial_envios: historialEnvios
                }
              })
            )

            // Obtener el historial de ejecuciones directamente para esta casilla
            // IMPORTANTE: Si no hay emisores, solo filtramos por casilla_id
            const casillaHistorialQuery = `
              SELECT 
                ey.id,
                ey.fecha_ejecucion,
                ey.estado,
                ey.metodo_envio,
                ey.errores_detectados,
                ey.warnings_detectados
              FROM ejecuciones_yaml ey
              WHERE 
                ey.casilla_id = $1
              ORDER BY ey.fecha_ejecucion DESC
              LIMIT 5
            `;
            
            console.log(`Buscando historial para casilla ${casilla.id} (consulta directa por casilla_id)`);
            const { rows: casillaHistorialEnvios } = await pool.query(casillaHistorialQuery, [casilla.id]);
            console.log(`Encontradas ${casillaHistorialEnvios.length} ejecuciones para casilla ${casilla.id}`);
            
            // Usar el nombre y descripción que ya vienen de la tabla de casillas
            let yamlNombre = casilla.nombre || '';
            let yamlDescripcion = casilla.descripcion || '';
            
            // Si no hay nombre o descripción, intentar extraerlos del contenido YAML
            if ((!yamlNombre || !yamlDescripcion) && casilla.yaml_contenido) {
              try {
                const yamlContent = casilla.yaml_contenido;
                
                // Buscar el nombre en el YAML si no está definido
                if (!yamlNombre) {
                  const nameMatch = yamlContent.match(/name:\s*"([^"]+)"/);
                  if (nameMatch && nameMatch[1]) {
                    yamlNombre = nameMatch[1];
                  }
                }
                
                // Buscar la descripción en el YAML si no está definida
                if (!yamlDescripcion) {
                  const descMatch = yamlContent.match(/description:\s*"([^"]+)"/);
                  if (descMatch && descMatch[1]) {
                    yamlDescripcion = descMatch[1];
                  }
                }
              } catch (e) {
                console.error('Error al procesar YAML:', e);
              }
            }
            
            return {
              id: casilla.id,
              nombre_yaml: casilla.nombre_yaml,
              email_casilla: casilla.email_casilla,
              api_endpoint: casilla.api_endpoint,
              api_key: casilla.api_key,
              nombreCompleto: yamlNombre || casilla.nombre || casilla.nombre_yaml,
              descripcion: yamlDescripcion || casilla.descripcion || 'Sin descripción',
              archivo_yaml_contenido: casilla.yaml_contenido, // Mantener compatibilidad
              // Incluir el historial de ejecuciones sin emisor directamente en la casilla
              historial_envios: casillaHistorialEnvios,
              instalacion: {
                id: casilla.instalacion_id,
                organizacion: {
                  nombre: casilla.organizacion_nombre
                },
                producto: {
                  nombre: casilla.producto_nombre
                },
                pais: {
                  nombre: casilla.pais_nombre
                }
              },
              emisores: emisoresConResponsables.map(emisor => ({
                id: emisor.emisor_id,
                nombre: emisor.emisor_nombre,
                metodos_envio: emisor.metodos_envio,
                responsables: emisor.responsables,
                historial_envios: emisor.historial_envios
              }))
            }
          })
        )

        return res.status(200).json(casillasConEmisores)

      default:
        res.setHeader('Allow', ['GET'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error en API casillas:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}
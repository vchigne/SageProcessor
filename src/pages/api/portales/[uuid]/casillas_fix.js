import { Pool } from 'pg'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]"

// Configuración de la conexión a la base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * API para obtener las casillas asociadas a un portal
 * 
 * @param {object} req - Objeto de solicitud HTTP
 * @param {object} res - Objeto de respuesta HTTP
 */
export default async function handler(req, res) {
  try {
    const { method, query: { uuid } } = req
    console.log(`Solicitud ${method} a /api/portales/${uuid}/casillas`)

    // Verificación de sesión y autorización
    const session = await getServerSession(req, res, authOptions)
    
    if (!session && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'No autorizado' })
    }

    // Obtener información del portal por UUID
    const portalQuery = `
      SELECT id, nombre, uuid, permite_acceso_externo
      FROM portales
      WHERE uuid = $1
    `
    const { rows: portales } = await pool.query(portalQuery, [uuid])
    
    if (portales.length === 0) {
      return res.status(404).json({ error: 'Portal no encontrado' })
    }
    
    const portal = portales[0]
    
    // Si el usuario no está autenticado, verificar si el portal permite acceso externo
    if (!session && !portal.permite_acceso_externo) {
      return res.status(401).json({ error: 'Portal de acceso restringido' })
    }
    
    switch (method) {
      case 'GET':
        // Obtener lista de casillas para el portal
        const casillasQuery = `
          SELECT 
            c.id, 
            c.nombre,
            c.descripcion,
            c.nombre_yaml,
            c.email_casilla,
            c.api_endpoint,
            c.api_key,
            c.yaml_contenido,
            i.id as instalacion_id,
            o.nombre as organizacion_nombre,
            p.nombre as producto_nombre,
            pa.nombre as pais_nombre
          FROM casillas c
          JOIN instalaciones i ON c.instalacion_id = i.id
          JOIN organizaciones o ON i.organizacion_id = o.id
          JOIN productos p ON i.producto_id = p.id
          JOIN paises pa ON i.pais_id = pa.id
          JOIN portales_casillas pc ON c.id = pc.casilla_id
          WHERE pc.portal_id = $1
          ORDER BY c.nombre
        `
        const { rows: casillas } = await pool.query(casillasQuery, [portal.id])
        
        // Para cada casilla, obtener los emisores asociados con sus responsables y historial
        const casillasConEmisores = await Promise.all(
          casillas.map(async casilla => {
            // Consulta para obtener los emisores asociados a esta casilla
            const emisoresQuery = `
              SELECT 
                e.id as emisor_id, 
                e.nombre as emisor_nombre
              FROM emisores e
              JOIN emisores_por_casilla ec ON e.id = ec.emisor_id
              WHERE ec.casilla_id = $1
              GROUP BY e.id, e.nombre
              ORDER BY e.nombre
            `
            const { rows: emisores } = await pool.query(emisoresQuery, [casilla.id])
            
            // Para cada emisor, obtener sus métodos de envío
            const emisoresConMetodos = await Promise.all(
              emisores.map(async emisor => {
                const metodosEnvioQuery = `
                  SELECT 
                    me.id, 
                    me.nombre,
                    me.tipo,
                    me.configuracion
                  FROM metodos_envio me
                  WHERE me.casilla_id = $1 AND me.emisor_id = $2
                `
                const { rows: metodosEnvio } = await pool.query(metodosEnvioQuery, [casilla.id, emisor.emisor_id])
                
                // Obtener el historial de envíos para este emisor/casilla
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
                `
                const { rows: historialEnvios } = await pool.query(historialQuery, [casilla.id, emisor.emisor_id])
                
                return {
                  ...emisor,
                  metodos_envio: metodosEnvio,
                  historial_envios: historialEnvios
                }
              })
            )
            
            // Para cada emisor, obtener los responsables con verificación de retraso
            const emisoresConResponsables = await Promise.all(
              emisoresConMetodos.map(async emisor => {
                const responsablesQuery = `
                  SELECT 
                    er.id as responsable_id,
                    er.responsable_nombre,
                    er.responsable_email,
                    ft.id as frecuencia_tipo_id,
                    ft.nombre as frecuencia_tipo,
                    er.configuracion_frecuencia,
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
                      WHEN er.configuracion_frecuencia IS NULL OR er.configuracion_frecuencia->>'tipo' IS NULL THEN false
                      ELSE (
                        CASE
                          -- Frecuencia diaria con lógica detallada
                          WHEN (ft.nombre = 'Diario' OR ft.nombre = 'diaria' OR er.configuracion_frecuencia->>'tipo' = 'diario') THEN (
                            WITH config AS (
                              SELECT 
                                (er.configuracion_frecuencia->>'hora')::time as hora_config
                            ),
                            ultima_ejecucion AS (
                              SELECT MAX(fecha_ejecucion) as fecha
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                              AND (ey.emisor_id = er.emisor_id OR ey.emisor_id IS NULL)
                            )
                            SELECT
                              CASE
                                -- Si pasó la hora configurada hoy y no hay ejecución de hoy
                                WHEN CURRENT_TIME > config.hora_config AND 
                                    (ultima_ejecucion.fecha IS NULL OR 
                                     DATE(ultima_ejecucion.fecha) < CURRENT_DATE) THEN true
                                -- Si es un día anterior, verificar si pasaron más de 24 horas
                                WHEN ultima_ejecucion.fecha IS NOT NULL AND 
                                    DATE(ultima_ejecucion.fecha) < CURRENT_DATE THEN true
                                ELSE false
                              END
                            FROM config, ultima_ejecucion
                          )
                          
                          -- Frecuencia semanal con lógica detallada
                          WHEN (ft.nombre = 'Semanal' OR ft.nombre = 'semanal' OR er.configuracion_frecuencia->>'tipo' = 'semanal') THEN (
                            WITH config AS (
                              SELECT 
                                (er.configuracion_frecuencia->>'hora')::time as hora_config,
                                jsonb_array_elements_text(er.configuracion_frecuencia->'dias_semana') as dia_semana
                            ),
                            ultima_ejecucion AS (
                              SELECT MAX(fecha_ejecucion) as fecha
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                              AND (ey.emisor_id = er.emisor_id OR ey.emisor_id IS NULL)
                            ),
                            dia_actual AS (
                              SELECT to_char(CURRENT_DATE, 'Day') as dia
                            ),
                            es_dia_configurado AS (
                              SELECT EXISTS (
                                SELECT 1 FROM config 
                                WHERE TRIM(dia_semana) = TRIM((SELECT dia FROM dia_actual))
                              ) as es_dia
                            )
                            SELECT
                              CASE
                                -- Si hoy es día configurado, verificar hora y última ejecución
                                WHEN es_dia_configurado.es_dia = true AND 
                                    CURRENT_TIME > config.hora_config AND 
                                    (ultima_ejecucion.fecha IS NULL OR 
                                     DATE(ultima_ejecucion.fecha) < CURRENT_DATE) THEN true
                                -- Si no es día configurado, verificar última ejecución respecto al último día configurado
                                WHEN es_dia_configurado.es_dia = false AND 
                                    ultima_ejecucion.fecha IS NOT NULL AND
                                    EXTRACT(EPOCH FROM (NOW() - ultima_ejecucion.fecha)) / 3600 > 24 * 7 THEN true
                                ELSE false
                              END
                            FROM config, ultima_ejecucion, es_dia_configurado
                            LIMIT 1
                          )
                          
                          -- Frecuencia mensual con lógica detallada
                          WHEN (ft.nombre = 'Mensual' OR ft.nombre = 'mensual' OR er.configuracion_frecuencia->>'tipo' = 'mensual') THEN (
                            WITH config AS (
                              SELECT 
                                (er.configuracion_frecuencia->>'hora')::time as hora_config,
                                jsonb_array_elements_text(er.configuracion_frecuencia->'dias_mes') as dia_mes
                            ),
                            ultima_ejecucion AS (
                              SELECT MAX(fecha_ejecucion) as fecha
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                              AND (ey.emisor_id = er.emisor_id OR ey.emisor_id IS NULL)
                            ),
                            dia_actual AS (
                              SELECT EXTRACT(DAY FROM CURRENT_DATE) as dia
                            ),
                            es_dia_configurado AS (
                              SELECT EXISTS (
                                SELECT 1 FROM config 
                                WHERE CAST(dia_mes AS INTEGER) = (SELECT dia FROM dia_actual)
                              ) as es_dia
                            )
                            SELECT
                              CASE
                                -- Si hoy es día configurado, verificar hora y última ejecución
                                WHEN es_dia_configurado.es_dia = true AND 
                                    CURRENT_TIME > config.hora_config AND 
                                    (ultima_ejecucion.fecha IS NULL OR 
                                     DATE(ultima_ejecucion.fecha) < CURRENT_DATE) THEN true
                                -- Si no es día configurado, verificar última ejecución respecto al último día configurado
                                WHEN es_dia_configurado.es_dia = false AND 
                                    ultima_ejecucion.fecha IS NOT NULL AND
                                    EXTRACT(EPOCH FROM (NOW() - ultima_ejecucion.fecha)) / 3600 > 24 * 30 THEN true
                                ELSE false
                              END
                            FROM config, ultima_ejecucion, es_dia_configurado
                            LIMIT 1
                          )
                          
                          -- Si no tenemos un caso específico o la configuración es inválida, usar los default
                          ELSE (
                            CASE
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
                        END
                      )
                    END as estado_retraso,
                    CASE 
                      WHEN er.configuracion_frecuencia IS NULL OR er.configuracion_frecuencia->>'tipo' IS NULL THEN 0
                      ELSE (
                        CASE
                          -- Frecuencia diaria con cálculo preciso
                          WHEN (ft.nombre = 'Diario' OR ft.nombre = 'diaria' OR er.configuracion_frecuencia->>'tipo' = 'diario') THEN (
                            WITH config AS (
                              SELECT 
                                (er.configuracion_frecuencia->>'hora')::time as hora_config
                            ),
                            ultima_ejecucion AS (
                              SELECT MAX(fecha_ejecucion) as fecha
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                              AND (ey.emisor_id = er.emisor_id OR ey.emisor_id IS NULL)
                            ),
                            fecha_esperada AS (
                              SELECT 
                                CASE
                                  -- Si hoy es el día y ya pasó la hora configurada
                                  WHEN CURRENT_TIME > config.hora_config THEN
                                    CURRENT_DATE + config.hora_config
                                  -- Si es un día anterior
                                  ELSE
                                    (CURRENT_DATE - INTERVAL '1 day') + config.hora_config
                                END as fecha
                              FROM config
                            )
                            SELECT 
                              CASE
                                WHEN ultima_ejecucion.fecha IS NULL THEN
                                  -- Si no hay ejecuciones, calcular desde la fecha esperada
                                  EXTRACT(EPOCH FROM (NOW() - fecha_esperada.fecha)) / 3600
                                WHEN DATE(ultima_ejecucion.fecha) < CURRENT_DATE THEN
                                  -- Si la última ejecución es anterior a hoy, calcular desde entonces
                                  EXTRACT(EPOCH FROM (NOW() - ultima_ejecucion.fecha)) / 3600
                                ELSE 0
                              END
                            FROM config, ultima_ejecucion, fecha_esperada
                          )
                          
                          -- Frecuencia semanal con cálculo preciso
                          WHEN (ft.nombre = 'Semanal' OR ft.nombre = 'semanal' OR er.configuracion_frecuencia->>'tipo' = 'semanal') THEN (
                            WITH config AS (
                              SELECT 
                                (er.configuracion_frecuencia->>'hora')::time as hora_config,
                                jsonb_array_elements_text(er.configuracion_frecuencia->'dias_semana') as dia_semana
                            ),
                            ultima_ejecucion AS (
                              SELECT MAX(fecha_ejecucion) as fecha
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                              AND (ey.emisor_id = er.emisor_id OR ey.emisor_id IS NULL)
                            ),
                            dia_actual AS (
                              SELECT to_char(CURRENT_DATE, 'Day') as dia
                            ),
                            es_dia_configurado AS (
                              SELECT EXISTS (
                                SELECT 1 FROM config 
                                WHERE TRIM(dia_semana) = TRIM((SELECT dia FROM dia_actual))
                              ) as es_dia
                            )
                            SELECT
                              CASE
                                WHEN ultima_ejecucion.fecha IS NULL THEN
                                  -- Si no hay ejecuciones, usar el tiempo base para la frecuencia
                                  24 * 7
                                WHEN es_dia_configurado.es_dia = true AND CURRENT_TIME > config.hora_config THEN
                                  -- Si hoy es día configurado y ya pasó la hora, calcular desde la hora configurada
                                  EXTRACT(EPOCH FROM (NOW() - (CURRENT_DATE + config.hora_config))) / 3600
                                ELSE
                                  -- Usar el cálculo existente como default
                                  GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ultima_ejecucion.fecha)) / 3600 - 24 * 7)
                              END
                            FROM config, ultima_ejecucion, es_dia_configurado
                            LIMIT 1
                          )
                          
                          -- Frecuencia mensual con cálculo preciso
                          WHEN (ft.nombre = 'Mensual' OR ft.nombre = 'mensual' OR er.configuracion_frecuencia->>'tipo' = 'mensual') THEN (
                            WITH config AS (
                              SELECT 
                                (er.configuracion_frecuencia->>'hora')::time as hora_config,
                                jsonb_array_elements_text(er.configuracion_frecuencia->'dias_mes') as dia_mes
                            ),
                            ultima_ejecucion AS (
                              SELECT MAX(fecha_ejecucion) as fecha
                              FROM ejecuciones_yaml ey
                              WHERE ey.casilla_id = cr.id
                              AND (ey.emisor_id = er.emisor_id OR ey.emisor_id IS NULL)
                            ),
                            dia_actual AS (
                              SELECT EXTRACT(DAY FROM CURRENT_DATE) as dia
                            ),
                            es_dia_configurado AS (
                              SELECT EXISTS (
                                SELECT 1 FROM config 
                                WHERE CAST(dia_mes AS INTEGER) = (SELECT dia FROM dia_actual)
                              ) as es_dia
                            )
                            SELECT
                              CASE
                                WHEN ultima_ejecucion.fecha IS NULL THEN
                                  -- Si no hay ejecuciones, usar el tiempo base para la frecuencia
                                  24 * 30
                                WHEN es_dia_configurado.es_dia = true AND CURRENT_TIME > config.hora_config THEN
                                  -- Si hoy es día configurado y ya pasó la hora, calcular desde la hora configurada
                                  EXTRACT(EPOCH FROM (NOW() - (CURRENT_DATE + config.hora_config))) / 3600
                                ELSE
                                  -- Usar el cálculo existente como default
                                  GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ultima_ejecucion.fecha)) / 3600 - 24 * 30)
                              END
                            FROM config, ultima_ejecucion, es_dia_configurado
                            LIMIT 1
                          )
                          
                          -- Casos predeterminados para fallback
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
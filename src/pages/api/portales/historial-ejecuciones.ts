import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse query params, converting arrays to single values
    const casilla_id = Array.isArray(req.query.casilla_id) ? req.query.casilla_id[0] : req.query.casilla_id;
    const emisor_id = Array.isArray(req.query.emisor_id) ? req.query.emisor_id[0] : req.query.emisor_id;
    const estado = Array.isArray(req.query.estado) ? req.query.estado[0] : req.query.estado;
    const dias = parseInt(Array.isArray(req.query.dias) ? req.query.dias[0] : req.query.dias || '90');
    const pagina = parseInt(Array.isArray(req.query.pagina) ? req.query.pagina[0] : req.query.pagina || '1');
    const items_por_pagina = parseInt(Array.isArray(req.query.items_por_pagina) ? req.query.items_por_pagina[0] : req.query.items_por_pagina || '10');
    
    // Parámetros para filtrado por fecha
    const fecha_desde = Array.isArray(req.query.fecha_desde) ? req.query.fecha_desde[0] : req.query.fecha_desde;
    const fecha_hasta = Array.isArray(req.query.fecha_hasta) ? req.query.fecha_hasta[0] : req.query.fecha_hasta;

    // Preparamos las fechas para el filtrado
    let fechaDesde: Date;
    let fechaHasta: Date = new Date(); // Fecha actual por defecto
    
    if (fecha_desde) {
      // Si hay una fecha explícita, la usamos
      fechaDesde = new Date(fecha_desde);
    } else {
      // Si no, calculamos la fecha desde los días
      fechaDesde = new Date();
      fechaDesde.setDate(fechaDesde.getDate() - dias);
    }
    
    if (fecha_hasta) {
      // Si hay una fecha explícita para el límite superior, la usamos
      fechaHasta = new Date(fecha_hasta);
      // Ajustar al final del día
      fechaHasta.setHours(23, 59, 59, 999);
    }

    let query = `
      SELECT 
        e.id, 
        e.uuid, 
        e.nombre_yaml, 
        e.archivo_datos, 
        e.fecha_ejecucion, 
        e.estado, 
        e.errores_detectados, 
        e.warnings_detectados,
        e.ruta_directorio,
        e.casilla_id,
        e.emisor_id,
        e.metodo_envio,
        e.migrado_a_nube,
        e.ruta_nube,
        e.nube_primaria_id,
        c.nombre_yaml AS casilla_nombre,
        em.nombre AS emisor_nombre,
        cp.nombre AS nube_primaria_nombre
      FROM ejecuciones_yaml e
      LEFT JOIN casillas c ON e.casilla_id = c.id
      LEFT JOIN emisores em ON e.emisor_id = em.id
      LEFT JOIN cloud_providers cp ON e.nube_primaria_id = cp.id
      WHERE e.fecha_ejecucion >= $1 AND e.fecha_ejecucion <= $2
    `;

    // Inicializamos un array de parámetros con las fechas
    const queryParams: any[] = [fechaDesde.toISOString(), fechaHasta.toISOString()];
    
    // Definimos los índices de forma incremental basados en qué parámetros existen
    let nextParamIndex = 3;
    
    // Añadimos filtro de casilla_id si existe
    if (casilla_id) {
      query += ` AND (e.casilla_id = $${nextParamIndex}`;
      queryParams.push(Number(casilla_id));
      nextParamIndex++;
      
      // También filtrar por casilla_id nulo pero con el mismo nombre_yaml
      query += ` OR (e.casilla_id IS NULL AND e.nombre_yaml = (
        SELECT nombre_yaml FROM casillas WHERE id = $${nextParamIndex - 1}
      )))`;
    }

    // Añadimos filtro de emisor_id si existe
    if (emisor_id) {
      query += ` AND (e.emisor_id = $${nextParamIndex}`;
      queryParams.push(Number(emisor_id));
      nextParamIndex++;
      
      // También incluir registros donde el emisor_id es NULL pero la casilla coincide
      if (casilla_id) {
        query += ` OR (e.emisor_id IS NULL AND e.casilla_id = $${nextParamIndex - 2}))`;
      } else {
        query += `)`;
      }
    }

    if (estado) {
      query += ` AND e.estado = $${nextParamIndex}`;
      queryParams.push(estado);
      nextParamIndex++;
    }
    
    console.log('Consulta principal:', query);
    console.log('Parámetros principales:', queryParams);

    // Agregamos orden y paginación
    const offset = (pagina - 1) * items_por_pagina;
    const limitParamIndex = nextParamIndex;
    const offsetParamIndex = nextParamIndex + 1;
    query += ` ORDER BY e.fecha_ejecucion DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
    queryParams.push(Number(items_por_pagina), Number(offset));

    // Consulta para el total de registros (para la paginación)
    let countQuery = `
      SELECT COUNT(*) FROM ejecuciones_yaml e
      WHERE e.fecha_ejecucion >= $1 AND e.fecha_ejecucion <= $2
    `;

    const countParams: any[] = [fechaDesde.toISOString(), fechaHasta.toISOString()];
    let countParamIndex = 3;

    if (casilla_id) {
      countQuery += ` AND (e.casilla_id = $${countParamIndex}`;
      countParams.push(Number(casilla_id));
      countParamIndex++;
      
      // También filtrar por casilla_id nulo pero con el mismo nombre_yaml
      countQuery += ` OR (e.casilla_id IS NULL AND e.nombre_yaml = (
        SELECT nombre_yaml FROM casillas WHERE id = $${countParamIndex - 1}
      )))`;
    }

    if (emisor_id) {
      countQuery += ` AND (e.emisor_id = $${countParamIndex}`;
      countParams.push(Number(emisor_id));
      countParamIndex++;
      
      // También incluir registros donde el emisor_id es NULL pero la casilla coincide
      if (casilla_id) {
        countQuery += ` OR (e.emisor_id IS NULL AND e.casilla_id = $${countParamIndex - 2}))`;
      } else {
        countQuery += `)`;
      }
    }

    if (estado) {
      countQuery += ` AND e.estado = $${countParamIndex}`;
      countParams.push(estado);
      countParamIndex++;
    }
    
    console.log('Consulta de conteo:', countQuery);
    console.log('Parámetros de conteo:', countParams);

    // Ejecutar ambas consultas en paralelo
    const [ejecucionesResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, countParams)
    ]);

    const totalRegistros = parseInt(countResult.rows[0].count);
    const totalPaginas = Math.ceil(totalRegistros / items_por_pagina);

    // Procesamos los resultados para agregar información sobre archivos
    const ejecuciones = ejecucionesResult.rows.map(ejecucion => {
      // Verificamos si la ejecución está en la nube o local
      const estaEnNube = ejecucion.migrado_a_nube && ejecucion.ruta_nube;
      
      let tieneLog = false;
      let tieneYaml = false;
      let tieneDatos = false;
      
      if (estaEnNube) {
        // Si está en la nube, asumimos que los archivos están disponibles
        // En una implementación completa, se podría verificar con el adaptador de nube
        tieneLog = true;
        tieneYaml = true;
        tieneDatos = !!ejecucion.archivo_datos;
      } else {
        // Verificación de archivos locales
        const execDir = path.join(process.cwd(), 'executions', ejecucion.uuid);
        tieneLog = fs.existsSync(path.join(execDir, 'output.log'));
        tieneYaml = fs.existsSync(path.join(execDir, 'input.yaml'));
        tieneDatos = ejecucion.archivo_datos ? fs.existsSync(path.join(execDir, ejecucion.archivo_datos)) : false;
      }

      return {
        ...ejecucion,
        tieneLog,
        tieneYaml,
        tieneDatos,
        // Agregamos stats básicos para el dashboard
        archivos_disponibles: [tieneLog, tieneYaml, tieneDatos].filter(Boolean).length
      };
    });

    // Calculamos estadísticas para el dashboard
    const estadisticas = {
      total: totalRegistros,
      exitosos: ejecuciones.filter(e => e.estado === 'Éxito').length,
      fallidos: ejecuciones.filter(e => e.estado === 'Fallido').length,
      parciales: ejecuciones.filter(e => e.estado === 'Parcial').length,
      porEstado: {
        Éxito: (ejecuciones.filter(e => e.estado === 'Éxito').length / ejecuciones.length) * 100 || 0,
        Fallido: (ejecuciones.filter(e => e.estado === 'Fallido').length / ejecuciones.length) * 100 || 0,
        Parcial: (ejecuciones.filter(e => e.estado === 'Parcial').length / ejecuciones.length) * 100 || 0
      }
    };

    return res.status(200).json({
      ejecuciones,
      paginacion: {
        pagina: pagina,
        items_por_pagina: items_por_pagina,
        total_registros: totalRegistros,
        total_paginas: totalPaginas
      },
      estadisticas
    });
  } catch (error) {
    console.error('Error al obtener historial de ejecuciones:', error);
    return res.status(500).json({ message: 'Error al obtener historial de ejecuciones', error: error.message });
  }
}
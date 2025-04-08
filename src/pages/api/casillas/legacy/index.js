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
            cr.id,
            cr.nombre_yaml,
            cr.email_casilla,
            cr.instalacion_id,
            cr.is_active,
            o.nombre as organizacion,
            p.nombre as producto,
            pais.nombre as pais,
            ay.contenido as yaml_contenido
          FROM casillas cr
          LEFT JOIN instalaciones i ON cr.instalacion_id = i.id 
          LEFT JOIN organizaciones o ON i.organizacion_id = o.id
          LEFT JOIN productos p ON i.producto_id = p.id
          LEFT JOIN paises pais ON i.pais_id = pais.id
          LEFT JOIN archivos_yaml ay ON cr.nombre_yaml = ay.nombre
          ORDER BY cr.nombre_yaml
        `)
        
        // Procesar contenido YAML para extraer nombre y descripción
        const processedRows = rows.map(row => {
          let yamlInfo = { nombre: '', descripcion: '' };
          
          if (row.yaml_contenido) {
            try {
              // Extraer nombre del YAML si existe
              const nameMatch = row.yaml_contenido.match(/name:\s*"([^"]+)"/);
              if (nameMatch && nameMatch[1]) {
                yamlInfo.nombre = nameMatch[1];
              }
              
              // Extraer descripción del YAML si existe
              const descMatch = row.yaml_contenido.match(/description:\s*"([^"]+)"/);
              if (descMatch && descMatch[1]) {
                yamlInfo.descripcion = descMatch[1];
              }
            } catch (e) {
              console.error('Error al procesar contenido YAML:', e);
            }
          }
          
          // Eliminar el contenido YAML completo de la respuesta para reducir tamaño
          const { yaml_contenido, ...restRow } = row;
          
          return {
            ...restRow,
            yaml_info: yamlInfo
          };
        });
        
        return res.status(200).json(processedRows)

      default:
        res.setHeader('Allow', ['GET'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Error en API casillas-recepcion:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}
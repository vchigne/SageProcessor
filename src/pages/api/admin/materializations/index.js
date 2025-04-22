import { query } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user.isAdmin) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  switch (req.method) {
    case 'GET':
      try {
        const materializations = await query(`
          SELECT m.id, m.nombre, m.descripcion, m.casilla_id, m.estado, 
                 m.ultima_materializacion, m.fecha_creacion, c.nombre as casilla_nombre,
                 (SELECT COUNT(*) FROM materializacion_tablas WHERE materializacion_id = m.id) as tablas_count,
                 (SELECT COUNT(*) FROM materializacion_destinos WHERE materializacion_id = m.id) as destinos_count
          FROM materializaciones m
          JOIN casillas c ON m.casilla_id = c.id
          ORDER BY m.fecha_creacion DESC
        `);
        
        return res.status(200).json(materializations);
      } catch (error) {
        console.error('Error al obtener materializaciones:', error);
        return res.status(500).json({ message: 'Error al obtener las materializaciones' });
      }
      
    case 'POST':
      try {
        const { nombre, descripcion, casilla_id, configuracion } = req.body;
        
        if (!nombre || !casilla_id) {
          return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        
        // Verificar que la casilla existe
        const casillas = await query(`SELECT id FROM casillas WHERE id = $1`, [casilla_id]);
        if (casillas.length === 0) {
          return res.status(404).json({ message: 'La casilla seleccionada no existe' });
        }
        
        // Crear la materialización
        const result = await query(`
          INSERT INTO materializaciones (
            nombre, descripcion, casilla_id, configuracion, estado
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          nombre, 
          descripcion, 
          casilla_id, 
          configuracion ? JSON.stringify(configuracion) : '{}',
          'pendiente'
        ]);
        
        return res.status(201).json({ id: result[0].id, message: 'Materialización creada correctamente' });
      } catch (error) {
        console.error('Error al crear materialización:', error);
        return res.status(500).json({ message: 'Error al crear la materialización' });
      }
      
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}
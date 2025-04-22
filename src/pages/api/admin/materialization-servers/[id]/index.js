import { query } from '@/lib/db';
import { Pool } from 'pg';

// Obtener la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID de servidor inválido' });
  }

  const serverId = parseInt(id);

  switch (req.method) {
    case 'GET':
      try {
        const serverData = await query(`
          SELECT id, nombre, descripcion, tipo, url as endpoint, capacidad, 
                 configuracion, estado, ultimo_test, fecha_creacion, fecha_actualizacion
          FROM materializacion_servidores
          WHERE id = $1
        `, [serverId]);
        
        if (serverData.length === 0) {
          return res.status(404).json({ message: 'Servidor no encontrado' });
        }

        // Por seguridad, no enviamos el API key al frontend
        const server = serverData[0];
        
        // Deserializar configuración si es necesario
        if (server.configuracion) {
          try {
            if (typeof server.configuracion === 'string') {
              server.configuracion = JSON.parse(server.configuracion);
            }
          } catch (error) {
            console.error('Error al deserializar configuración:', error);
            // Mantener como cadena si hay error
          }
        }
        
        return res.status(200).json(server);
      } catch (error) {
        console.error('Error al obtener servidor:', error);
        return res.status(500).json({ message: 'Error al obtener el servidor de materialización' });
      }
      
    case 'PUT':
      try {
        const { 
          nombre, 
          descripcion, 
          tipo, 
          endpoint, 
          capacidad, 
          api_key, 
          configuracion, 
          estado 
        } = req.body;
        
        if (!nombre || !tipo || !endpoint) {
          return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        
        // Verificar si el servidor existe
        const existingServer = await query('SELECT id FROM materializacion_servidores WHERE id = $1', [serverId]);
        if (existingServer.length === 0) {
          return res.status(404).json({ message: 'Servidor no encontrado' });
        }
        
        // Preparar la consulta según si se actualiza el API key o no
        let queryText, queryParams;
        
        if (api_key) {
          queryText = `
            UPDATE materializacion_servidores SET
              nombre = $1, descripcion = $2, tipo = $3, 
              url = $4, capacidad = $5, api_key = $6, 
              configuracion = $7, estado = $8, fecha_actualizacion = NOW()
            WHERE id = $9
            RETURNING id
          `;
          queryParams = [
            nombre, 
            descripcion, 
            tipo, 
            endpoint, 
            capacidad || 10, 
            api_key, 
            configuracion ? JSON.stringify(configuracion) : '{}',
            estado || 'pendiente',
            serverId
          ];
        } else {
          // No actualizar el API key si no se proporcionó
          queryText = `
            UPDATE materializacion_servidores SET
              nombre = $1, descripcion = $2, tipo = $3, 
              url = $4, capacidad = $5, 
              configuracion = $6, estado = $7, fecha_actualizacion = NOW()
            WHERE id = $8
            RETURNING id
          `;
          queryParams = [
            nombre, 
            descripcion, 
            tipo, 
            endpoint, 
            capacidad || 10, 
            configuracion ? JSON.stringify(configuracion) : '{}',
            estado || 'pendiente',
            serverId
          ];
        }
        
        const result = await query(queryText, queryParams);
        
        return res.status(200).json({ 
          id: result[0].id, 
          message: 'Servidor actualizado correctamente' 
        });
      } catch (error) {
        console.error('Error al actualizar servidor:', error);
        return res.status(500).json({ message: 'Error al actualizar el servidor de materialización' });
      }
      
    case 'DELETE':
      try {
        // Verificar si el servidor existe
        const existingServer = await query('SELECT id FROM materializacion_servidores WHERE id = $1', [serverId]);
        if (existingServer.length === 0) {
          return res.status(404).json({ message: 'Servidor no encontrado' });
        }
        
        // Verificar si el servidor está siendo utilizado en materializaciones
        const usedInMaterializations = await query(`
          SELECT id FROM materializaciones WHERE servidor_id = $1 LIMIT 1
        `, [serverId]);
        
        if (usedInMaterializations.length > 0) {
          return res.status(400).json({ 
            message: 'No se puede eliminar este servidor porque está siendo utilizado en materializaciones activas' 
          });
        }
        
        // Eliminar el servidor
        await query('DELETE FROM materializacion_servidores WHERE id = $1', [serverId]);
        
        return res.status(200).json({ message: 'Servidor eliminado correctamente' });
      } catch (error) {
        console.error('Error al eliminar servidor:', error);
        return res.status(500).json({ message: 'Error al eliminar el servidor de materialización' });
      }
      
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}
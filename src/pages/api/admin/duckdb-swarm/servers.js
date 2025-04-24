import { db } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // GET - Listar servidores
    if (method === 'GET') {
      // Como estamos integrando con el servidor externo Flask/DuckDB, vamos a simular datos para pruebas
      // En una implementación real, estos datos vendrían de la base de datos o del API de Flask
      const servers = [
        { 
          id: 1, 
          hostname: 'duckdb-primary', 
          port: 1294, 
          server_type: 'general',
          status: 'active'
        },
        { 
          id: 2, 
          hostname: 'duckdb-analytics', 
          port: 1295, 
          server_type: 'analytics',
          status: 'standby'
        }
      ];

      return res.status(200).json({ servers });
    }

    // POST - Agregar servidor
    if (method === 'POST') {
      const { hostname, port, server_type } = req.body;

      // Validación básica
      if (!hostname || !port || !server_type) {
        return res.status(400).json({ error: 'Se requieren hostname, port y server_type' });
      }

      // En una implementación real, aquí insertaríamos el servidor en la base de datos
      // y devolveríamos el resultado
      const server = {
        id: 3, // Simulado
        hostname,
        port,
        server_type,
        status: 'starting'
      };

      return res.status(201).json({ server });
    }

    // DELETE - Eliminar servidor
    if (method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Se requiere ID del servidor' });
      }
      
      // En una implementación real, aquí eliminaríamos el servidor de la base de datos
      return res.status(200).json({ success: true });
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en el servidor DuckDB:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
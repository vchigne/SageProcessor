export default async function handler(req, res) {
  const { method } = req;

  try {
    // GET - Listar bases de datos
    if (method === 'GET') {
      // Como estamos integrando con el servidor externo Flask/DuckDB, vamos a simular datos para pruebas
      // En una implementación real, estos datos vendrían de la base de datos o del API de Flask
      const databases = [
        { 
          id: 1, 
          server_id: 1,
          hostname: 'duckdb-primary', 
          database_name: 'analytics',
          database_path: '/data/analytics.duckdb',
          size_mb: 120
        },
        { 
          id: 2, 
          server_id: 1,
          hostname: 'duckdb-primary', 
          database_name: 'reporting',
          database_path: '/data/reporting.duckdb',
          size_mb: 85
        },
        { 
          id: 3, 
          server_id: 2,
          hostname: 'duckdb-analytics', 
          database_name: 'events',
          database_path: '/data/events.duckdb',
          size_mb: 250
        }
      ];

      return res.status(200).json({ databases });
    }

    // POST - Agregar base de datos
    if (method === 'POST') {
      const { server_id, name, path, size } = req.body;

      // Validación básica
      if (!server_id || !name || !path) {
        return res.status(400).json({ error: 'Se requieren server_id, name y path' });
      }

      // En una implementación real, aquí insertaríamos la base de datos en la base de datos
      // y devolveríamos el resultado
      const database = {
        id: 4, // Simulado
        server_id,
        hostname: 'duckdb-primary', // En realidad se obtendría del servidor
        database_name: name,
        database_path: path,
        size_mb: size || 0
      };

      return res.status(201).json({ database });
    }

    // DELETE - Eliminar base de datos
    if (method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Se requiere ID de la base de datos' });
      }
      
      // En una implementación real, aquí eliminaríamos la base de datos
      return res.status(200).json({ success: true });
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en bases de datos DuckDB:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
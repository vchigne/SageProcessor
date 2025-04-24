export default async function handler(req, res) {
  const { method } = req;

  try {
    // GET - Obtener métricas
    if (method === 'GET') {
      // Como estamos integrando con el servidor externo Flask/DuckDB, vamos a simular datos para pruebas
      // En una implementación real, estos datos vendrían de la base de datos o del API de Flask
      const metrics = [
        { 
          id: 1,
          server_id: 1,
          hostname: 'duckdb-primary',
          cpu_usage: 34.5,
          memory_usage: 65.7,
          disk_usage: 42.8,
          active_connections: 5,
          queries_per_minute: 28.3,
          last_update: new Date().toISOString()
        },
        { 
          id: 2,
          server_id: 2,
          hostname: 'duckdb-analytics',
          cpu_usage: 12.1,
          memory_usage: 28.3,
          disk_usage: 16.5,
          active_connections: 2,
          queries_per_minute: 5.6,
          last_update: new Date().toISOString()
        }
      ];

      return res.status(200).json({ metrics });
    }

    // POST - Actualizar métricas
    if (method === 'POST') {
      // En una implementación real, aquí dispararíamos un proceso para actualizar las métricas
      // en todos los servidores
      
      return res.status(200).json({ success: true, message: "Actualización de métricas iniciada" });
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en métricas DuckDB:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
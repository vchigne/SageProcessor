import { db } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method, query } = req;

  try {
    // GET - Listar ejecuciones o obtener una ejecución específica
    if (method === 'GET') {
      const { id } = query;
      
      // Si se proporciona un ID, obtener la ejecución específica
      if (id) {
        try {
          const response = await fetch(`http://localhost:5001/api/executions/${id}`);
          const data = await response.json();
          
          if (response.ok) {
            return res.status(200).json(data);
          } else {
            return res.status(response.status).json(data);
          }
        } catch (error) {
          console.error(`Error al obtener la ejecución ${id}:`, error);
          return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
        }
      }
      
      // Si no se proporciona un ID, listar todas las ejecuciones
      try {
        const response = await fetch('http://localhost:5001/api/executions');
        const data = await response.json();
        
        return res.status(200).json(data);
      } catch (error) {
        console.error('Error al listar ejecuciones:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }
    
    // POST - Ejecutar un pipeline
    if (method === 'POST') {
      const { pipeline_id } = req.body;
      
      if (!pipeline_id) {
        return res.status(400).json({ error: 'Se requiere pipeline_id' });
      }
      
      try {
        const response = await fetch(`http://localhost:5001/api/pipelines/${pipeline_id}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            triggered_by: req.body.triggered_by || 'user',
            parameters: req.body.parameters || {}
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          return res.status(200).json(data);
        } else {
          return res.status(response.status).json(data);
        }
      } catch (error) {
        console.error(`Error al ejecutar el pipeline ${pipeline_id}:`, error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en las ejecuciones:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
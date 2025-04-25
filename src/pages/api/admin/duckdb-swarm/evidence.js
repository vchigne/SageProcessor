import { db } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method, query } = req;
  const { id } = query;

  try {
    // GET - Listar proyectos o obtener un proyecto específico
    if (method === 'GET') {
      // Si se proporciona un ID, obtener el proyecto específico
      if (id) {
        try {
          const response = await fetch(`http://localhost:5001/api/evidence/projects/${id}`);
          const data = await response.json();
          
          if (response.ok) {
            return res.status(200).json(data);
          } else {
            return res.status(response.status).json(data);
          }
        } catch (error) {
          console.error(`Error al obtener el proyecto ${id}:`, error);
          return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
        }
      }
      
      // Si no se proporciona un ID, listar todos los proyectos
      try {
        const response = await fetch('http://localhost:5001/api/evidence/projects');
        const data = await response.json();
        
        return res.status(200).json(data);
      } catch (error) {
        console.error('Error al listar proyectos:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }
    
    // POST - Crear un nuevo proyecto
    if (method === 'POST') {
      try {
        const response = await fetch('http://localhost:5001/api/evidence/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(req.body)
        });
        
        const data = await response.json();
        
        if (response.ok) {
          return res.status(201).json(data);
        } else {
          return res.status(response.status).json(data);
        }
      } catch (error) {
        console.error('Error al crear proyecto:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }
    
    // DELETE - Eliminar un proyecto
    if (method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ error: 'Se requiere ID del proyecto' });
      }
      
      try {
        const response = await fetch(`http://localhost:5001/api/evidence/projects/${id}`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
          return res.status(200).json(data);
        } else {
          return res.status(response.status).json(data);
        }
      } catch (error) {
        console.error(`Error al eliminar el proyecto ${id}:`, error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en los proyectos de Evidence.dev:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
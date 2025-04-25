import { db } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method, query } = req;

  try {
    // GET - Listar pipelines o obtener un pipeline específico
    if (method === 'GET') {
      const { id } = query;
      
      // Si se proporciona un ID, obtener el pipeline específico
      if (id) {
        try {
          const response = await fetch(`http://localhost:5001/api/pipelines/${id}`);
          const data = await response.json();
          
          if (response.ok) {
            return res.status(200).json(data);
          } else {
            return res.status(response.status).json(data);
          }
        } catch (error) {
          console.error(`Error al obtener el pipeline ${id}:`, error);
          return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
        }
      }
      
      // Si no se proporciona un ID, listar todos los pipelines
      try {
        const response = await fetch('http://localhost:5001/api/pipelines');
        const data = await response.json();
        
        return res.status(200).json(data);
      } catch (error) {
        console.error('Error al listar pipelines:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }
    
    // POST - Crear un nuevo pipeline
    if (method === 'POST') {
      try {
        const response = await fetch('http://localhost:5001/api/pipelines', {
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
        console.error('Error al crear pipeline:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }
    
    // PUT - Actualizar un pipeline
    if (method === 'PUT') {
      const { id } = query;
      
      if (!id) {
        return res.status(400).json({ error: 'Se requiere ID del pipeline' });
      }
      
      try {
        const response = await fetch(`http://localhost:5001/api/pipelines/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(req.body)
        });
        
        const data = await response.json();
        
        if (response.ok) {
          return res.status(200).json(data);
        } else {
          return res.status(response.status).json(data);
        }
      } catch (error) {
        console.error(`Error al actualizar el pipeline ${id}:`, error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }
    
    // DELETE - Eliminar un pipeline
    if (method === 'DELETE') {
      const { id } = query;
      
      if (!id) {
        return res.status(400).json({ error: 'Se requiere ID del pipeline' });
      }
      
      try {
        const response = await fetch(`http://localhost:5001/api/pipelines/${id}`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
          return res.status(200).json(data);
        } else {
          return res.status(response.status).json(data);
        }
      } catch (error) {
        console.error(`Error al eliminar el pipeline ${id}:`, error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en los pipelines:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
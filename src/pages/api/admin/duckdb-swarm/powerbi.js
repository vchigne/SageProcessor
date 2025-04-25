import { db } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method, query } = req;
  const { id, action } = query;

  try {
    // GET - Listar datasets o obtener un dataset específico
    if (method === 'GET') {
      // Si se proporciona un ID, obtener el dataset específico
      if (id) {
        try {
          const response = await fetch(`http://localhost:5001/api/powerbi/datasets/${id}`);
          const data = await response.json();
          
          if (response.ok) {
            return res.status(200).json(data);
          } else {
            return res.status(response.status).json(data);
          }
        } catch (error) {
          console.error(`Error al obtener el dataset ${id}:`, error);
          return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
        }
      }
      
      // Si no se proporciona un ID, listar todos los datasets
      try {
        const response = await fetch('http://localhost:5001/api/powerbi/datasets');
        const data = await response.json();
        
        return res.status(200).json(data);
      } catch (error) {
        console.error('Error al listar datasets:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }
    
    // POST - Crear un nuevo dataset o refrescar un dataset existente
    if (method === 'POST') {
      // Si se proporciona un ID y la acción es "refresh", refrescar el dataset
      if (id && action === 'refresh') {
        try {
          const response = await fetch(`http://localhost:5001/api/powerbi/datasets/${id}/refresh`, {
            method: 'POST',
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
          console.error(`Error al refrescar el dataset ${id}:`, error);
          return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
        }
      }
      
      // Si no se proporciona un ID, crear un nuevo dataset
      try {
        const response = await fetch('http://localhost:5001/api/powerbi/datasets', {
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
        console.error('Error al crear dataset:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }
    
    // DELETE - Eliminar un dataset
    if (method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ error: 'Se requiere ID del dataset' });
      }
      
      try {
        const response = await fetch(`http://localhost:5001/api/powerbi/datasets/${id}`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
          return res.status(200).json(data);
        } else {
          return res.status(response.status).json(data);
        }
      } catch (error) {
        console.error(`Error al eliminar el dataset ${id}:`, error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en los datasets de PowerBI:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
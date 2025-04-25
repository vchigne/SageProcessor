import { db } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // GET - Listar proveedores de nube
    if (method === 'GET') {
      // Obtener los proveedores de nube desde la API Flask
      const response = await fetch('http://localhost:5001/api/storage/providers');
      const data = await response.json();
      
      return res.status(200).json(data);
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en los proveedores de nube:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
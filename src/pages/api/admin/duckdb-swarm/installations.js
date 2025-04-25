import { db } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // GET - Listar instalaciones SAGE
    if (method === 'GET') {
      // Obtener las instalaciones desde la API Flask
      const response = await fetch('http://localhost:5001/api/sage/installations');
      
      // Si el endpoint no está implementado aún, devolvemos datos de ejemplo
      if (!response.ok) {
        // Datos simulados para desarrollo
        const installations = [
          { 
            id: 1, 
            name: 'SAGE Principal',
            hostname: 'sage-main.company.com',
            status: 'active',
            version: '3.5.2'
          },
          { 
            id: 2, 
            name: 'SAGE Backup',
            hostname: 'sage-backup.company.com',
            status: 'standby',
            version: '3.5.1'
          },
          { 
            id: 3, 
            name: 'SAGE Development',
            hostname: 'sage-dev.company.com',
            status: 'active',
            version: '3.6.0-beta'
          }
        ];
        
        return res.status(200).json({ installations });
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en las instalaciones SAGE:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
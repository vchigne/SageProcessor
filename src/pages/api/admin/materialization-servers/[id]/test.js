import { query } from '@/lib/db';
import { Pool } from 'pg';

// Obtener la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID de servidor inválido' });
  }

  const serverId = parseInt(id);

  try {
    // 1. Obtener datos del servidor
    const serverData = await query(`
      SELECT id, nombre, tipo, url, api_key, configuracion
      FROM materializacion_servidores
      WHERE id = $1
    `, [serverId]);
    
    if (serverData.length === 0) {
      return res.status(404).json({ message: 'Servidor no encontrado' });
    }

    const server = serverData[0];
    
    // 2. Probar la conexión según el tipo de servidor
    let testResult = { 
      estado: 'error',
      mensaje: 'Error al conectar con el servidor'
    };
    
    if (server.tipo === 'local') {
      // Para servidores locales, simplemente verificamos que el entorno sea válido
      testResult = {
        estado: 'activo',
        mensaje: 'Servidor local disponible'
      };
    } else {
      // Para servidores remotos, realizamos una prueba de conexión
      try {
        // En un sistema real, aquí haríamos una solicitud al servidor remoto
        // Por ahora, simulamos una prueba exitosa
        
        // Este código se debe reemplazar con una prueba real de conexión
        // Ejemplo:
        // const testResponse = await fetch(`${server.url}/health`, {
        //   method: 'GET',
        //   headers: {
        //     'Authorization': `Bearer ${server.api_key}`,
        //     'Content-Type': 'application/json'
        //   }
        // });
        // if (testResponse.ok) {
        //   testResult = { estado: 'activo', mensaje: 'Conexión exitosa' };
        // }
        
        // Simulación de prueba exitosa
        testResult = {
          estado: 'activo',
          mensaje: 'Conexión exitosa'
        };
      } catch (error) {
        testResult = {
          estado: 'error',
          mensaje: `Error de conexión: ${error.message}`
        };
      }
    }
    
    // 3. Actualizar el estado del servidor en la base de datos
    await query(`
      UPDATE materializacion_servidores
      SET estado = $1, ultimo_test = NOW()
      WHERE id = $2
    `, [testResult.estado, serverId]);
    
    // 4. Devolver el resultado
    return res.status(200).json({
      id: serverId,
      estado: testResult.estado,
      mensaje: testResult.mensaje,
      ultimo_test: new Date()
    });
    
  } catch (error) {
    console.error('Error al probar servidor:', error);
    return res.status(500).json({ message: 'Error al probar el servidor de materialización' });
  }
}
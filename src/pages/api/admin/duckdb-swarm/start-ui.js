import { pool } from '@/utils/db';

async function getServer(serverId) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM duckdb_servers WHERE id = $1',
      [serverId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo servidor:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // Solo permitir POST para iniciar UI
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { serverId } = req.body;

    if (!serverId) {
      return res.status(400).json({ success: false, error: 'Se requiere ID del servidor' });
    }

    // Obtener información del servidor desde la base de datos
    const server = await getServer(serverId);
    
    if (!server) {
      return res.status(404).json({ success: false, error: 'Servidor no encontrado' });
    }

    if (server.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        error: `El servidor debe estar activo para iniciar la UI. Estado actual: ${server.status}` 
      });
    }
    
    // Construir URL de la API DuckDB para iniciar la UI Notebook
    const duckDBApiURL = `http://localhost:5001`;
    
    // Realizar solicitud al endpoint de notebook UI del servidor DuckDB
    const duckDBUIResponse = await fetch(`${duckDBApiURL}/api/servers/${serverId}/notebook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (!duckDBUIResponse.ok) {
      const errorData = await duckDBUIResponse.json().catch(() => ({ message: 'Error desconocido' }));
      return res.status(duckDBUIResponse.status).json({
        success: false,
        error: `Error al iniciar UI DuckDB: ${errorData.message || errorData.error || 'Error desconocido'}`
      });
    }
    
    const uiData = await duckDBUIResponse.json();
    
    // Devolver la URL de la UI
    return res.status(200).json({
      success: true,
      ui_url: uiData.ui_url || `${duckDBApiURL}/ui`,
      message: 'UI de DuckDB iniciada correctamente'
    });
  } catch (error) {
    console.error('Error al iniciar UI DuckDB:', error);
    return res.status(500).json({
      success: false,
      error: `Error interno del servidor: ${error.message}`
    });
  }
}
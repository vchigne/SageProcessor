// Endpoint para reparar los servicios VNC en un servidor DuckDB
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed, use POST' });
  }

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ success: false, error: 'Missing server ID' });
  }

  try {
    // Llamar al API de DuckDB Swarm para reparar VNC
    const response = await axios.post(`http://localhost:5001/api/servers/${id}/vnc/repair`);
    const data = response.data;
    
    return res.status(200).json({
      success: true,
      message: 'Reparación VNC iniciada correctamente',
      vnc_active: data.vnc_active,
      novnc_active: data.novnc_active,
      details: data.details,
      repair_output: data.repair_output
    });
  } catch (error) {
    console.error(`Error al reparar VNC para el servidor ${id}:`, error);
    
    // Extraer mensaje de error de la respuesta (si existe)
    const errorMessage = error.response?.data?.error || error.message || 'Error desconocido';
    
    return res.status(500).json({
      success: false,
      error: `Error al reparar VNC: ${errorMessage}`
    });
  }
}
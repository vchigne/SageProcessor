// Endpoint para reparar los servicios VNC en un servidor DuckDB

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
    const response = await fetch(`http://localhost:5001/api/servers/${id}/vnc/repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en la respuesta de la API: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
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
    
    return res.status(500).json({
      success: false,
      error: `Error al reparar VNC: ${error.message || 'Error desconocido'}`
    });
  }
}
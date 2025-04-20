/**
 * Endpoint para probar la visualización de buckets directamente
 */
export default async function handler(req, res) {
  try {
    // Simular el acceso al servicio interno
    const response = await fetch('http://localhost:5000/api/cloud-secrets/1/buckets');
    const data = await response.json();
    
    // Devolver los datos directamente
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al obtener buckets:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener buckets: ' + error.message 
    });
  }
}
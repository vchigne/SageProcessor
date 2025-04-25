/**
 * Proxy para redirigir las peticiones de API a nuestro servidor DuckDB Swarm API (Flask)
 * 
 * Este archivo sirve como intermediario entre la interfaz web de Next.js y la API Flask,
 * permitiendo que los componentes de React se comuniquen con el servidor Flask sin problemas de CORS.
 */

export default async function handler(req, res) {
  const { method, query, body } = req;
  const { endpoint } = query;

  // URL base de la API de Flask
  const baseApiUrl = 'http://localhost:5001/api';
  
  // Construir la URL de destino, eliminando "proxy" de la ruta
  let targetUrl = `${baseApiUrl}/${endpoint || ''}`;
  
  try {
    // Configurar las opciones de fetch para la redirección
    const fetchOptions = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    // Si hay un cuerpo en la solicitud y el método no es GET, agregarlo a las opciones
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }
    
    // Hacer la solicitud al servidor Flask
    const flaskResponse = await fetch(targetUrl, fetchOptions);
    
    // Obtener el cuerpo de la respuesta como texto
    const responseText = await flaskResponse.text();
    
    // Intentar parsear la respuesta como JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      // Si no es JSON, devolver el texto tal cual
      responseData = responseText;
    }
    
    // Devolver la respuesta al cliente con el mismo código de estado
    return res.status(flaskResponse.status).json(responseData);
    
  } catch (error) {
    console.error(`Error al redirigir la solicitud a ${targetUrl}:`, error);
    return res.status(500).json({ error: 'Error al conectar con el servidor DuckDB Swarm' });
  }
}
import { getPool } from '../../../../lib/db';
import { getCloudAdapter } from '../../../../utils/cloud';

export default async function handler(req, res) {
  // Solo aceptamos POST para esta acción
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id } = req.query;
  const { path = '', limit = 50 } = req.body;

  try {
    // 1. Obtener información del proveedor de la base de datos
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM cloud_providers WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    const provider = result.rows[0];
    
    // Asegurarnos de que las credenciales y configuración son objetos
    const credenciales = typeof provider.credenciales === 'string' 
      ? JSON.parse(provider.credenciales) 
      : provider.credenciales;
      
    const configuracion = typeof provider.configuracion === 'string' 
      ? JSON.parse(provider.configuracion) 
      : provider.configuracion;

    // 2. Crear el adaptador para el tipo de proveedor
    const adapter = getCloudAdapter(provider.tipo, {
      ...credenciales,
      ...configuracion
    });

    // 3. Listar el contenido del bucket/contenedor
    const contents = await adapter.listContents(path, limit);

    // 4. Guardar la fecha de última verificación exitosa
    await pool.query(
      'UPDATE cloud_providers SET ultima_verificacion = NOW(), ultima_verificacion_ok = true WHERE id = $1',
      [id]
    );

    return res.status(200).json({ 
      success: true, 
      provider: {
        id: provider.id,
        nombre: provider.nombre,
        tipo: provider.tipo
      },
      path,
      contents
    });
  } catch (error) {
    console.error('Error al inspeccionar proveedor cloud:', error);
    
    // Si es un error de conexión, actualizar la fecha de verificación como fallida
    try {
      const pool = getPool();
      await pool.query(
        'UPDATE cloud_providers SET ultima_verificacion = NOW(), ultima_verificacion_ok = false WHERE id = $1',
        [id]
      );
    } catch (dbError) {
      console.error('Error al actualizar estado de verificación:', dbError);
    }

    return res.status(500).json({ 
      success: false, 
      message: `Error al inspeccionar proveedor cloud: ${error.message}` 
    });
  }
}
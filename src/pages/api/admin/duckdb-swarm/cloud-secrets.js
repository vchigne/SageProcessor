import { db } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // GET - Listar cloud secrets
    if (method === 'GET') {
      // Obtener los cloud secrets directamente desde la base de datos
      const secrets = await db.query(`
        SELECT id, nombre, tipo, descripcion, activo
        FROM cloud_secrets
        WHERE activo = true
        ORDER BY nombre
      `);
      
      return res.status(200).json({ success: true, secrets });
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en cloud secrets:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
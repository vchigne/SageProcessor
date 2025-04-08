import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Conectar a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      try {
        // Parámetros de filtrado opcionales
        const { tipo, activo, busqueda } = req.query;
        
        let query = `
          SELECT 
            id, 
            tipo, 
            nombre, 
            email, 
            telefono, 
            fecha_creacion, 
            fecha_modificacion, 
            activo
          FROM 
            suscriptores
          WHERE 
            1=1
        `;
        
        const queryParams: any[] = [];
        let paramCounter = 1;
        
        // Aplicar filtros si se proporcionan
        if (tipo) {
          query += ` AND tipo = $${paramCounter}`;
          queryParams.push(tipo);
          paramCounter++;
        }
        
        if (activo !== undefined) {
          query += ` AND activo = $${paramCounter}`;
          queryParams.push(activo === 'true');
          paramCounter++;
        }
        
        if (busqueda) {
          query += ` AND (
            nombre ILIKE $${paramCounter} 
            OR email ILIKE $${paramCounter}
            OR telefono ILIKE $${paramCounter}
          )`;
          queryParams.push(`%${busqueda}%`);
          paramCounter++;
        }
        
        query += ` ORDER BY nombre ASC`;
        
        const result = await pool.query(query, queryParams);
        
        return res.status(200).json(result.rows);
      } catch (error: any) {
        console.error('Error al obtener suscriptores:', error);
        return res.status(500).json({ 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
    case 'POST':
      try {
        const { tipo, nombre, email, telefono } = req.body;
        
        // Validar campos requeridos
        if (!tipo || !nombre) {
          return res.status(400).json({ error: 'Tipo y nombre son campos requeridos' });
        }
        
        // Validar tipos permitidos
        if (!['humano', 'tecnico'].includes(tipo)) {
          return res.status(400).json({ error: 'Tipo debe ser "humano" o "tecnico"' });
        }
        
        // Si es humano, el email es obligatorio
        if (tipo === 'humano' && !email) {
          return res.status(400).json({ error: 'Email es requerido para suscriptores humanos' });
        }
        
        const query = `
          INSERT INTO suscriptores (
            tipo, 
            nombre, 
            email, 
            telefono
          ) 
          VALUES ($1, $2, $3, $4) 
          RETURNING *
        `;
        
        const values = [tipo, nombre, email || null, telefono || null];
        const result = await pool.query(query, values);
        
        return res.status(201).json(result.rows[0]);
      } catch (error: any) {
        console.error('Error al crear suscriptor:', error);
        return res.status(500).json({ 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
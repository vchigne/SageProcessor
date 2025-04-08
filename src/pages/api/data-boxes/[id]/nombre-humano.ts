import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import yaml from 'yaml';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    const client = await pool.connect();
    try {
      // Obtener los datos de la casilla usando el nuevo modelo
      const result = await client.query(
        `SELECT nombre, descripcion, yaml_contenido, nombre_yaml
         FROM casillas 
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Data box not found' });
      }

      const casilla = result.rows[0];
      let nombre_humano = casilla.nombre || '';
      let descripcion = casilla.descripcion || '';
      
      // Si no hay nombre/descripción explícitos, intentamos extraerlos del YAML
      if ((!nombre_humano || !descripcion) && casilla.yaml_contenido) {
        try {
          const parsedYaml = yaml.parse(casilla.yaml_contenido);
          
          // Extraer nombre y descripción del YAML solo si no están definidos en la casilla
          if (parsedYaml && typeof parsedYaml === 'object') {
            if (!nombre_humano && parsedYaml.nombre) {
              nombre_humano = parsedYaml.nombre;
            }
            if (!descripcion && parsedYaml.descripcion) {
              descripcion = parsedYaml.descripcion;
            }
          }
        } catch (parseError) {
          console.error('Error parsing YAML content:', parseError);
          // Si hay error de parseo, continuamos con valores ya extraídos
        }
      }

      res.status(200).json({ 
        nombre_yaml: casilla.nombre_yaml,
        nombre_humano,
        descripcion
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching YAML human name:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
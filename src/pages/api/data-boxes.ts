import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import yaml from 'yaml';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Función para validar el YAML usando el validador de SAGE
async function validateYamlWithSage(yamlContent: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Crear un directorio temporal para el archivo YAML
    const tempDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tempDir, { recursive: true });

    const tempFile = path.join(tempDir, `${uuidv4()}.yaml`);
    console.log('Escribiendo YAML temporal en:', tempFile);
    await fs.writeFile(tempFile, yamlContent);

    return new Promise((resolve) => {
      console.log('Ejecutando validador SAGE...');
      const pythonPath = path.join(process.cwd(), 'sage');
      const validator = spawn('python3', ['-m', 'sage.validate_yaml', tempFile], {
        env: { 
          ...process.env, 
          PYTHONPATH: process.cwd()
        }
      });

      let output = '';
      let error = '';

      validator.stdout.on('data', (data) => {
        const dataStr = data.toString();
        console.log('Validator stdout:', dataStr);
        output += dataStr;
      });

      validator.stderr.on('data', (data) => {
        const dataStr = data.toString();
        console.error('Validator stderr:', dataStr);
        error += dataStr;
      });

      validator.on('error', (err) => {
        console.error('Error spawning validator:', err);
        resolve({ 
          isValid: false, 
          error: `Error executing validator: ${err.message}` 
        });
      });

      validator.on('close', async (code) => {
        console.log('Validator exit code:', code);
        // Limpiar el archivo temporal
        await fs.unlink(tempFile).catch(console.error);

        if (code === 0) {
          resolve({ isValid: true });
        } else {
          resolve({ 
            isValid: false, 
            error: error || output || 'Error validando el archivo YAML' 
          });
        }
      });
    });
  } catch (error) {
    console.error('Error en la validación del YAML:', error);
    return { 
      isValid: false, 
      error: `Error interno validando el YAML: ${error.message}` 
    };
  }
}

// Add new function to generate unique YAML name
async function generateUniqueYamlName(client: any, baseName: string): Promise<string> {
  // Get base name without extension
  const nameWithoutExt = baseName.replace(/\.ya?ml$/i, '');
  const ext = baseName.match(/\.ya?ml$/i)?.[0] || '.yaml';

  // Check if base name exists in casillas
  const result = await client.query(
    `SELECT nombre_yaml FROM casillas 
     WHERE nombre_yaml ~ $1
     ORDER BY nombre_yaml`,
    [`^${nameWithoutExt}(?:\([0-9]+\))?${ext}$`]
  );

  if (result.rows.length === 0) {
    return baseName;
  }

  // Find first available number
  let counter = 1;
  const existingNames = new Set(result.rows.map(row => row.nombre_yaml));

  while (true) {
    const newName = `${nameWithoutExt}(${counter})${ext}`;
    if (!existingNames.has(newName)) {
      return newName;
    }
    counter++;
  }
}

// Función para extraer metadatos del contenido YAML
function extraerMetadatosYaml(contenido: string): { nombre: string, descripcion: string } {
  try {
    // Valores por defecto
    let nombre = '';
    let descripcion = '';
    
    // Usar el parser de YAML en lugar de expresiones regulares
    const parsedYaml = yaml.parse(contenido);
    
    // Extraer los metadatos del objeto YAML parseado
    if (parsedYaml && parsedYaml.sage_yaml) {
      nombre = parsedYaml.sage_yaml.name || '';
      descripcion = parsedYaml.sage_yaml.description || '';
    }
    
    return { nombre, descripcion };
  } catch (e) {
    console.error('Error extrayendo metadatos del YAML:', e);
    return { nombre: '', descripcion: '' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      console.log('Creating new data box with data:', req.body);
      const { instalacion_id, nombre_yaml, yaml_content, yaml_contenido, api_endpoint, email_casilla } = req.body;
      
      // Aquí manejamos tanto yaml_content como yaml_contenido para mantener compatibilidad
      const yamlContent = yaml_contenido || yaml_content;

      if (!instalacion_id || !nombre_yaml || !yamlContent) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validar el YAML antes de crear el casillero
      console.log('Validando YAML...');
      const validationResult = await validateYamlWithSage(yamlContent);
      console.log('Resultado de validación:', validationResult);

      if (!validationResult.isValid) {
        return res.status(400).json({ 
          error: 'YAML validation failed', 
          details: validationResult.error 
        });
      }

      const client = await pool.connect();
      await client.query('BEGIN');

      try {
        // Generate unique name for the YAML file
        const uniqueYamlName = await generateUniqueYamlName(client, nombre_yaml);
        console.log('Generated unique YAML name:', uniqueYamlName);

        // Extraer metadatos del YAML
        const { nombre, descripcion } = extraerMetadatosYaml(yamlContent);

        console.log('Creating data box...');
        const result = await client.query(
          `INSERT INTO casillas 
           (instalacion_id, nombre_yaml, api_endpoint, email_casilla, is_active, creado_en, nombre, descripcion, yaml_contenido) 
           VALUES ($1, $2, $3, $4, true, NOW(), $5, $6, $7)
           RETURNING id`,
          [instalacion_id, uniqueYamlName, api_endpoint, email_casilla, nombre, descripcion, yamlContent]
        );

        await client.query('COMMIT');
        console.log('Data box created successfully with ID:', result.rows[0].id);
        res.status(201).json({ 
          id: result.rows[0].id,
          nombre_yaml: uniqueYamlName 
        });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in transaction:', err);
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error creating data box:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const client = await pool.connect();
      const result = await client.query(`
        SELECT 
          c.id,
          c.instalacion_id,
          c.nombre_yaml,
          c.api_endpoint,
          c.email_casilla,
          c.is_active,
          c.nombre,
          c.descripcion,
          c.yaml_contenido,
          i.id as instalacion_id,
          o.nombre as organizacion_nombre,
          p.nombre as producto_nombre,
          pa.nombre as pais_nombre
        FROM casillas c
        JOIN instalaciones i ON c.instalacion_id = i.id
        JOIN organizaciones o ON i.organizacion_id = o.id
        JOIN productos p ON i.producto_id = p.id
        JOIN paises pa ON i.pais_id = pa.id
        ORDER BY c.id DESC;
      `);
      client.release();

      const dataBoxes = result.rows.map(row => {
        let yamlContent = null;
        
        // Usar los metadatos ya extraídos
        yamlContent = {
          name: row.nombre || '',
          description: row.descripcion || ''
        };
        
        // Si no hay metadatos extraídos y tenemos contenido YAML, intentar extraerlos de nuevo
        if ((!yamlContent.name || !yamlContent.description) && row.yaml_contenido) {
          try {
            const parsed = yaml.parse(row.yaml_contenido);
            if (parsed.sage_yaml) {
              if (!yamlContent.name && parsed.sage_yaml.name) {
                yamlContent.name = parsed.sage_yaml.name;
              }
              if (!yamlContent.description && parsed.sage_yaml.description) {
                yamlContent.description = parsed.sage_yaml.description;
              }
            }
          } catch (e) {
            console.error('Error parsing YAML:', e);
          }
        }

        return {
          id: row.id,
          instalacion: {
            id: row.instalacion_id,
            nombre: `${row.producto_nombre} - ${row.organizacion_nombre} (${row.pais_nombre})`,
            organizacion: {
              nombre: row.organizacion_nombre
            },
            producto: {
              nombre: row.producto_nombre
            },
            pais: {
              nombre: row.pais_nombre
            }
          },
          nombre_yaml: row.nombre_yaml,
          yaml_content: yamlContent,
          api_endpoint: row.api_endpoint,
          email_casilla: row.email_casilla,
          is_active: row.is_active,
          nombre: row.nombre,
          descripcion: row.descripcion
        };
      });

      res.status(200).json(dataBoxes || []);
    } catch (error) {
      console.error('Error fetching data boxes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    // Obtener el ID del query param o del body
    const id = req.query.id || req.body.id;
    
    if (!id) {
      return res.status(400).json({ error: 'ID is required for update operation' });
    }
    
    console.log('Updating data box with ID:', id);
    
    try {
      const { instalacion_id, nombre_yaml, yaml_content, yaml_contenido, api_endpoint, email_casilla, is_active } = req.body;
      
      // Mantener compatibilidad con ambos nombres de campo
      const yamlContent = yaml_contenido || yaml_content;
      
      console.log('Update data:', { 
        instalacion_id, 
        nombre_yaml, 
        api_endpoint, 
        email_casilla, 
        is_active 
      });
      
      const client = await pool.connect();
      await client.query('BEGIN');

      try {
        // Prepara los datos a actualizar
        let updateData: any = {
          instalacion_id,
          nombre_yaml,
          api_endpoint,
          email_casilla,
          is_active
        };
        
        // Si se proporciona nuevo contenido YAML, actualizar metadatos
        if (yamlContent) {
          const { nombre, descripcion } = extraerMetadatosYaml(yamlContent);
          updateData.yaml_contenido = yamlContent;
          updateData.nombre = nombre;
          updateData.descripcion = descripcion;
        }
        
        // Construir la consulta dinámicamente basada en los campos disponibles
        const fields = Object.keys(updateData);
        const placeholders = fields.map((field, index) => `${field} = $${index + 1}`);
        const values = Object.values(updateData);
        
        // Actualizamos la casilla
        const query = `
          UPDATE casillas 
          SET ${placeholders.join(', ')}
          WHERE id = $${fields.length + 1}
          RETURNING id
        `;
        
        const result = await client.query(query, [...values, id]);

        await client.query('COMMIT');

        if (result.rowCount === 0) {
          res.status(404).json({ error: 'Data box not found' });
        } else {
          res.status(200).json({ id: result.rows[0].id });
        }
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error updating data box:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    // Obtener el ID del query param o del body
    const id = req.query.id || req.body.id;
    
    if (!id) {
      return res.status(400).json({ error: 'ID is required for delete operation' });
    }
    
    console.log('Deleting data box with ID:', id);
    
    try {
      const client = await pool.connect();

      // Eliminamos directamente la casilla
      const result = await client.query('DELETE FROM casillas WHERE id = $1 RETURNING id', [id]);

      client.release();
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Data box not found' });
      }
      
      res.status(200).json({ message: 'Data box deleted successfully' });
    } catch (error) {
      console.error('Error deleting data box:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
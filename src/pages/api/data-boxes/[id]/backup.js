import { pool } from "../../../../lib/db";

/**
 * API Handler para crear backups de casillas de datos
 * 
 * POST /api/data-boxes/:id/backup
 * Crea un backup del YAML de una casilla de datos
 */
export default async function handler(req, res) {
  // Solo permitimos método POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: "ID de casilla inválido" });
    }

    const casilla_id = id;

    // 1. Obtener la información actual de la casilla
    const { rows: casillas } = await pool.query(
      "SELECT * FROM casillas WHERE id = $1",
      [casilla_id]
    );

    if (casillas.length === 0) {
      return res.status(404).json({ error: "Casilla no encontrada" });
    }

    const casilla = casillas[0];

    // 2. Obtener el contenido YAML actual
    // El contenido YAML está directamente en la tabla de casillas
    const yamlContent = casilla.yaml_contenido;

    if (!yamlContent) {
      return res.status(404).json({ error: "Contenido YAML no encontrado" });
    }

    // 3. Crear entrada en la tabla de backups
    const timestamp = new Date().toISOString();
    const backupName = `backup_${casilla.nombre_yaml.replace(/\.[^/.]+$/, "")}_${timestamp.replace(/\D/g, "").substring(0, 14)}`;
    
    const { rows: backupResult } = await pool.query(
      `INSERT INTO casillas_backup (
        casilla_id, 
        nombre_backup, 
        yaml_contenido, 
        created_at
      ) VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [casilla_id, backupName, yamlContent]
    );

    if (!backupResult || backupResult.length === 0) {
      throw new Error("Error al crear el backup");
    }

    return res.status(200).json({ 
      success: true, 
      message: "Backup creado exitosamente", 
      backup_id: backupResult[0].id,
      backup_name: backupName
    });

  } catch (error) {
    console.error("Error al crear backup:", error);
    return res.status(500).json({ error: "Error al crear el backup: " + error.message });
  }
}


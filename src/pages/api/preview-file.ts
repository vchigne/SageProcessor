import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { parse as csvParse } from 'csv-parse/sync';
import xlsx from 'xlsx';
import { ZipFile } from 'yazl';

const execAsync = promisify(exec);

export const config = {
  api: {
    bodyParser: false,
  },
};

// Función para detectar BOM en un archivo
const detectBom = async (filePath: string): Promise<boolean> => {
  try {
    // Leer los primeros bytes del archivo para detectar BOM
    const fd = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(3);
    await fd.read(buffer, 0, 3, 0);
    await fd.close();
    
    // BOM UTF-8: EF BB BF
    return buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
  } catch (error) {
    console.error('Error detectando BOM:', error);
    return false;
  }
};

const readCsvFile = async (filePath: string) => {
  // Detectar si el archivo tiene BOM
  const hasBom = await detectBom(filePath);
  
  // Elegir la codificación adecuada basada en la presencia de BOM
  let content;
  if (hasBom) {
    // Leer como buffer y convertir manualmente
    const buffer = await fs.readFile(filePath);
    // Quitar los 3 bytes del BOM y convertir a string
    content = buffer.slice(3).toString('utf-8');
  } else {
    // Leer normalmente
    content = await fs.readFile(filePath, 'utf-8');
  }
  
  // Intenta detectar el delimitador
  const detectDelimiter = (content: string): string => {
    // Tomar la primera línea de contenido
    const firstLine = content.split('\n')[0].trim();
    
    // Lista de posibles delimitadores con su frecuencia
    const delimiters = ['|', ',', ';', '\t'];
    let maxCount = 0;
    let bestDelimiter = '|'; // Por defecto usamos pipe
    
    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    }
    
    return bestDelimiter;
  };
  
  // Determinar delimitador
  const delimiter = detectDelimiter(content);
  console.log(`Delimitador detectado para ${path.basename(filePath)}: '${delimiter}'`);
  
  try {
    // Intentar parsear con delimitador detectado
    const records = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: delimiter,
      trim: true // Eliminar espacios en blanco alrededor de los valores
    });
    
    if (records.length > 0 && Object.keys(records[0]).length === 1) {
      // Si solo se detectó una columna, significa que el delimitador puede estar mal
      // Intentar dividir manualmente la primera fila para obtener las columnas
      const firstRow = content.split('\n')[0].trim();
      const columns = firstRow.split(delimiter);
      
      if (columns.length > 1) {
        // Crear manualmente registros dividiendo cada línea
        const manualRecords = content.split('\n')
          .filter(line => line.trim().length > 0)
          .slice(1) // Ignorar la primera línea (cabecera)
          .map(line => {
            const values = line.split(delimiter);
            const record: Record<string, string> = {};
            
            columns.forEach((column, index) => {
              record[column] = values[index] || '';
            });
            
            return record;
          });
          
        return {
          total_records: manualRecords.length,
          preview_records: manualRecords.slice(0, 10),
          columns: columns,
          has_bom: hasBom,
          manual_parsing: true
        };
      }
    }
    
    return {
      total_records: records.length,
      preview_records: records.slice(0, 10),
      columns: Object.keys(records[0] || {}),
      has_bom: hasBom
    };
  } catch (error) {
    console.error(`Error parsing CSV with delimiter '${delimiter}':`, error);
    
    // Si falla el parsing, intenta un enfoque más simple
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const columns = lines[0].split(delimiter).map(col => col.trim());
    
    const manualRecords = lines.slice(1, 11).map(line => {
      const values = line.split(delimiter);
      const record: Record<string, string> = {};
      
      columns.forEach((column, index) => {
        record[column] = values[index] || '';
      });
      
      return record;
    });
    
    return {
      total_records: lines.length - 1,
      preview_records: manualRecords,
      columns: columns,
      has_bom: hasBom,
      manual_parsing: true
    };
  }
};

const readExcelFile = (filePath: string) => {
  const workbook = xlsx.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = xlsx.utils.sheet_to_json(firstSheet);

  return {
    total_records: records.length,
    preview_records: records.slice(0, 10),
    columns: Object.keys(records[0] || {})
  };
};

const readZipFile = async (filePath: string) => {
  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });

  const command = `unzip -l "${filePath}"`;
  const { stdout } = await execAsync(command);

  const fileList = stdout
    .split('\n')
    .slice(3, -3)
    .map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts.slice(3).join(' '),
        size: parts[0]
      };
    })
    .filter(file => file.name.match(/\.(csv|xlsx?)$/i));

  // Extraer y leer cada archivo
  const extractCommand = `unzip -o "${filePath}" -d "${tmpDir}"`;
  await execAsync(extractCommand);

  const filesContent = await Promise.all(
    fileList.map(async (file) => {
      const filePath = path.join(tmpDir, file.name);
      const isExcel = /\.xlsx?$/i.test(file.name);

      try {
        const content = isExcel 
          ? readExcelFile(filePath)
          : await readCsvFile(filePath);

        return {
          name: file.name,
          ...content
        };
      } catch (error) {
        console.error(`Error reading ${file.name}:`, error);
        return {
          name: file.name,
          error: `Error reading file: ${error.message}`
        };
      }
    })
  );

  // Limpiar archivos temporales
  await Promise.all(
    fileList.map(file => 
      fs.unlink(path.join(tmpDir, file.name)).catch(() => {})
    )
  );

  return { 
    type: 'zip',
    total_files: fileList.length,
    files: filesContent
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const form = formidable({});
    const [fields, files] = await form.parse(req);

    const inputFile = files.file?.[0];

    if (!inputFile) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const fileExt = path.extname(inputFile.originalFilename || '').toLowerCase();
    let preview;

    switch (fileExt) {
      case '.csv':
        preview = await readCsvFile(inputFile.filepath);
        preview.type = 'csv';
        break;
      case '.xlsx':
      case '.xls':
        preview = readExcelFile(inputFile.filepath);
        preview.type = 'excel';
        break;
      case '.zip':
        preview = await readZipFile(inputFile.filepath);
        break;
      default:
        return res.status(400).json({ error: 'Tipo de archivo no soportado' });
    }

    res.status(200).json(preview);
  } catch (error: any) {
    console.error('Error previewing file:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}
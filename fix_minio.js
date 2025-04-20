/**
 * Script para corregir las expresiones regulares en el adaptador de MinIO
 */

const fs = require('fs');
const path = require('path');

// Ruta del archivo
const minioFilePath = path.join('/home/runner/workspace/src/utils/cloud/adapters/minio.js');

// Leer el archivo
fs.readFile(minioFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error al leer el archivo:', err);
    return;
  }

  // Reemplazar las expresiones regulares
  let fixedContent = data.replace(/<n>\((.*?)\)<\/Name>/g, '<Name>$1</Name>');
  fixedContent = fixedContent.replace(/<n>\((.*?)\)<\/n>/g, '<Name>$1</Name>');
  
  // Reemplazar expresiones específicas por línea
  const lines = fixedContent.split('\n');
  
  // Línea 231
  if (lines[230].includes('/<n>(.*?)<\\/Name>/g')) {
    lines[230] = lines[230].replace('/<n>(.*?)<\\/Name>/g', '/<Name>(.*?)<\\/Name>/g');
  }
  
  // Línea 681
  for (let i = 680; i < 685; i++) {
    if (lines[i] && lines[i].includes('/<n>(.*?)<\\/n>/g')) {
      lines[i] = lines[i].replace('/<n>(.*?)<\\/n>/g', '/<Name>(.*?)<\\/Name>/g');
      break;
    }
  }
  
  // Unir el contenido de nuevo
  const updatedContent = lines.join('\n');
  
  // Escribir el archivo actualizado
  fs.writeFile(minioFilePath, updatedContent, 'utf8', (err) => {
    if (err) {
      console.error('Error al escribir el archivo:', err);
      return;
    }
    console.log('Archivo minio.js actualizado correctamente!');
  });
});

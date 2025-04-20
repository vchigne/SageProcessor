/**
 * Pequeño script para corregir las expresiones regulares en el adaptador MinIO
 */

const fs = require('fs');
const path = require('path');

// Ruta al archivo del adaptador MinIO
const filePath = path.join(__dirname, 'src', 'utils', 'cloud', 'adapters', 'minio.js');

// Leer el contenido del archivo
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error al leer el archivo:', err);
    return;
  }

  // Reemplazar todas las ocurrencias de /<n>(.*?)<\/Name>/g por /<Name>(.*?)<\/Name>/g
  let updatedContent = data.replace(/<n>\(.*?\)<\/Name>/g, '<Name>$1</Name>');
  
  // Reemplazar todas las ocurrencias de /<n>(.*?)<\/n>/g por /<Name>(.*?)<\/Name>/g
  updatedContent = updatedContent.replace(/<n>\(.*?\)<\/n>/g, '<Name>$1</Name>');

  // Guardar el archivo actualizado
  fs.writeFile(filePath, updatedContent, 'utf8', (err) => {
    if (err) {
      console.error('Error al escribir el archivo:', err);
      return;
    }
    console.log('¡Archivo actualizado correctamente!');
  });
});

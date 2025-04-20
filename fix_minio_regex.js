const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'utils', 'cloud', 'adapters', 'minio.js');
console.log(`Procesando archivo: ${filePath}`);

// Leer el archivo
let content = fs.readFileSync(filePath, 'utf8');

// Buscar y reemplazar
const oldRegex = /<n>\(.*?\)<\/Name>/g;
const newRegex = '<Name>$1</Name>';

// Definir patrones de búsqueda y reemplazo
const patterns = [
  {
    search: "Array.from(responseText.matchAll(/<n>(.*?)<\\/Name>/g))",
    replace: "Array.from(responseText.matchAll(/<Name>(.*?)<\\/Name>/g))"
  }
];

// Realizar reemplazos
let modified = false;
patterns.forEach(pattern => {
  if (content.includes(pattern.search)) {
    content = content.replace(new RegExp(pattern.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), pattern.replace);
    modified = true;
    console.log(`Reemplazado: ${pattern.search} -> ${pattern.replace}`);
  } else {
    console.log(`No se encontró el patrón: ${pattern.search}`);
  }
});

if (modified) {
  // Guardar archivo modificado
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Archivo actualizado correctamente');
} else {
  console.log('No se realizaron cambios en el archivo');
}
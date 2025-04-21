/**
 * Utilitarios para formateo de datos
 */

/**
 * Formatea un número de bytes a una representación legible
 * @param {number} bytes - El número de bytes a formatear
 * @param {number} decimals - Número de decimales a mostrar
 * @returns {string} - El tamaño formateado (e.g. "4.5 MB")
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
/**
 * Adaptador para Azure Blob Storage (OBSOLETO)
 * 
 * NOTA: Este adaptador contiene errores de sintaxis y ha sido reemplazado por azure_fixed.js
 * No usar directamente - será eliminado en el futuro.
 */

// Evitar errores: usar un adaptador mínimo y válido
export default {
  testConnection: async () => ({
    success: false,
    message: "Adaptador obsoleto. Por favor use azure_fixed.js"
  }),
  listContents: async () => ({
    error: true,
    errorMessage: "Adaptador obsoleto. Por favor use azure_fixed.js",
    files: [],
    folders: []
  }),
  listBuckets: async () => [],
  createBucket: async () => ({
    success: false,
    message: "Adaptador obsoleto. Por favor use azure_fixed.js" 
  })
};
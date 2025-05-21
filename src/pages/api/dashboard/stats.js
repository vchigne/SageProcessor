export default function handler(req, res) {
  // Datos de ejemplo para el dashboard
  const stats = {
    archivos_procesados: 1256,
    tasa_exito: 92,
    archivos_pendientes: 45,
    casillas_por_vencer: 23
  };

  res.status(200).json({ stats });
}
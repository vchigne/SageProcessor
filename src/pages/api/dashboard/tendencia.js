export default function handler(req, res) {
  // Datos de ejemplo para la tendencia de procesamiento
  const datos = [
    {
      fecha: '01/05',
      procesados: 78,
      exitosos: 72
    },
    {
      fecha: '02/05',
      procesados: 92,
      exitosos: 85
    },
    {
      fecha: '03/05',
      procesados: 63,
      exitosos: 59
    },
    {
      fecha: '04/05',
      procesados: 105,
      exitosos: 98
    },
    {
      fecha: '05/05',
      procesados: 87,
      exitosos: 80
    },
    {
      fecha: '06/05',
      procesados: 115,
      exitosos: 107
    },
    {
      fecha: '07/05',
      procesados: 94,
      exitosos: 91
    }
  ];

  res.status(200).json({ datos });
}
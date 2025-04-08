import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Redirigir a la nueva ruta (ver HTTP 308 - Permanent Redirect)
  res.setHeader('Location', '/api/casillas' + (req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''));
  res.status(308).end('Redirect to /api/casillas');
}
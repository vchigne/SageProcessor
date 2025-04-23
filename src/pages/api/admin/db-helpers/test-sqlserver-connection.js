import { testSQLServerConnection } from '@/utils/sql-test';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { server, port, user, password, database } = req.body;

    const result = await testSQLServerConnection(
      server, 
      port, 
      user, 
      password, 
      database
    );

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error testing SQL Server connection:', error);
    return res.status(500).json({
      success: false,
      message: `Error al probar la conexión: ${error.message}`,
      details: {
        code: 'SERVER_ERROR',
        sqlMessage: error.message
      }
    });
  }
}
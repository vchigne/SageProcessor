/**
 * Módulo para la conexión a la base de datos PostgreSQL
 */
import { Pool } from 'pg';

// Crear una instancia de conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Función para obtener la conexión a la base de datos
export const getDb = async () => {
  return pool;
};

// Exportar el pool para uso directo
export { pool };
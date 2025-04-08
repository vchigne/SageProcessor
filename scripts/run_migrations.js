const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configurar pool de conexión desde DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  console.log('Comenzando ejecución de migraciones...');
  
  // Crear tabla de migraciones si no existe
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  
  // Obtener migraciones ya ejecutadas
  const executedResult = await pool.query('SELECT name FROM migrations ORDER BY id');
  const executedMigrations = executedResult.rows.map(row => row.name);
  
  console.log('Migraciones ya ejecutadas:', executedMigrations);
  
  // Leer archivos de migración disponibles
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Ordenar archivos alfabéticamente
  
  console.log('Archivos de migración disponibles:', migrationFiles);
  
  // Ejecutar migraciones pendientes
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const file of migrationFiles) {
      if (!executedMigrations.includes(file)) {
        console.log(`Ejecutando migración: ${file}`);
        
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        try {
          await client.query(sql);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          console.log(`✅ Migración ${file} ejecutada correctamente`);
        } catch (err) {
          console.error(`❌ Error al ejecutar migración ${file}:`, err);
          throw err;
        }
      } else {
        console.log(`⏭️ Saltando migración ya ejecutada: ${file}`);
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ Todas las migraciones completadas correctamente');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error en migraciones, se ha revertido la transacción:', err);
    process.exit(1);
  } finally {
    client.release();
  }
  
  await pool.end();
}

runMigrations().then(() => {
  console.log('Proceso de migración finalizado');
}).catch(err => {
  console.error('Error inesperado durante las migraciones:', err);
  process.exit(1);
});
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../migrations');

export const runMigrations = async () => {
  console.log('Starting database migrations...');
  const client = await pool.connect();

  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Fetch applied migrations
    const { rows: appliedRows } = await client.query('SELECT name FROM _migrations');
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // Read migration files
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();

    const pendingFiles = sqlFiles.filter((f) => !appliedSet.has(f));

    if (pendingFiles.length === 0) {
      console.log('No pending migrations to run.');
      return;
    }

    console.log(`Found ${pendingFiles.length} pending migration(s):`, pendingFiles);

    for (const file of pendingFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');

      console.log(`Executing migration: ${file}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Successfully applied migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to apply migration ${file}:`, err);
        throw err;
      }
    }

    console.log('All migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
};

if (process.argv[1] && process.argv[1].includes('migrate')) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration runner failed:', err);
      process.exit(1);
    });
}

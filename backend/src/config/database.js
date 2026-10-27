import pg from 'pg';
import config from './index.js';

const pool = new pg.Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => {
  console.error('Unexpected database pool error', err);
});

export default pool;

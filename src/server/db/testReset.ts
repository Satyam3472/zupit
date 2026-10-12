import pg from 'pg';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const { Client } = pg;

async function resetAndSeed() {
  const testDbName = 'zupit_test';
  const baseUri = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/zupit';
  const url = new URL(baseUri);
  
  // Administrative connection to 'postgres' database
  url.pathname = '/postgres';
  const adminClient = new Client({ connectionString: url.toString() });

  console.log(`🔄 [test:reset] Connecting to postgres server to reset '${testDbName}'...`);
  await adminClient.connect();

  try {
    // Terminate existing connections to testDbName
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${testDbName}'
        AND pid <> pg_backend_pid();
    `);

    // Drop and recreate
    await adminClient.query(`DROP DATABASE IF EXISTS ${testDbName};`);
    await adminClient.query(`CREATE DATABASE ${testDbName};`);
    console.log(`✅ [test:reset] Clean database '${testDbName}' created.`);
  } finally {
    await adminClient.end();
  }

  // Target test database URL
  url.pathname = `/${testDbName}`;
  const testDbUrl = url.toString();
  process.env.DATABASE_URL = testDbUrl;

  console.log(`📦 [test:reset] Applying database migrations to '${testDbName}'...`);
  execSync(`npx drizzle-kit migrate`, {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
    cwd: path.resolve(process.cwd()),
  });

  console.log(`🌱 [test:reset] Seeding '${testDbName}'...`);
  const { seed } = await import('./seed.js');
  await seed();

  console.log(`✨ [test:reset] Successfully reset and seeded test database '${testDbName}'!`);
}

resetAndSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [test:reset] Failed:', err);
    process.exit(1);
  });

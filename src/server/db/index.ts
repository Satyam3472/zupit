import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/zupit';

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });

export * from './schema.js';

import fs from 'fs';
import path from 'path';
import logger from '../../utils/logger';
import { pool } from '../connections/database';
import { clickHouseClient } from '../connections/clickhouse';

type MigrationResult = { name: string; applied: boolean; details?: string };

function repoRoot(): string {
  // Compiled: dist/infrastructure/migrations → repo root is three levels up.
  const fromDist = path.resolve(__dirname, '../../../');
  if (fs.existsSync(path.join(fromDist, 'migrations', '001_create_events.sql'))) {
    return fromDist;
  }
  const fromCwd = path.join(process.cwd(), 'migrations', '001_create_events.sql');
  if (fs.existsSync(fromCwd)) {
    return process.cwd();
  }
  return fromDist;
}

function readSqlFile(relPathFromRoot: string): string {
  const fullPath = path.join(repoRoot(), relPathFromRoot);
  return fs.readFileSync(fullPath, 'utf8');
}

function splitSqlStatements(sql: string): string[] {
  // Simple splitter: good enough for our current migrations (no procedural blocks).
  // We strip full-line comments first so statements that *start* with comments
  // (common in .sql files) still get executed.
  const withoutLineComments = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  return withoutLineComments
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

async function ensurePostgresMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function isPostgresMigrationApplied(name: string): Promise<boolean> {
  const res = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1 LIMIT 1', [name]);
  return res.rowCount > 0;
}

async function markPostgresMigrationApplied(name: string): Promise<void> {
  await pool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
}

async function runPostgresMigration(name: string, relSqlPath: string): Promise<MigrationResult> {
  await ensurePostgresMigrationsTable();

  if (await isPostgresMigrationApplied(name)) {
    return { name: `postgres:${name}`, applied: false, details: 'already applied' };
  }

  const sql = readSqlFile(relSqlPath);
  const statements = splitSqlStatements(sql);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await markPostgresMigrationApplied(name);
  return { name: `postgres:${name}`, applied: true };
}

async function ensureClickHouseMigrationsTable(): Promise<void> {
  // Use cortex database and store migration names there.
  await clickHouseClient.executeCommand('CREATE DATABASE IF NOT EXISTS cortex');
  await clickHouseClient.executeCommand(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = MergeTree()
    ORDER BY (name)
  `);
}

async function isClickHouseMigrationApplied(name: string): Promise<boolean> {
  await ensureClickHouseMigrationsTable();
  const res = await clickHouseClient.execute(
    `SELECT count() AS c FROM schema_migrations WHERE name = {name:String}`,
    { name }
  );
  const c = res.data?.[0]?.c ?? 0;
  return Number(c) > 0;
}

async function markClickHouseMigrationApplied(name: string): Promise<void> {
  await clickHouseClient.executeCommand(
    `INSERT INTO schema_migrations (name) VALUES ('${name.replace(/'/g, "''")}')`
  );
}

async function runClickHouseMigration(name: string, relSqlPath: string): Promise<MigrationResult> {
  if (await isClickHouseMigrationApplied(name)) {
    return { name: `clickhouse:${name}`, applied: false, details: 'already applied' };
  }

  const sql = readSqlFile(relSqlPath);
  const statements = splitSqlStatements(sql)
    // ClickHouse supports USE, but we’ll avoid depending on it for correctness.
    .filter(stmt => stmt.toUpperCase() !== 'USE CORTEX');

  for (const stmt of statements) {
    await clickHouseClient.executeCommand(stmt);
  }

  await markClickHouseMigrationApplied(name);
  return { name: `clickhouse:${name}`, applied: true };
}

export async function runMigrations(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  results.push(await runPostgresMigration('001_create_events', 'migrations/001_create_events.sql'));
  results.push(await runClickHouseMigration('001_init_analytics', 'migrations/clickhouse/001_init_analytics.sql'));

  return results;
}

async function main() {
  logger.info('🗄️  Running migrations...');
  const startedAt = Date.now();

  try {
    const results = await runMigrations();
    const applied = results.filter(r => r.applied).length;
    const skipped = results.length - applied;

    logger.info(`✅ Migrations complete (applied=${applied}, skipped=${skipped}, ms=${Date.now() - startedAt})`);
    for (const r of results) {
      logger.info(`- ${r.name}: ${r.applied ? 'applied' : 'skipped'}${r.details ? ` (${r.details})` : ''}`);
    }
    process.exit(0);
  } catch (err: any) {
    logger.error(`❌ Migration failed: ${err?.message || err}`);
    process.exit(1);
  }
}

// Only run when executed directly (node dist/.../runMigrations.js)
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}


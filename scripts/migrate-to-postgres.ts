#!/usr/bin/env npx tsx
/**
 * SQLite → PostgreSQL Migration Script
 *
 * Usage:
 *   bun run db:migrate:to-postgres              # Full migration
 *   bun run db:migrate:to-postgres -- --dry-run # Show what would be migrated
 *   bun run db:migrate:to-postgres -- --validate-only # Validate existing migration
 *   bun run db:migrate:to-postgres -- --force   # Migrate even if PG is not empty
 *
 * Prerequisites:
 *   - PostgreSQL running and accessible via DATABASE_URL
 *   - .env file with DATABASE_URL set (or pass via environment)
 */

import 'dotenv/config';
import { migrateStandalone } from '../src/db/auto-migrate';

const args = process.argv.slice(2);

const options = {
  sqlitePath: undefined as string | undefined,
  pgUrl: undefined as string | undefined,
  dryRun: args.includes('--dry-run'),
  validateOnly: args.includes('--validate-only'),
  force: args.includes('--force'),
};

// Parse --sqlite-path
const sqlitePathIdx = args.indexOf('--sqlite-path');
if (sqlitePathIdx !== -1 && args[sqlitePathIdx + 1]) {
  options.sqlitePath = args[sqlitePathIdx + 1];
}

// Parse --pg-url
const pgUrlIdx = args.indexOf('--pg-url');
if (pgUrlIdx !== -1 && args[pgUrlIdx + 1]) {
  options.pgUrl = args[pgUrlIdx + 1];
  process.env.DATABASE_URL = options.pgUrl;
}

// Show help
if (args.includes('-h') || args.includes('--help')) {
  console.log(`
SQLite → PostgreSQL Migration

Usage:
  bun run db:migrate:to-postgres [options]

Options:
  --sqlite-path <path>   Path to SQLite database (default: ./database.sqlite)
  --pg-url <url>         PostgreSQL connection string (default: from DATABASE_URL env)
  --dry-run              Show what would be migrated without making changes
  --validate-only        Only validate an existing migration
  --force                Migrate even if PostgreSQL database is not empty
  -h, --help             Show this help

Examples:
  bun run db:migrate:to-postgres
  bun run db:migrate:to-postgres -- --dry-run
  bun run db:migrate:to-postgres -- --sqlite-path ./backup.sqlite
  DATABASE_URL=postgresql://user:pass@host/db bun run db:migrate:to-postgres
`);
  process.exit(0);
}

// Check DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Add it to .env or pass via environment:');
  console.error('   DATABASE_URL=postgresql://user:password@localhost:5432/teacher_assistant');
  process.exit(1);
}

migrateStandalone(options).catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});

import db from '../../db';
import { query as pgQuery, queryOne as pgQueryOne, pgTransaction } from '../lib/postgres';

/**
 * Service Layer Utilities
 * 
 * Common utilities and types used across all services.
 */

export interface ClassSummary {
  id: string;
  teacher_id: string;
  name: string;
  owner_name: string;
  role?: string;
}

/**
 * Check if using PostgreSQL database (vs SQLite)
 */
export function isPostgres(): boolean {
  return (process.env.DB_TYPE || 'sqlite') === 'postgres';
}

/**
 * Re-export database and PostgreSQL query functions for services
 */
export { db, pgQuery, pgQueryOne, pgTransaction };

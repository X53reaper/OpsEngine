#!/usr/bin/env node
// Safari Zetu Ops Engine — Migration Runner
// Reads .env, connects to PostgreSQL, runs all SQL files in database/migrations/ in order

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations')

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Cannot run migrations.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    // Test connection
    await pool.query('SELECT 1')
    console.log('Connected to PostgreSQL')

    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(20) PRIMARY KEY,
        filename TEXT NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // Get already-applied migrations
    const { rows: applied } = await pool.query('SELECT version FROM schema_migrations ORDER BY version')
    const appliedVersions = new Set(applied.map(r => r.version))

    // Read migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()

    if (files.length === 0) {
      console.log('No migration files found')
      return
    }

    let runCount = 0

    for (const file of files) {
      const version = file.split('_')[0] // e.g., "001" from "001_initial_schema.sql"

      if (appliedVersions.has(version)) {
        continue // Already applied
      }

      const filePath = path.join(MIGRATIONS_DIR, file)
      const sql = fs.readFileSync(filePath, 'utf8')

      console.log(`Running migration: ${file}`)
      await pool.query(sql)

      await pool.query(
        'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)',
        [version, file]
      )

      console.log(`  Applied: ${file}`)
      runCount++
    }

    if (runCount === 0) {
      console.log('All migrations already applied')
    } else {
      console.log(`Applied ${runCount} migration(s)`)
    }
  } catch (error) {
    console.error('Migration failed:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigrations()

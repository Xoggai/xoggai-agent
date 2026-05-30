import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from './client.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(currentDir, 'migrations', '0000_initial.sql')

try {
  const sql = await readFile(migrationPath, 'utf8')
  await pool.query(sql)
  console.log('Database migration applied')
} finally {
  await pool.end()
}

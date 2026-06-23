import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const url = new URL(databaseUrl)
if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('DATABASE_URL must be PostgreSQL')
}

const outputDir = resolve(process.env.BACKUP_OUTPUT_DIR || 'backups')
await mkdir(outputDir, { recursive: true })
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputFile = resolve(
  outputDir,
  process.env.BACKUP_FILE_NAME || `xoggai-${timestamp}.dump`,
)
const database = url.pathname.replace(/^\//, '')
if (!database) throw new Error('DATABASE_URL must include a database name')

const args = [
  '--format=custom',
  '--no-owner',
  '--no-privileges',
  '--file',
  outputFile,
  '--host',
  url.hostname,
  '--port',
  url.port || '5432',
  '--username',
  decodeURIComponent(url.username),
  database,
]

const child = spawn(process.env.PG_DUMP_BIN || 'pg_dump', args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: process.env.PGSSLMODE || 'require',
  },
  windowsHide: true,
})

const exitCode = await new Promise((resolveExit, reject) => {
  child.once('error', reject)
  child.once('exit', resolveExit)
})

if (exitCode !== 0) {
  throw new Error(`pg_dump exited with code ${exitCode}`)
}

console.log(JSON.stringify({ success: true, outputFile }, null, 2))

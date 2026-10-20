// npm run db:migrate — applies pending migrations to DATABASE_URL.
import { loadConfig } from '../config.js'
import { PostgresStore } from './postgres.js'

const config = loadConfig()
if (!config.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set; nothing to migrate (the app will use in-memory storage).',
  )
  process.exit(1)
}
const store = new PostgresStore(config.DATABASE_URL, config.DATABASE_SSL === 'true')
try {
  const applied = await store.migrate()
  console.log(
    applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.',
  )
} finally {
  await store.close()
}

// NOTE: deliberately no `server-only` import here — the seed script runs this
// module in plain Node. The `server-only` guard lives on the data access layer
// in src/data/, which is the boundary that actually must never reach a client
// bundle.
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

// Reuse the pool across hot reloads in development so `next dev` doesn't
// exhaust Postgres connections on every file change.
const globalForDb = globalThis as unknown as { pool?: Pool }

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://unified_surface:unified_surface@localhost:5432/unified_surface',
    max: 10,
  })

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })
export { schema }

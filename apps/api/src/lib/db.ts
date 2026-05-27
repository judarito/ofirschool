import { createDb } from '@ofir/db'
import type { Bindings } from '../types'

export const getDb = (env: Bindings) => createDb(env.DATABASE_URL)

import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const envUrl = new URL('../../../.env', import.meta.url)

dotenv.config({
  path: fileURLToPath(envUrl),
})

export const getEnv = (key: string) => process.env[key]

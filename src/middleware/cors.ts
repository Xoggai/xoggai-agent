import { cors } from 'hono/cors'
import { env } from '../env.js'

export const corsMiddleware = cors({
  origin: env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Payment'],
})

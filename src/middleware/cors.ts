import { cors } from 'hono/cors'
import { env } from '../env.js'

const configuredOrigins = new Set(env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()))

function resolveOrigin(origin: string) {
  if (configuredOrigins.has(origin)) return origin

  try {
    const { hostname, protocol } = new URL(origin)
    if (protocol === 'https:' && hostname.endsWith('.netlify.app')) return origin
    if (hostname === 'localhost' || hostname === '127.0.0.1') return origin
  } catch {
    return undefined
  }

  return undefined
}

export const corsMiddleware = cors({
  origin: resolveOrigin,
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Payment'],
})

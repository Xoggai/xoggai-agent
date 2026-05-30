import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { redis } from '../lib/redis.js'

export const feedRoute = new Hono().get('/', (c) => {
  return streamSSE(c, async (stream) => {
    const sub = redis.duplicate()
    await sub.subscribe('xoggai:feed')

    sub.on('message', async (_channel: string, message: string) => {
      await stream.writeSSE({ data: message })
    })

    const history = await redis.lrange('xoggai:feed:history', 0, 9)
    for (const item of history.reverse()) {
      await stream.writeSSE({ data: item })
    }

    const ping = setInterval(async () => {
      await stream.writeSSE({ data: '{"ping":true}' })
    }, 20_000)

    stream.onAbort(() => {
      clearInterval(ping)
      void sub.unsubscribe()
      sub.disconnect()
    })
  })
})

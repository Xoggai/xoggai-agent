import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env.js'

export const ANTHROPIC_ROUTER_MODEL = 'claude-sonnet-4-5'
export const ANTHROPIC_RATING_MODEL = 'claude-haiku-4-5-20251001'

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
})

export function extractAnthropicText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text: unknown }).text)
      }
      return ''
    })
    .join('')
    .trim()
}

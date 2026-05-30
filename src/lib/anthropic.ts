import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env.js'

export const ANTHROPIC_ROUTER_MODEL = env.ANTHROPIC_ROUTER_MODEL
export const ANTHROPIC_RATING_MODEL = env.ANTHROPIC_RATING_MODEL

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  baseURL: env.ANTHROPIC_BASE_URL,
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

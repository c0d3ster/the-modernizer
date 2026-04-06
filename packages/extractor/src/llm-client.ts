import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-20250514'

let client: Anthropic | null = null

const getClient = (): Anthropic => {
  if (!client) client = new Anthropic()
  return client
}

export const callLlm = async (prompt: string): Promise<string> => {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('LLM returned no text content')
  }

  return block.text
}

export const parseJsonResponse = <T>(raw: string): T => {
  // strip markdown fences if the model added them despite instructions
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  return JSON.parse(cleaned) as T
}

import { request } from 'undici'

export const fetchDisallowedPaths = async (rootUrl: string): Promise<string[]> => {
  try {
    const robotsUrl = new URL('/robots.txt', rootUrl).toString()
    const { statusCode, body } = await request(robotsUrl)
    if (statusCode !== 200) return []

    const text = await body.text()
    const disallowed: string[] = []
    let inRelevantBlock = false

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim()
      if (line.startsWith('User-agent:')) {
        const agent = line.slice('User-agent:'.length).trim()
        inRelevantBlock = agent === '*' || agent.toLowerCase().includes('modernizer')
      } else if (inRelevantBlock && line.startsWith('Disallow:')) {
        const path = line.slice('Disallow:'.length).trim()
        if (path) disallowed.push(path)
      }
    }

    return disallowed
  } catch {
    return []
  }
}

export const isAllowed = (url: string, disallowedPaths: string[]): boolean => {
  try {
    const pathname = new URL(url).pathname
    return !disallowedPaths.some((path) => pathname.startsWith(path))
  } catch {
    return true
  }
}

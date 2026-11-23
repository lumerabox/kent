import type { AiDocRef } from './events'
import type { AiTool } from './client'
import type { AiMode } from './modes'
import { readWebPage } from './read-url'
import { searchKey, webSearch } from './web-search'

// Tools Kent can call. Each returns a JSON string for the model and optional cards for the UI.

export type ToolCtx = { signal?: AbortSignal; mode: AiMode; searches?: number }
export type ToolResult = { result: string; docs?: AiDocRef[] }

const WEB_SEARCH: AiTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for recent or specific information. Use 1–3 precise queries. Cite sources as Markdown links.',
    parameters: {
      type: 'object',
      properties: {
        queries: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3, description: 'Search queries' },
        topic: { type: 'string', enum: ['general', 'news', 'finance'] },
        time_range: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
        domains: { type: 'array', items: { type: 'string' }, description: 'Optional domains to search only' },
      },
      required: ['queries'],
    },
  },
}

const READ_WEB_PAGE: AiTool = {
  type: 'function',
  function: {
    name: 'read_web_page',
    description: 'Open a web page link and read its text and tables (tables come back as Markdown, row by row).',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'http(s) URL' } }, required: ['url'] },
  },
}

export function availableTools(): AiTool[] {
  return searchKey() ? [WEB_SEARCH, READ_WEB_PAGE] : [READ_WEB_PAGE]
}

const domainOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function sourcesOf(result: string): AiDocRef[] {
  try {
    const j = JSON.parse(result) as { searches?: { results?: { title: string; url: string; published?: string }[] }[] }
    const out: AiDocRef[] = []
    for (const s of j.searches ?? [])
      for (const r of s.results ?? []) {
        const domain = domainOf(r.url)
        if (!domain) continue
        const date = r.published && !Number.isNaN(Date.parse(r.published)) ? new Date(r.published).toISOString().slice(0, 10) : undefined
        out.push({ kind: 'Source', title: r.title || domain, href: r.url, source: { domain, ...(date ? { date } : {}) } })
      }
    return out.slice(0, 6)
  } catch {
    return []
  }
}

export async function runTool(name: string, rawArgs: string, ctx: ToolCtx): Promise<ToolResult> {
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(rawArgs || '{}') as Record<string, unknown>
  } catch {
    return { result: JSON.stringify({ error: 'Arguments are not valid JSON.' }) }
  }
  try {
    if (name === 'web_search') {
      const result = await webSearch(args, ctx)
      return { result, docs: sourcesOf(result) }
    }
    if (name === 'read_web_page') return { result: await readWebPage(args, ctx) }
  } catch (e) {
    if (ctx.signal?.aborted) throw e
    return { result: JSON.stringify({ error: 'The tool failed. Answer with what you have.' }) }
  }
  return { result: JSON.stringify({ error: `Unknown tool ${name}.` }) }
}

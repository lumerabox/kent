import { cell, htmlTables } from './html-table'
import { searchKey } from './web-search'
import { safeGet, safeUrl } from './safe-fetch'

export { privateIp } from './safe-fetch'

// Tool read_web_page: open a link, return tables (Markdown, row by row) and short text.
// Pages built with JavaScript fall back to Tavily Extract when TAVILY_API_KEY is set.
// Safe (safe-fetch.ts): http(s) on default ports only, private IPs refused (also after redirects).

const MAX_BYTES = 3_000_000

const pageText = (html: string) =>
  cell(html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ').replace(/<table[\s\S]*?<\/table>/gi, ' ')).slice(0, 3000)

async function fetchHtml(start: URL, signal?: AbortSignal): Promise<{ html: string; url: string } | string> {
  let url: URL | string = start
  for (let hop = 0; hop < 4; hop++) {
    const res = await safeGet(url, {
      maxBytes: MAX_BYTES,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; KentBot/1.0)', accept: 'text/html,application/xhtml+xml' },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
      readBody: (status, h) => status >= 200 && status < 300 && /html|xml|text\/plain/i.test(h.get('content-type') ?? ''),
    }).catch(() => null)
    if (!res) return 'The page did not respond.'
    if (res.status >= 300 && res.status < 400 && res.location) {
      url = await safeUrl(new URL(res.location, url).toString())
      if (typeof url === 'string') return url
      continue
    }
    if (res.status < 200 || res.status >= 300) return `The page answered ${res.status}.`
    if (res.tooLarge) return 'The page is too large.'
    if (!res.body) return 'This link is not a web page.'
    return { html: new TextDecoder().decode(res.body), url: url.toString() }
  }
  return 'Too many redirects.'
}

async function tavilyExtract(key: string, url: string, signal?: AbortSignal) {
  const res = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ urls: [url], extract_depth: 'advanced', format: 'markdown' }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(40_000)]) : AbortSignal.timeout(40_000),
  })
  if (!res.ok) throw new Error(`Tavily extract ${res.status}`)
  const j = (await res.json()) as { results?: { raw_content?: string }[] }
  return (j.results?.[0]?.raw_content ?? '').slice(0, 10_000)
}

export async function readWebPage(a: Record<string, unknown>, ctx: { signal?: AbortSignal }) {
  const u = await safeUrl(typeof a.url === 'string' ? a.url.trim() : '')
  if (typeof u === 'string') return JSON.stringify({ error: u })
  const got = await fetchHtml(u, ctx.signal)
  if (typeof got !== 'string') {
    const tables = htmlTables(got.html)
    const title = cell(got.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 160)
    if (tables.length)
      return JSON.stringify({
        url: got.url,
        title,
        tables: tables.map((t) => t.md),
        text: pageText(got.html).slice(0, 1500),
        note: 'Tables are copied row by row, column by column.',
      })
  }
  // Tanpa tabel di HTML (halaman JavaScript) atau diblok: Tavily Extract, 1 kuota
  const key = searchKey()
  if (!key) return JSON.stringify({ error: typeof got === 'string' ? got : 'No table found on this page, and web search is not set up.' })
  try {
    const md = await tavilyExtract(key, u.toString(), ctx.signal)
    if (!md) return JSON.stringify({ error: 'The page could not be read.' })
    return JSON.stringify({
      url: u.toString(),
      content: md,
      note: 'Read through an extractor because the page is built with JavaScript; it can be an older snapshot.',
    })
  } catch {
    return JSON.stringify({ error: typeof got === 'string' ? got : 'The page could not be read.' })
  }
}

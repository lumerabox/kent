import type { AiMode } from './modes'

// Web search via Tavily (TAVILY_API_KEY). Optional: without a key Kent answers from what it knows.
// Same query is reused from an in-memory cache for 2 hours.

const ENDPOINT = 'https://api.tavily.com/search'
const CACHE_TTL = 2 * 3600_000
const MAX_QUERIES = 3

export const searchKey = (env: Record<string, string | undefined> = process.env) => env.TAVILY_API_KEY?.trim() || ''

/** Batas pencarian per jawaban sesuai mode reasoning */
export const SEARCHES_PER_TURN: Record<AiMode, number> = { low: 1, medium: 2, high: 3, extra: 4, max: 5, ultra: 8 }

export const normQuery = (q: string) => q.replace(/\s+/g, ' ').trim().toLowerCase()

/** Ambil 1–3 query unik dari argumen tool ({ queries } atau { query }). Murni, dites. */
export function queriesOf(a: Record<string, unknown>): string[] {
  const raw = Array.isArray(a.queries) ? a.queries : [a.query]
  const out: string[] = []
  const seen = new Set<string>()
  for (const q of raw) {
    if (typeof q !== 'string') continue
    const text = q.replace(/\s+/g, ' ').trim().slice(0, 300)
    if (text.length < 3 || seen.has(normQuery(text))) continue
    seen.add(normQuery(text))
    out.push(text)
  }
  return out.slice(0, MAX_QUERIES)
}

type Hit = { title: string; url: string; published?: string; content: string }
type Found = { query: string; answer?: string; results: Hit[] }
const cache = new Map<string, { at: number; v: Found }>()

async function tavily(key: string, query: string, opts: { topic: string; timeRange?: string; domains?: string[] }, signal?: AbortSignal) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      topic: opts.topic,
      search_depth: 'basic',
      max_results: 5,
      include_answer: 'basic',
      include_raw_content: false,
      ...(opts.timeRange ? { time_range: opts.timeRange } : {}),
      ...(opts.domains?.length ? { include_domains: opts.domains } : {}),
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Tavily ${res.status}`)
  const j = (await res.json()) as {
    answer?: string | null
    results?: { title?: string; url?: string; content?: string; published_date?: string }[]
  }
  return {
    query,
    ...(j.answer ? { answer: j.answer.slice(0, 800) } : {}),
    results: (j.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        title: (r.title ?? '').slice(0, 160),
        url: r.url!,
        ...(r.published_date ? { published: r.published_date } : {}),
        content: (r.content ?? '').replace(/\s+/g, ' ').slice(0, 600),
      })),
  } satisfies Found
}

const TOPICS = new Set(['general', 'news', 'finance'])
const RANGES = new Set(['day', 'week', 'month', 'year'])

/** Konteks giliran yang dipakai tool ini */
type Ctx = { signal?: AbortSignal; mode: AiMode; searches?: number }

/** Tool web_search: 1–3 query sekaligus, hemat kuota (cache, batas per jawaban dan per bulan) */
export async function webSearch(a: Record<string, unknown>, ctx: Ctx): Promise<string> {
  const key = searchKey()
  if (!key) return JSON.stringify({ error: 'Web search is not set up (TAVILY_API_KEY). Answer from what you know and say the info may be outdated.' })
  const queries = queriesOf(a)
  if (!queries.length) return JSON.stringify({ error: 'Give 1–3 specific queries.' })
  const topic = typeof a.topic === 'string' && TOPICS.has(a.topic) ? a.topic : 'general'
  const timeRange = typeof a.time_range === 'string' && RANGES.has(a.time_range) ? a.time_range : undefined
  const domains = Array.isArray(a.domains)
    ? a.domains.filter((d): d is string => typeof d === 'string' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)).slice(0, 5)
    : undefined
  const opts = { topic, timeRange, domains }
  const ck = (q: string) => JSON.stringify([normQuery(q), opts])
  const fresh = (q: string) => {
    const hit = cache.get(ck(q))
    return hit && Date.now() - hit.at < CACHE_TTL ? hit.v : null
  }
  const paid = queries.filter((q) => !fresh(q))

  const perTurn = SEARCHES_PER_TURN[ctx.mode]
  const done = ctx.searches ?? 0
  if (done + paid.length > perTurn)
    return JSON.stringify({
      error: `Search limit for this answer reached (${perTurn} in this mode, ${done} used). Answer with the results you already have.`,
    })
  ctx.searches = done + paid.length

  const out = await Promise.all(
    queries.map(async (q) => {
      const c = fresh(q)
      if (c) return { ...c, cached: true }
      try {
        const v = await tavily(key, q, opts, ctx.signal)
        cache.set(ck(q), { at: Date.now(), v })
        if (cache.size > 300) cache.delete(cache.keys().next().value!)
        return v
      } catch {
        return { query: q, error: 'Search failed.' }
      }
    }),
  )
  return JSON.stringify({ searches: out, note: 'Cite sources as Markdown links. Only use facts found here.' })
}


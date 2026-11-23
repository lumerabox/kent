// Stream protocol of /api/chat: NDJSON, one event per line (client safe).

/** Short trace of one tool call so the next turn still knows what was fetched */
export type AiTrace = { name: string; args: string; result: string }
/** Card shown under an answer (web sources) */
export type AiDocRef = {
  kind: string
  title: string
  href: string
  /** Cited web source: domain and date */
  source?: { domain: string; date?: string }
}

export type AiStreamEvent =
  | { t: 'text'; v: string }
  /** 'thinking' or the name of the tool that is running */
  | { t: 'status'; v: string }
  | { t: 'doc'; v: AiDocRef }
  | { t: 'trace'; v: AiTrace }
  | { t: 'ping' }
  | { t: 'error'; v: string }

export const encodeEvent = (e: AiStreamEvent) => `${JSON.stringify(e)}\n`

/** Split a buffer into whole events; the unfinished line is returned as rest */
export function decodeEvents(buf: string): { events: AiStreamEvent[]; rest: string } {
  const lines = buf.split('\n')
  const rest = lines.pop() ?? ''
  const events: AiStreamEvent[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line) as AiStreamEvent
      if (e && typeof e === 'object' && typeof e.t === 'string') events.push(e)
    } catch {}
  }
  return { events, rest }
}

export const STATUS_LABELS: Record<string, string> = {
  thinking: 'Thinking',
  reviewing: 'Reading the results',
  working: 'Working',
  web_search: 'Searching the web',
  read_web_page: 'Reading the page',
}

const COMPOSE_STEPS: Record<string, string[]> = {
  web_search: ['Planning the search', 'Choosing search terms'],
  read_web_page: ['Opening the link'],
}

export const statusLabel = (v: string) =>
  STATUS_LABELS[v] ?? (v.startsWith('compose:') ? (COMPOSE_STEPS[v.slice(8)]?.[0] ?? 'Preparing the next step') : 'Working')

/** Progress lines per status: main label first, then the next steps rotate every few seconds */
export const STATUS_STEPS: Record<string, string[]> = {
  thinking: ['Thinking', 'Reading your message', 'Connecting the dots', 'Weighing the angles', 'Shaping the answer', 'Almost there'],
  web_search: ['Searching the web', 'Reading the results', 'Checking dates and sources'],
  read_web_page: ['Reading the page', 'Copying tables row by row', 'Checking the columns'],
  reviewing: ['Reading the results', 'Deciding the next step', 'Putting it together'],
  working: ['Working', 'Still on it', 'Taking a bit longer'],
}

/** Short phase label before the status line: Thinking, Research, Writing, Checking, Working */
export function statusPhase(v: string): string {
  if (v === 'thinking') return 'Thinking'
  if (v.startsWith('compose:')) return 'Writing'
  if (v === 'web_search' || v === 'read_web_page') return 'Research'
  if (v === 'reviewing') return 'Checking'
  return 'Working'
}
export const statusSteps = (v: string) =>
  STATUS_STEPS[v] ?? (v.startsWith('compose:') ? (COMPOSE_STEPS[v.slice(8)] ?? [statusLabel(v)]) : [statusLabel(v)])

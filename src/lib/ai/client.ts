// OpenAI-compatible client without an SDK: POST {AI_BASE_URL}/chat/completions with SSE streaming.
// 400/408/429/5xx/timeouts are retried before any output (a router/fallback can move the retry to another model).


export type AiRole = 'system' | 'user' | 'assistant' | 'tool'
export type AiToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
export type AiPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
export type AiMessage = { role: AiRole; content: string | AiPart[]; tool_calls?: AiToolCall[]; tool_call_id?: string }
export type AiTool = {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}
export type AiEvent =
  | { type: 'text'; text: string }
  | { type: 'thinking' }
  /** Model mulai menyusun argumen tool (nama sudah diketahui); bisa lama untuk naskah panjang */
  | { type: 'tool'; name: string }
  | { type: 'tools'; calls: AiToolCall[] }

/** Opsi satu panggilan model (mode reasoning, model per mode, batas waktu) */
export type AiCallOptions = {
  /** reasoning_effort OpenAI; a router may translate it per model */
  effort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  model?: string
  /** 'none' = model wajib menjawab teks (putaran terakhir agent) */
  toolChoice?: 'auto' | 'none'
  /** Batas diam tanpa potongan baru (bawaan cfg.timeoutMs) */
  idleMs?: number
  /** Batas total satu panggilan */
  totalMs?: number
}

type Env = Record<string, string | undefined>

export type AiConfig = {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
  retries: number
}

const num = (v: string | undefined, def: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) && v?.trim() ? Math.min(max, Math.max(min, Math.round(n))) : def
}

export function aiConfig(env: Env = process.env): AiConfig | null {
  const apiKey = env.AI_API_KEY?.trim() ?? ''
  if (!apiKey) return null
  return {
    baseUrl: (env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    apiKey,
    model: env.AI_MODEL?.trim() || 'gpt-4o-mini',
    timeoutMs: num(env.AI_TIMEOUT_MS, 90_000, 5_000, 300_000),
    retries: num(env.AI_RETRIES, 3, 0, 5),
  }
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

const RETRY_STATUS = new Set([400, 408, 409, 429, 500, 502, 503, 504])

type ToolDelta = { index: number; id?: string; name?: string; args?: string }
type Delta = { text?: string; think?: boolean; tools?: ToolDelta[] }

/** Teks + potongan tool call dari satu baris SSE; null = kosong, 'done' = akhir stream */
export function parseSseDelta(line: string): Delta | null | 'done' {
  const t = line.trim()
  if (!t.startsWith('data:')) return null
  const data = t.slice(5).trim()
  if (data === '[DONE]') return 'done'
  try {
    const j = JSON.parse(data) as {
      choices?: {
        delta?: {
          content?: unknown
          reasoning_content?: unknown
          reasoning?: unknown
          tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[]
        }
      }[]
    }
    const d = j.choices?.[0]?.delta
    const out: Delta = {}
    if (typeof d?.content === 'string' && d.content) out.text = d.content
    const r = d?.reasoning_content ?? d?.reasoning
    if (typeof r === 'string' && r) out.think = true
    if (Array.isArray(d?.tool_calls) && d.tool_calls.length)
      out.tools = d.tool_calls.map((c, i) => ({
        index: typeof c.index === 'number' ? c.index : i,
        id: c.id || undefined,
        name: c.function?.name || undefined,
        args: typeof c.function?.arguments === 'string' ? c.function.arguments : undefined,
      }))
    return out.text || out.tools || out.think ? out : null
  } catch {
    return null
  }
}

/** Ambil potongan teks dari satu baris SSE; null = bukan data, 'done' = akhir stream */
export function parseSseLine(line: string): string | null | 'done' {
  const t = line.trim()
  if (!t.startsWith('data:')) return null
  const data = t.slice(5).trim()
  if (data === '[DONE]') return 'done'
  try {
    const j = JSON.parse(data) as { choices?: { delta?: { content?: unknown } }[] }
    const c = j.choices?.[0]?.delta?.content
    return typeof c === 'string' && c ? c : null
  } catch {
    return null
  }
}

/** Batas waktu: diam terlalu lama (tanpa potongan) atau total terlalu lama. Model berpikir lama, jadi bukan batas tetap. */
function watchdog(idleMs: number, totalMs: number, signal?: AbortSignal) {
  const ctrl = new AbortController()
  let timedOut = false
  const fire = () => {
    timedOut = true
    ctrl.abort()
  }
  const total = setTimeout(fire, totalMs)
  let idle = setTimeout(fire, idleMs)
  return {
    signal: signal ? AbortSignal.any([signal, ctrl.signal]) : ctrl.signal,
    kick() {
      clearTimeout(idle)
      idle = setTimeout(fire, idleMs)
    },
    done() {
      clearTimeout(idle)
      clearTimeout(total)
    },
    timedOut: () => timedOut,
  }
}

async function open(
  cfg: AiConfig,
  messages: AiMessage[],
  signal: AbortSignal,
  tools?: AiTool[],
  opts: AiCallOptions = {},
) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: opts.model || cfg.model,
      messages,
      stream: true,
      ...(tools?.length ? { tools, ...(opts.toolChoice ? { tool_choice: opts.toolChoice } : {}) } : {}),
      ...(opts.effort ? { reasoning_effort: opts.effort } : {}),
    }),
    signal,
  })
  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => {})
    throw new AiError(`AI error ${res.status}`, res.status, RETRY_STATUS.has(res.status))
  }
  return res.body
}

/**
 * Satu putaran model: stream teks, lalu tool call (bila ada) di akhir.
 * Percobaan ulang hanya sebelum ada keluaran, supaya pengguna tidak menerima dua jawaban yang tersambung.
 */
export async function* chatEvents(
  cfg: AiConfig,
  messages: AiMessage[],
  signal?: AbortSignal,
  tools?: AiTool[],
  opts: AiCallOptions = {},
): AsyncGenerator<AiEvent> {
  let lastErr: AiError | null = null
  const idleMs = opts.idleMs ?? cfg.timeoutMs
  const totalMs = opts.totalMs ?? Math.max(300_000, idleMs)
  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    let started = false
    const calls = new Map<number, { id: string; name: string; args: string }>()
    const dog = watchdog(idleMs, totalMs, signal)
    try {
      const body = await open(cfg, messages, dog.signal, tools, opts)
      const reader = body.pipeThrough(new TextDecoderStream()).getReader()
      // Batas waktu/batal juga memutus pembacaan (tidak semua fetch menutup body saat dibatalkan)
      dog.signal.addEventListener('abort', () => void reader.cancel().catch(() => {}), { once: true })
      let buf = ''
      let ended = false
      let thought = false
      while (!ended) {
        const { value, done } = await reader.read()
        dog.kick()
        if (done) {
          buf += '\n'
          ended = true
        } else buf += value
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const d = parseSseDelta(line)
          if (d === 'done') {
            ended = true
            await reader.cancel().catch(() => {})
            break
          }
          if (!d) continue
          for (const t of d.tools ?? []) {
            const c = calls.get(t.index) ?? { id: '', name: '', args: '' }
            if (t.id) c.id = t.id
            if (t.name && !c.name) {
              c.name = t.name
              yield { type: 'tool', name: t.name }
            } else if (t.name) c.name = t.name
            if (t.args) c.args += t.args
            calls.set(t.index, c)
          }
          // Cukup sekali per panggilan: tanda "sedang berpikir" untuk UI
          // Berpikir lagi setelah menulis teks (mis. sebelum tool) juga ditandai, sekali per jeda
          if (d.think && !thought) {
            thought = true
            yield { type: 'thinking' }
          }
          if (d.text) {
            started = true
            thought = false
            yield { type: 'text', text: d.text }
          }
        }
      }
      dog.done()
      if (dog.signal.aborted) throw new AiError(dog.timedOut() ? 'AI timed out' : 'Cancelled', dog.timedOut() ? 504 : 499, dog.timedOut())
      const list = [...calls.values()].filter((c) => c.name)
      if (list.length) {
        yield {
          type: 'tools',
          calls: list.map((c, i) => ({
            id: c.id || `call_${i}`,
            type: 'function',
            function: { name: c.name, arguments: c.args || '{}' },
          })),
        }
        return
      }
      if (started) return
      lastErr = new AiError('AI returned an empty answer', 502, true)
    } catch (err) {
      dog.done()
      if (signal?.aborted) throw new AiError('Cancelled', 499, false)
      const timeout = dog.timedOut()
      const e =
        err instanceof AiError
          ? err
          : new AiError(timeout ? 'AI timed out' : started ? 'AI stream failed' : 'AI unreachable', timeout ? 504 : 502, true)
      if (started) throw e
      lastErr = e
      if (!lastErr.retryable) throw lastErr
    }
  }
  throw lastErr ?? new AiError('AI failed', 502, false)
}

/** Stream teks jawaban (tanpa tool) */
export async function* chatStream(
  cfg: AiConfig,
  messages: AiMessage[],
  signal?: AbortSignal,
  opts?: AiCallOptions,
): AsyncGenerator<string> {
  for await (const e of chatEvents(cfg, messages, signal, undefined, opts)) if (e.type === 'text') yield e.text
}

/** Jawaban utuh (untuk tugas pendek di server) */
export async function chatText(cfg: AiConfig, messages: AiMessage[], signal?: AbortSignal, opts?: AiCallOptions) {
  let out = ''
  for await (const piece of chatStream(cfg, messages, signal, opts)) out += piece
  return out
}

import { aiConfig, AiError, chatEvents, type AiMessage, type AiPart, type AiToolCall } from '@/lib/ai/client'
import { encodeEvent, type AiStreamEvent, type AiTrace } from '@/lib/ai/events'
import { isAiMode, MODE_CONFIG, type AiMode } from '@/lib/ai/modes'
import { systemPrompt } from '@/lib/ai/prompt'
import { slashSystem } from '@/lib/ai/slash'
import { availableTools, runTool } from '@/lib/ai/tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_MESSAGES = 60
const MAX_CHARS = 60_000
const MAX_IMAGE_CHARS = 4_000_000
const TRACE_MAX = 1_500
/** Older turns are kept short so long chats stay within the context window */
const HISTORY_BUDGET = 120_000

type InMsg = { role?: unknown; content?: unknown; tools?: unknown }

const IMG_RE = /\n*\[\[gambar:(\d+)\|([^|\]\n]*)\|?([^\]\n]*)\]\]\n([\s\S]*?)\n\[\[\/gambar\]\]/g

/** Image markers → model image parts (latest message) or a short note (older messages) */
function toContent(text: string, withImages: boolean): string | AiPart[] {
  const images: string[] = []
  const plain = text.replace(IMG_RE, (_m, _n: string, name: string, url: string) => {
    if (withImages && /^data:image\/(jpeg|png|webp|gif);base64,/.test(url)) images.push(url)
    return `\n(image: ${name})`
  })
  if (!images.length) return plain
  return [{ type: 'text', text: plain }, ...images.slice(0, 6).map((url) => ({ type: 'image_url' as const, image_url: { url } }))]
}

const traceNote = (tools: unknown) => {
  if (!Array.isArray(tools)) return ''
  const list = tools
    .filter((t): t is AiTrace => !!t && typeof t === 'object' && typeof (t as AiTrace).name === 'string')
    .slice(-6)
    .map((t) => `- ${t.name}(${String(t.args).slice(0, 200)}) → ${String(t.result).slice(0, TRACE_MAX)}`)
  return list.length ? `\n\n[Tool results used for this answer]\n${list.join('\n')}` : ''
}

function buildHistory(raw: InMsg[]): AiMessage[] | string {
  const msgs = raw.slice(-MAX_MESSAGES)
  const out: AiMessage[] = []
  let budget = HISTORY_BUDGET
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return 'Invalid message.'
    const latest = i === msgs.length - 1
    const limit = latest ? MAX_CHARS + MAX_IMAGE_CHARS : MAX_CHARS
    if (m.content.length > limit) return 'Message is too long.'
    let text = m.role === 'assistant' ? m.content + traceNote(m.tools) : m.content
    if (!latest) {
      text = text.replace(IMG_RE, (_m, _n: string, name: string) => `\n(image: ${name})`)
      if (text.length > budget) text = `${text.slice(0, Math.max(0, budget))}\n(trimmed)`
      budget -= text.length
      if (budget <= 0 && out.length >= 2) break
    }
    out.unshift({ role: m.role, content: m.role === 'user' ? toContent(text, latest) : text })
  }
  if (out.at(-1)?.role !== 'user') return 'The last message must be from the user.'
  return out
}

export async function POST(req: Request) {
  const cfg = aiConfig()
  if (!cfg) return Response.json({ error: 'Kent is not set up (AI_API_KEY).' }, { status: 503 })
  const body = (await req.json().catch(() => null)) as { messages?: unknown; mode?: unknown } | null
  if (!body || !Array.isArray(body.messages) || !body.messages.length) return Response.json({ error: 'No messages.' }, { status: 400 })
  const history = buildHistory(body.messages as InMsg[])
  if (typeof history === 'string') return Response.json({ error: history }, { status: 400 })
  const mode: AiMode = isAiMode(body.mode) ? body.mode : 'medium'
  const conf = MODE_CONFIG[mode]
  const tools = availableTools()
  const lastText = (body.messages as InMsg[]).at(-1)?.content as string
  const messages: AiMessage[] = [
    { role: 'system', content: systemPrompt({ tools: tools.map((t) => t.function.name), extra: slashSystem(lastText) }) },
    ...history,
  ]
  const model = process.env[`AI_MODEL_${mode.toUpperCase()}`]?.trim() || undefined

  const enc = new TextEncoder()
  const ctrl = new AbortController()
  req.signal.addEventListener('abort', () => ctrl.abort(), { once: true })

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const send = (e: AiStreamEvent) => {
        if (closed) return
        try {
          controller.enqueue(enc.encode(encodeEvent(e)))
        } catch {
          closed = true
        }
      }
      const ping = setInterval(() => send({ t: 'ping' }), 15_000)
      const ctx = { signal: ctrl.signal, mode, searches: 0 }
      try {
        send({ t: 'status', v: 'thinking' })
        for (let round = 0; round <= conf.rounds; round++) {
          const last = round === conf.rounds
          let calls: AiToolCall[] = []
          let text = ''
          for await (const ev of chatEvents(cfg, messages, ctrl.signal, tools, {
            effort: conf.effort,
            model,
            toolChoice: last ? 'none' : 'auto',
          })) {
            if (ev.type === 'text') {
              text += ev.text
              send({ t: 'text', v: ev.text })
            } else if (ev.type === 'thinking') send({ t: 'status', v: 'thinking' })
            else if (ev.type === 'tool') send({ t: 'status', v: `compose:${ev.name}` })
            else if (ev.type === 'tools') calls = ev.calls
          }
          if (!calls.length) break
          messages.push({ role: 'assistant', content: text, tool_calls: calls })
          for (const c of calls) {
            send({ t: 'status', v: c.function.name })
            const r = await runTool(c.function.name, c.function.arguments, ctx)
            for (const d of r.docs ?? []) send({ t: 'doc', v: d })
            send({ t: 'trace', v: { name: c.function.name, args: c.function.arguments.slice(0, 400), result: r.result.slice(0, TRACE_MAX) } })
            messages.push({ role: 'tool', tool_call_id: c.id, content: r.result })
          }
          send({ t: 'status', v: 'reviewing' })
        }
      } catch (e) {
        if (!ctrl.signal.aborted) send({ t: 'error', v: e instanceof AiError && e.status === 504 ? 'AI timed out. Try again.' : 'AI is busy. Try again in a moment.' })
      } finally {
        clearInterval(ping)
        if (!closed) controller.close()
      }
    },
    cancel() {
      ctrl.abort()
    },
  })

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  })
}

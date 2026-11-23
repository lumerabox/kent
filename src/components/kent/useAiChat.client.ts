'use client'

import { useState, useSyncExternalStore } from 'react'

import { decodeEvents, type AiDocRef, type AiTrace } from '@/lib/ai/events'
import type { ChatMessage } from '@/lib/ai/history'
import { DEFAULT_AI_MODE, readAiMode, type AiMode } from '@/lib/ai/modes'

import { chats } from './chats'

export type SendOptions = { mode?: AiMode }

/** status = 'thinking' or the running tool (only while streaming) */
export type Turn = ChatMessage & { status?: string | null }
type Status = 'idle' | 'streaming' | 'busy' | 'error'

export type StreamState = { text: string; status: string | null; docs: AiDocRef[]; traces: AiTrace[] }
type StreamResult =
  | { ok: true; text: string; docs: AiDocRef[]; traces: AiTrace[]; error?: string }
  | { ok: false; status: number; error: string }

const BUSY = 'AI is busy. Try again in a moment.'

/** POST /api/chat and read the NDJSON stream */
export async function streamChat(body: Record<string, unknown>, signal?: AbortSignal, onState?: (s: StreamState) => void): Promise<StreamResult> {
  let res: Response
  try {
    res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  } catch {
    return { ok: false, status: 0, error: 'Connection lost.' }
  }
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null
    return { ok: false, status: res.status, error: j?.error ?? BUSY }
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  const st: StreamState = { text: '', status: null, docs: [], traces: [] }
  let buf = ''
  let error = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const { events, rest } = decodeEvents(buf)
      buf = rest
      let changed = false
      for (const e of events) {
        if (e.t === 'text') {
          st.text += e.v
          st.status = null
        } else if (e.t === 'status') st.status = e.v
        else if (e.t === 'doc') st.docs.push(e.v)
        else if (e.t === 'trace') st.traces.push(e.v)
        else if (e.t === 'error') error = e.v
        else continue
        changed = true
      }
      if (changed) onState?.({ ...st, docs: [...st.docs], traces: [...st.traces] })
    }
  } catch {
    if (signal?.aborted) return { ok: true, text: st.text, docs: st.docs, traces: st.traces }
    if (!st.text) return { ok: false, status: 502, error: BUSY }
    error = 'The answer was cut off. Try again.'
  }
  if (!st.text && !st.docs.length) return { ok: false, status: 502, error: error || BUSY }
  return { ok: true, text: st.text, docs: st.docs, traces: st.traces, ...(error ? { error } : {}) }
}

type Queued = { text: string; opts: SendOptions }

export type ChatState = {
  turns: Turn[]
  status: Status
  error: string
  chatId: string | null
  title: string
  /** Messages sent while Kent is working: sent in order after the current answer */
  queued: Queued[]
}

type Store = {
  get: () => ChatState
  set: (p: Partial<ChatState>) => void
  subscribe: (l: () => void) => () => void
  r: { abort: AbortController | null; last: { history: Turn[]; opts: SendOptions } | null; busy: boolean; edit: boolean; gen: number }
}

const EMPTY: ChatState = { turns: [], status: 'idle', error: '', chatId: null, title: '', queued: [] }

function createStore(): Store {
  let state = EMPTY
  const ls = new Set<() => void>()
  return {
    get: () => state,
    set: (p) => {
      state = { ...state, ...p }
      ls.forEach((l) => l())
    },
    subscribe: (l) => {
      ls.add(l)
      return () => {
        ls.delete(l)
      }
    },
    r: { abort: null, last: null, busy: false, edit: false, gen: 0 },
  }
}

const strip = (turns: Turn[]): ChatMessage[] => turns.map(({ status: _s, ...m }) => m)

function chatActions(store: Store) {
  const { get, set, r } = store

  const pendingTurn = (s: Partial<StreamState>, mode: AiMode): Turn => ({
    role: 'assistant',
    content: s.text ?? '',
    status: s.status ?? null,
    docs: s.docs?.length ? s.docs : undefined,
    mode,
  })

  const runOnce = async (history: Turn[], opts: SendOptions): Promise<Turn[] | null> => {
    const gen = r.gen
    const mode = opts.mode ?? DEFAULT_AI_MODE
    r.last = { history, opts }
    set({ status: 'streaming', error: '', turns: [...history, pendingTurn({ status: 'thinking' }, mode)] })
    const ctrl = new AbortController()
    r.abort = ctrl
    let frame = 0
    let latest: StreamState | null = null
    const flush = () => {
      frame = 0
      if (latest && gen === r.gen) set({ turns: [...history, pendingTurn(latest, mode)] })
    }
    const res = await streamChat(
      {
        messages: history.map((t) =>
          t.role === 'assistant' ? { role: t.role, content: t.content, tools: t.tools, at: t.at } : { role: t.role, content: t.content, at: t.at },
        ),
        mode,
      },
      ctrl.signal,
      (s) => {
        latest = s
        if (!frame) frame = requestAnimationFrame(flush)
      },
    )
    if (frame) cancelAnimationFrame(frame)
    if (r.abort === ctrl) r.abort = null
    if (gen !== r.gen) return null
    if (!res.ok) {
      set({ turns: history, error: res.error, status: res.status === 0 || res.status >= 500 || res.status === 429 ? 'busy' : 'error' })
      return history
    }
    if (!res.text && !res.docs.length) {
      set({ turns: history, status: 'idle' })
      return history
    }
    const done: Turn[] = [
      ...history,
      {
        role: 'assistant',
        content: res.text || 'Done.',
        at: new Date().toISOString(),
        mode,
        ...(res.traces.length ? { tools: res.traces } : {}),
        ...(res.docs.length ? { docs: res.docs } : {}),
      },
    ]
    const chatId = chats.save(get().chatId, strip(done))
    set({ turns: done, chatId, error: res.error ?? '', status: res.error ? 'busy' : 'idle' })
    return done
  }

  const drain = async (turnsNow: Turn[], gen: number) => {
    let cur: Turn[] | null = turnsNow
    while (cur && gen === r.gen && get().queued.length) {
      const q = get().queued
      set({ queued: [] })
      const o = { mode: q[q.length - 1].opts.mode ?? q[0].opts.mode }
      const next: Turn[] = [...cur, { role: 'user', content: q.map((x) => x.text).join('\n\n'), at: new Date().toISOString() }]
      cur = await runOnce(next, o)
    }
    if (gen === r.gen) r.busy = false
  }

  const run = async (history: Turn[], opts: SendOptions) => {
    const gen = r.gen
    r.busy = true
    const done = await runOnce(history, opts)
    if (done) await drain(done, gen)
    else if (gen === r.gen) r.busy = false
  }

  const detach = () => {
    r.gen++
    r.abort?.abort()
    r.abort = null
    r.busy = false
    r.edit = false
    r.last = null
  }

  return {
    send(text: string, opts: SendOptions = {}) {
      const content = text.trim()
      if (!content) return
      if (r.busy) return set({ queued: [...get().queued, { text: content, opts }] })
      const { turns, title } = get()
      let base = turns
      if (r.edit) {
        r.edit = false
        const li = turns.map((t) => t.role).lastIndexOf('user')
        if (li >= 0) base = turns.slice(0, li)
      }
      const history: Turn[] = [...base, { role: 'user', content, at: new Date().toISOString() }]
      if (!title) set({ title: content.slice(0, 60) })
      void run(history, opts)
    },
    unqueue(i: number) {
      const q = get().queued
      set({ queued: q.filter((_, j) => j !== i) })
      return q[i]?.text ?? ''
    },
    retry() {
      const { status, turns } = get()
      if (status === 'streaming') return
      if (r.last) return void run(r.last.history, r.last.opts)
      const history = turns[turns.length - 1]?.role === 'assistant' ? turns.slice(0, -1) : turns
      if (history.length && history[history.length - 1].role === 'user') void run(history, { mode: readAiMode() })
    },
    stop() {
      if (get().status === 'streaming') r.abort?.abort()
    },
    beginEdit(): string | null {
      if (r.busy) return null
      const lastUser = [...get().turns].reverse().find((t) => t.role === 'user')
      if (!lastUser) return null
      r.edit = true
      return lastUser.content
    },
    cancelEdit() {
      r.edit = false
    },
    reset() {
      detach()
      set(EMPTY)
    },
    load(id: string) {
      const c = chats.get(id)
      if (!c) return false
      detach()
      set({ ...EMPTY, turns: c.messages, chatId: c.id, title: c.title })
      return true
    },
  }
}

type Actions = ReturnType<typeof chatActions>
const actionsOf = new WeakMap<Store, Actions>()

export function useAiChat() {
  const [store] = useState(createStore)
  const st = useSyncExternalStore(store.subscribe, store.get, store.get)
  let a = actionsOf.get(store)
  if (!a) {
    a = chatActions(store)
    actionsOf.set(store, a)
  }
  return { ...st, ...a, queued: st.queued.map((q) => q.text) }
}

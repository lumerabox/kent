'use client'

import { chatTitle, requestText, type ChatMessage, type ChatSummary } from '@/lib/ai/history'

// Chat history lives in this browser (localStorage). No server storage, no accounts.

export type StoredChat = { id: string; title: string; updatedAt: string; pinned?: boolean; messages: ChatMessage[] }

const KEY = 'kent-chats'
const MAX_CHATS = 100
const ls = new Set<() => void>()
let cache: StoredChat[] | null = null
let summaries: ChatSummary[] = []

function read(): StoredChat[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as StoredChat[]
    cache = Array.isArray(raw) ? raw : []
  } catch {
    cache = []
  }
  summaries = summarize(cache)
  return cache
}

const summarize = (list: StoredChat[]): ChatSummary[] =>
  [...list]
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, title, updatedAt, pinned }) => ({ id, title, updatedAt, pinned }))

function write(list: StoredChat[]) {
  let next = list.slice(0, MAX_CHATS)
  // Quota full (images are large): drop the oldest chats until it fits
  for (;;) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
      break
    } catch {
      if (next.length <= 1) break
      next = [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, -1)
    }
  }
  cache = next
  summaries = summarize(next)
  ls.forEach((l) => l())
}

export const chats = {
  subscribe(l: () => void) {
    ls.add(l)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return
      cache = null
      read()
      l()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      ls.delete(l)
      window.removeEventListener('storage', onStorage)
    }
  },
  list: (): ChatSummary[] => (read(), summaries),
  get: (id: string) => read().find((c) => c.id === id) ?? null,
  save(id: string | null, messages: ChatMessage[]): string {
    const all = read()
    const now = new Date().toISOString()
    const cur = id ? all.find((c) => c.id === id) : null
    if (cur) {
      write(all.map((c) => (c.id === cur.id ? { ...c, messages, updatedAt: now } : c)))
      return cur.id
    }
    const first = messages.find((m) => m.role === 'user')
    const nid = crypto.randomUUID()
    write([{ id: nid, title: chatTitle(requestText(first?.content ?? '')), updatedAt: now, messages }, ...all])
    return nid
  },
  rename: (id: string, title: string) => write(read().map((c) => (c.id === id ? { ...c, title: title.trim().slice(0, 80) || c.title } : c))),
  pin: (id: string, pinned: boolean) => write(read().map((c) => (c.id === id ? { ...c, pinned } : c))),
  remove: (ids: string[]) => write(read().filter((c) => !ids.includes(c.id))),
  clear: () => write([]),
}

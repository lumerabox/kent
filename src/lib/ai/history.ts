// Chat history: titles and time groups (client safe)

import type { AiDocRef, AiTrace } from './events'
import type { AiMode } from './modes'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  at?: string
  /** Jejak tool jawaban ini (dikirim ulang agar AI paham konteks giliran sebelumnya) */
  tools?: AiTrace[]
  /** Konten yang dibuat/diubah jawaban ini */
  docs?: AiDocRef[]
  mode?: AiMode
}
export type ChatSummary = {
  id: number | string
  title: string
  updatedAt: string
  kind?: string | null
  pinned?: boolean
  group?: number | string | null
  /** Jawaban Kent masih berjalan di server */
  live?: boolean
  /** Judul pendek sedang dibuat Kent */
  naming?: boolean
  /** Hasil cari: potongan isi pesan yang cocok */
  match?: string
}
export type ChatGroup = { id: number | string; name: string }

/** Permintaan user tanpa isi lampiran, blok teks terpilih, dan penanda gambar (untuk judul) */
export function requestText(text: string) {
  return text
    .replace(/\n*\[\[lampiran:([^\]\n]+)\]\]\n[\s\S]*?\n\[\[\/lampiran\]\]/g, ' (lampiran $1)')
    .replace(/\[\[lampiran:[^\]]*\]\][\s\S]*$/, '')
    .replace(/\[\[gambar:[^\]]*\]\]/g, '(gambar)')
    .trim()
}

/** Judul dari pesan pertama: satu baris, maks. 60 karakter */
export function chatTitle(text: string) {
  const line = text.replace(/\s+/g, ' ').trim()
  if (line.length <= 60) return line || 'New chat'
  const cut = line.slice(0, 60)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 30 ? cut.slice(0, sp) : cut).trim()}…`
}

const dayKey = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60e3) / 864e5)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14.20" today/yesterday, "7 Nov" older (local time) */
export function chatTime(iso: string, now = new Date()) {
  const d = new Date(iso)
  const diff = dayKey(now) - dayKey(d)
  if (diff <= 1) return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Drawer: Today / Yesterday / Last 7 days / Earlier. Page: Today / Earlier */
export function groupChats<T extends ChatSummary>(list: T[], mode: 'drawer' | 'page', now = new Date()) {
  const groups: { label: string; items: T[] }[] = []
  const push = (label: string, item: T) => {
    const g = groups.find((x) => x.label === label)
    if (g) g.items.push(item)
    else groups.push({ label, items: [item] })
  }
  for (const c of list) {
    const diff = dayKey(now) - dayKey(new Date(c.updatedAt))
    if (diff <= 0) push('Today', c)
    else if (mode === 'page') push('Earlier', c)
    else if (diff === 1) push('Yesterday', c)
    else if (diff < 7) push('Last 7 days', c)
    else push('Earlier', c)
  }
  return groups
}

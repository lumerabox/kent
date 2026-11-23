import { extractHtml, pickZipEntries, readZip } from './extract'

// Attachments: text files are read in the browser and added to the user message with markers, so they stay in
// the conversation without server storage. Images are downscaled to a JPEG data URL and sent to the model as image input.
export const FILE_ACCEPT =
  '.txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.mhtml,.xml,.zip,.pdf,application/pdf,text/plain,text/markdown,text/csv,text/html,application/zip,application/x-zip-compressed'
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic'
export const ATTACH_ACCEPT = `${FILE_ACCEPT},${IMAGE_ACCEPT}`
export const isImageFile = (f: File) => f.type.startsWith('image/')
export const isPdfFile = (f: File) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf'
export const isZipFile = (f: File) => /\.zip$/i.test(f.name) || /zip/.test(f.type)
export const ATTACH_MAX_FILES = 6
/** Batas pesan yang dikirim (sama dengan MAX_CHARS server dikurangi sedikit ruang) */
export const MESSAGE_MAX = 59_500
/** Total isi lampiran per pesan (sisa untuk teks user) */
export const ATTACH_BUDGET = 54_000
const MAX_BYTES = 2_000_000
/** Halaman tersimpan (Save as…) sering berisi CSS/JS inline: boleh lebih besar */
const MAX_HTML_BYTES = 25_000_000
const MAX_ZIP_BYTES = 60_000_000

export type Attachment = {
  name: string
  text: string
  cut: boolean
  image?: { url: string; width: number; height: number }
}

const IMG_OPEN = '[[gambar:'
const IMG_CLOSE = '[[/gambar]]'
const IMG_RE = /\n*\[\[gambar:(\d+)\|([^\]\n]*)\]\]\n([\s\S]*?)\n\[\[\/gambar\]\]/g
const IMG_MAX_SIDE = 1280

/** Image → downscaled JPEG data URL (read by the model when the message is sent) */
export async function uploadImage(file: File): Promise<Attachment | string> {
  if (file.size > 20_000_000) return `${file.name} is larger than 20 MB.`
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return `${file.name} could not be read.`
  const k = Math.min(1, IMG_MAX_SIDE / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * k)
  const h = Math.round(bmp.height * k)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return `${file.name} could not be read.`
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return { name: safeName(file.name), text: '', cut: false, image: { url: c.toDataURL('image/jpeg', 0.8), width: w, height: h } }
}

const OPEN = '[[lampiran:'
const CLOSE = '[[/lampiran]]'
const RE = /\n*\[\[lampiran:([^\]\n]+)\]\]\n([\s\S]*?)\n\[\[\/lampiran\]\]/g

const safeName = (n: string) => n.replace(/[\]\n|]/g, ' ').slice(0, 80)
const isHtmlName = (n: string) => /\.(html?|mhtml)$/i.test(n)

/** Teks + nama → lampiran (HTML diekstrak: tabel Markdown + teks berurutan) */
function toAttachment(name: string, raw: string, budget: number): Attachment | string {
  let text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (isHtmlName(name) || /^<!doctype html|^<html[\s>]/i.test(text)) text = extractHtml(text).text
  if (!text) return `${name} is empty.`
  if (budget < 500) return 'Attachment limit reached for this message.'
  const cut = text.length > budget
  return { name: safeName(name), text: cut ? text.slice(0, budget) : text, cut }
}

/** PDF is read on the server (POST /api/pdf) */
async function readPdf(file: File, budget: number): Promise<Attachment | string> {
  if (file.size > 15_000_000) return `${file.name} is larger than 15 MB.`
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/pdf', { method: 'POST', body }).catch(() => null)
  const j = (await res?.json().catch(() => null)) as { text?: string; error?: string } | null
  if (!res?.ok || !j?.text) return j?.error ?? `${file.name} could not be read.`
  if (budget < 500) return 'Attachment limit reached for this message.'
  const cut = j.text.length > budget
  return { name: safeName(file.name), text: cut ? j.text.slice(0, budget) : j.text, cut }
}

export async function readAttachment(file: File, budget: number): Promise<Attachment | string> {
  if (isPdfFile(file)) return readPdf(file, budget)
  const limit = isHtmlName(file.name) ? MAX_HTML_BYTES : MAX_BYTES
  if (file.size > limit) return `${file.name} is larger than ${Math.round(limit / 1e6)} MB.`
  return toAttachment(file.name, await file.text(), budget)
}

/**
 * Satu berkas → satu atau beberapa lampiran. ZIP: halaman HTML utama + berkas teks lain di dalamnya
 * (aset .js/.css/gambar dilewati, isi kembar dibuang).
 */
export async function readAttachments(file: File, budget: number, slots: number): Promise<Attachment[] | string> {
  if (!isZipFile(file)) {
    const r = await readAttachment(file, budget)
    return typeof r === 'string' ? r : [r]
  }
  if (file.size > MAX_ZIP_BYTES) return `${file.name} is larger than ${MAX_ZIP_BYTES / 1e6} MB.`
  const entries = await readZip(file).catch(() => 'This ZIP file could not be read.')
  if (typeof entries === 'string') return `${file.name}: ${entries}`
  const picked = pickZipEntries(entries)
  if (!picked.length) return `${file.name} has no HTML or text files.`
  const out: Attachment[] = []
  const seen = new Set<string>()
  let left = budget
  const dec = new TextDecoder()
  for (const e of picked) {
    if (out.length >= slots || left < 500) break
    if (e.size > MAX_HTML_BYTES) continue
    const r = toAttachment(`${file.name.replace(/\.zip$/i, '')}/${e.name.split('/').pop()}`, dec.decode(await e.read()), left)
    if (typeof r === 'string') continue
    // Iframe/salinan kecil tanpa isi berarti dilewati; isi kembar dibuang
    const key = r.text.slice(0, 2000)
    if (seen.has(key) || (out.length && r.text.length < 200)) continue
    seen.add(key)
    out.push(r)
    left -= r.text.length
  }
  if (!out.length) return `${file.name}: no readable text found.`
  return out
}

/** Message sent to the server: user text + attachment blocks */
export function withAttachments(text: string, files: Attachment[]) {
  const head = text.trim() || 'Read the attachment and give a short summary.'
  if (!files.length) return head
  let n = 0
  const blocks = files.map((f) =>
    f.image
      ? `${IMG_OPEN}${++n}|${f.name}|${f.image.url}]]\nImage ${f.image.width}×${f.image.height} px\n${IMG_CLOSE}`
      : `${OPEN}${f.name}]]\n${f.text}${f.cut ? '\n(terpotong)' : ''}\n${CLOSE}`,
  )
  return `${head}\n\n${blocks.join('\n\n')}`
}

/** Split user text and attachment names for the chat bubble */
export function splitAttachments(content: string): { text: string; files: string[]; images: { name: string; url?: string }[] } {
  const files: string[] = []
  const images: { name: string; url?: string }[] = []
  const text = content
    .replace(RE, (_m, name: string) => {
      files.push(name)
      return ''
    })
    .replace(IMG_RE, (_m, _id: string, label: string) => {
      // label = nama|url thumbnail (pesan lama tanpa url)
      const [name, url] = label.split('|')
      images.push({ name, ...(url && /^(https?:\/\/|\/|data:image\/)/.test(url) ? { url } : {}) })
      return ''
    })
  return { text: text.trim(), files, images }
}

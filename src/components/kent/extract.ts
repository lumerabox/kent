// Ekstraksi lampiran Kent di browser: halaman HTML tersimpan (Save as… / Webpage complete) dan arsip ZIP.
// Tujuan: angka & tabel terbaca persis (tanpa tebakan). Tabel <table> dan baris role="row" → Markdown per baris,
// teks halaman tetap berurutan dengan penanda [Tabel n]. Tanpa dependensi: ZIP dibaca lewat DecompressionStream.

import { htmlTables } from '@/lib/ai/html-table'

const DROP = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'head',
  'select',
  'button',
  'input',
  'textarea',
  'nav',
  'footer',
  '[hidden]',
  '[style*="display:none"]',
  '[style*="display: none"]',
].join(',')

const BLOCK = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'UL', 'TR',
  'CAPTION', 'TBODY', 'THEAD', 'TFOOT', 'BODY',
])

const clean = (s: string) => s.replace(/ /g, ' ').replace(/[ \t\r\f\v]+/g, ' ')
const cellText = (el: Element) => clean(el.textContent ?? '').replace(/\|/g, '/').trim()

/** Baris berbentuk div (tabel berbasis grid): role="row" berisi sel → satu baris Markdown */
function rowCells(row: Element): string[] {
  const cells = Array.from(row.querySelectorAll(':scope [role="cell"], :scope [role="gridcell"], :scope [role="columnheader"], :scope [role="rowheader"]'))
    .filter((c) => c.closest('[role="row"]') === row)
  return (cells.length ? cells : Array.from(row.children)).map(cellText)
}

export type HtmlExtract = { title: string; url: string; text: string; tables: number; rows: number }

/** HTML → teks terstruktur + tabel Markdown. Murni DOM (DOMParser), tanpa layout. */
export function extractHtml(html: string): HtmlExtract {
  const saved = html.match(/<!--\s*saved from url=\(\d+\)(\S+?)\s*-->/i)?.[1] ?? ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const url =
    doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ||
    doc.querySelector('meta[property="og:url"]')?.getAttribute('content') ||
    saved
  const title = clean(doc.querySelector('title')?.textContent ?? doc.querySelector('h1')?.textContent ?? '').trim()
  const body = doc.body ?? doc.documentElement

  body.querySelectorAll(DROP).forEach((el) => el.remove())

  // 1) Tabel HTML asli → Markdown (colspan diulang), diganti penanda di posisi aslinya
  const tables: string[] = []
  let rows = 0
  body.querySelectorAll('table').forEach((t) => {
    if (t.parentElement?.closest('table')) return // tabel bersarang ikut tabel induk
    const md = htmlTables(t.outerHTML, 50, 2000)[0]
    if (!md) {
      t.replaceWith(doc.createTextNode(`\n${cellText(t)}\n`))
      return
    }
    tables.push(md.md)
    rows += md.rows
    t.replaceWith(doc.createTextNode(`\n[Tabel ${tables.length}]\n`))
  })

  // 2) Grid berbasis div (role="row") → kumpulkan per wadah menjadi satu tabel
  const gridRows = Array.from(body.querySelectorAll('[role="row"]')).filter((r) => !r.parentElement?.closest('[role="row"]'))
  const byGrid = new Map<Element, Element[]>()
  for (const r of gridRows) {
    const grid = r.closest('[role="grid"], [role="table"], [role="treegrid"]') ?? r.parentElement ?? body
    byGrid.set(grid, [...(byGrid.get(grid) ?? []), r])
  }
  for (const [grid, list] of byGrid) {
    const data = list.map(rowCells).filter((c) => c.some(Boolean))
    if (data.length < 2) continue
    const width = Math.max(...data.map((c) => c.length))
    const pad = (c: string[]) => [...c, ...Array(width - c.length).fill('')]
    const lines = data.map((c) => `| ${pad(c).join(' | ')} |`)
    lines.splice(1, 0, `|${' --- |'.repeat(width)}`)
    tables.push(lines.join('\n'))
    rows += data.length
    const mark = doc.createTextNode(`\n[Tabel ${tables.length}]\n`)
    list[0].before(mark)
    list.forEach((r) => r.remove())
    if (grid !== body && !cellText(grid)) grid.remove()
  }

  // 3) Teks berurutan: elemen blok = baris baru (innerText tidak tersedia tanpa layout)
  let out = ''
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      out += clean(n.nodeValue ?? '')
      return
    }
    if (n.nodeType !== 1) return
    const el = n as Element
    if (el.tagName === 'BR') {
      out += '\n'
      return
    }
    const block = BLOCK.has(el.tagName)
    if (block) out += '\n'
    if (el.tagName === 'TD' || el.tagName === 'TH') out += ' '
    el.childNodes.forEach(walk)
    if (block) out += '\n'
  }
  walk(body)
  const lines: string[] = []
  for (const raw of out.split('\n')) {
    const line = raw.trim()
    if (!line) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('')
      continue
    }
    if (line === lines[lines.length - 1]) continue
    lines.push(line)
  }
  const text = lines.join('\n').trim()

  const tz = text.match(/\b(?:GMT|UTC)\s?[+-−]\s?\d{1,2}(?::\d{2})?\b/)?.[0]
  const head = [
    title && `Judul halaman: ${title}`,
    url && `Alamat: ${url}`,
    tz && `Time zone on the page: ${tz}.`,
    tables.length
      ? `Berisi ${tables.length} tabel (${rows} baris). Salin angka persis dari tabel di bawah; jangan menebak sel kosong.`
      : '',
  ].filter(Boolean)
  // Tabel lebih dulu: bila lampiran terpotong, yang hilang teks halaman, bukan data tabel
  const body2 = [
    head.join('\n'),
    ...tables.map((t, i) => `[Tabel ${i + 1}]\n${t}`),
    text ? `--- Teks halaman ---\n${text}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  return { title, url, text: body2, tables: tables.length, rows }
}

// ---------- ZIP ----------

export type ZipEntry = { name: string; size: number; read: () => Promise<Uint8Array> }

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Daftar isi ZIP (central directory). Mendukung stored & deflate, tanpa ZIP64 / enkripsi. */
export async function readZip(file: Blob): Promise<ZipEntry[] | string> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return 'This ZIP file could not be read.'
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  if (p === 0xffffffff) return 'ZIP64 archives are not supported. Zip the files again with standard settings.'
  const dec = new TextDecoder()
  const entries: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || dv.getUint32(p, true) !== 0x02014b50) return 'This ZIP file is damaged.'
    const flags = dv.getUint16(p + 8, true)
    const method = dv.getUint16(p + 10, true)
    const compSize = dv.getUint32(p + 20, true)
    const size = dv.getUint32(p + 24, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/') || flags & 1 || (method !== 0 && method !== 8)) continue
    entries.push({
      name,
      size,
      read: async () => {
        const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true)
        const raw = buf.subarray(start, start + compSize)
        return method === 0 ? raw : inflateRaw(raw)
      },
    })
  }
  return entries
}

const TEXT_EXT = /\.(html?|txt|md|markdown|csv|tsv|json|xml)$/i
const SKIP_PATH = /(^|\/)(__MACOSX|\.git|node_modules)\//i

/** Berkas yang layak dibaca dari ZIP: halaman utama dulu, lalu berkas teks lain (aset .js/.css dilewati) */
export function pickZipEntries(entries: ZipEntry[]) {
  const ok = entries.filter((e) => TEXT_EXT.test(e.name) && !SKIP_PATH.test(e.name) && !/(^|\/)\._/.test(e.name))
  const depth = (n: string) => n.split('/').length
  const isHtml = (n: string) => /\.html?$/i.test(n)
  const inAssets = (n: string) => /_files\//i.test(n)
  return ok.sort(
    (a, b) =>
      Number(inAssets(a.name)) - Number(inAssets(b.name)) ||
      Number(!isHtml(a.name)) - Number(!isHtml(b.name)) ||
      depth(a.name) - depth(b.name) ||
      b.size - a.size,
  )
}

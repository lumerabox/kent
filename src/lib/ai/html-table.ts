// Tabel HTML / TSV → tabel Markdown, baris & kolom apa adanya. Murni (tanpa modul Node), dipakai server
// (read_web_page) dan browser (tempel tabel di composer Kent).

const MAX_TABLES = 4
const MAX_ROWS = 200

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', minus: '-', ndash: '–', mdash: '—' }
const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENT[e.toLowerCase()] ?? m
  })
export const cell = (html: string) =>
  decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '/')
    .trim()

/** Semua tabel HTML → Markdown, baris & kolom apa adanya (colspan diulang). Murni, dites. */
export function htmlTables(html: string, maxTables = MAX_TABLES, maxRows = MAX_ROWS): { rows: number; md: string }[] {
  const out: { rows: number; md: string }[] = []
  for (const t of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows = (t.match(/<tr[\s\S]*?<\/tr>/gi) ?? [])
      .map((tr) =>
        (tr.match(/<t[hd]\b[^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).flatMap((c, _i, all) => {
          const span = Math.min(10, Number(c.match(/colspan=["']?(\d+)/i)?.[1] ?? 1) || 1)
          // Satu sel selebar baris (judul tanggal/grup): isi sekali, sisanya kosong agar tidak terbaca berulang
          if (all.length === 1) return [cell(c), ...Array(span - 1).fill('')] as string[]
          return Array(span).fill(cell(c)) as string[]
        }),
      )
      .filter((r) => r.some(Boolean))
    if (rows.length < 2) continue
    const width = Math.max(...rows.map((r) => r.length))
    const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')]
    const lines = rows.slice(0, maxRows).map((r) => `| ${pad(r).join(' | ')} |`)
    lines.splice(1, 0, `|${' --- |'.repeat(width)}`)
    out.push({ rows: rows.length, md: lines.join('\n') + (rows.length > maxRows ? `\n(${rows.length - maxRows} more rows cut)` : '') })
    if (out.length >= maxTables) break
  }
  return out
}


/** Teks tab-separated (salinan spreadsheet/tabel) → Markdown; null bila bukan tabel (<3 baris bertab). Murni, dites. */
export function tsvTable(text: string): string | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim())
  const rows = lines.filter((l) => l.includes('\t')).map((l) => l.split('\t').map((c) => c.replace(/\|/g, '/').trim()))
  if (rows.length < 3 || rows.length < lines.length * 0.6) return null
  const width = Math.max(...rows.map((r) => r.length))
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')]
  const out = rows.slice(0, MAX_ROWS).map((r) => `| ${pad(r).join(' | ')} |`)
  out.splice(1, 0, `|${' --- |'.repeat(width)}`)
  return out.join('\n')
}

'use client'

import { memo, type ReactNode } from 'react'

// Light Markdown for AI answers: paragraphs, ## headings, lists, tables, links.
// No raw HTML; **bold** renders as plain text. Links only http(s) or relative paths.

const clean = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
const LINK =
  /\[([^\]\n]{1,200})\]\(((?:https?:\/\/|\/)[^\s)]{0,400})\)|(https?:\/\/[^\s<>()]{2,400}[^\s<>().,;:!?'"])/g

function A({ href, children }: { href: string; children: ReactNode }) {
  const external =
    /^https?:\/\//.test(href) &&
    typeof window !== 'undefined' &&
    !href.startsWith(window.location.origin)
  return (
    <a
      className="kt-ai-md__a"
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

/** Teks satu baris dengan tautan */
function inline(raw: string): ReactNode {
  const s = clean(raw)
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of s.matchAll(LINK)) {
    const at = m.index ?? 0
    if (at > last) out.push(s.slice(last, at))
    const href = m[2] ?? m[3]
    // Raw URLs on this host are shown as a short path
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const label = m[1] ?? (origin && href.startsWith(origin) ? href.slice(origin.length) : href)
    out.push(
      <A key={k++} href={href}>
        {label}
      </A>,
    )
    last = at + m[0].length
  }
  if (!out.length) return s
  if (last < s.length) out.push(s.slice(last))
  return out
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => clean(c.trim()))
const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/
const isRule = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)
const tone = (v: string) => (/^\+\d/.test(v) ? 'up' : /^[−-]\d/.test(v) ? 'down' : undefined)

function MarkdownView({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    // Tabel: baris | … | diikuti garis |---|
    if (line.includes('|') && i + 1 < lines.length && isRule(lines[i + 1])) {
      const head = cells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim())
        rows.push(cells(lines[i++]))
      out.push(
        <div key={key++} className="kt-ai-table">
          <table>
            <thead>
              <tr>
                {head.map((h, j) => (
                  <th key={j}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {head.map((_, j) => (
                    <td key={j} data-tone={tone(r[j] ?? '')}>
                      {inline(r[j] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    const h = line.match(/^#{1,4}\s+(.*)$/)
    if (h) {
      // "## " tanpa isi (sering muncul sesaat saat stream) dilewati
      if (h[1].trim())
        out.push(
          <p key={key++} className="kt-ai-md__h">
            {inline(h[1])}
          </p>,
        )
      i++
      continue
    }
    if (ITEM.test(line)) {
      const ordered = /^\s*\d/.test(line)
      const start = ordered ? Number(line.match(/\d+/)?.[0]) : 1
      // Butir level atas + sub-butir (indentasi ≥2 spasi); baris kosong di antara butir tidak memutus daftar
      const items: { text: string; sub: string[] }[] = []
      while (i < lines.length) {
        const l = lines[i]
        if (!l.trim()) {
          const next = lines.slice(i + 1).find((x) => x.trim())
          if (
            next &&
            ITEM.test(next) &&
            (/^\s{2,}/.test(next) || /^\s*\d/.test(next) === ordered)
          ) {
            i++
            continue
          }
          break
        }
        if (!ITEM.test(l)) {
          // Lanjutan teks butir (baris terindentasi)
          if (/^\s{2,}\S/.test(l) && items.length) {
            const last = items[items.length - 1]
            if (last.sub.length) last.sub[last.sub.length - 1] += ` ${l.trim()}`
            else last.text += ` ${l.trim()}`
            i++
            continue
          }
          break
        }
        const text = l.replace(ITEM, '')
        if (/^\s{2,}/.test(l) && items.length) items[items.length - 1].sub.push(text)
        else if (/^\s*\d/.test(l) !== ordered && items.length) break
        else items.push({ text, sub: [] })
        i++
      }
      const List = ordered ? 'ol' : 'ul'
      out.push(
        <List key={key++} className="kt-ai-md__list" {...(ordered && start > 1 ? { start } : {})}>
          {items.map((it, j) => (
            <li key={j}>
              {inline(it.text)}
              {it.sub.length ? (
                <ul className="kt-ai-md__list kt-ai-md__list--sub">
                  {it.sub.map((x, k) => (
                    <li key={k}>{inline(x)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </List>,
      )
      continue
    }
    // Baris pertama selalu dipakai supaya loop pasti maju (baris tak dikenal tidak boleh membuat loop tanpa akhir)
    const para: string[] = [lines[i++].trim()]
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !ITEM.test(lines[i]) &&
      !(lines[i].includes('|') && isRule(lines[i + 1] ?? ''))
    )
      para.push(lines[i++].trim())
    out.push(<p key={key++}>{inline(para.join(' '))}</p>)
  }
  return <div className={`kt-ai-md${className ? ` ${className}` : ''}`}>{out}</div>
}

/** Di-memo: saat stream hanya jawaban yang sedang ditulis yang dirender ulang */
export const Markdown = memo(MarkdownView)

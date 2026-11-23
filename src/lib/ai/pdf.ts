// PDF attachments: text is read on the server by position (unpdf / pdf.js).

export type PdfItem = { x: number; y: number; w: number; s: string }
export type PdfPage = PdfItem[]

export const PDF_MAX_BYTES = 15 * 1024 * 1024

/** Baris berdasarkan y (toleransi 2,5pt), item diurutkan x */
function lines(items: PdfItem[]) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const out: { y: number; items: PdfItem[] }[] = []
  for (const it of sorted) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.y - it.y) <= 2.5) last.items.push(it)
    else out.push({ y: it.y, items: [it] })
  }
  for (const l of out) l.items.sort((a, b) => a.x - b.x)
  return out
}

/** Teks biasa per baris (PDF umum) */
export function pdfPlainText(pages: PdfPage[]): string {
  return pages
    .map((p) =>
      lines(p)
        .map((l) => {
          let s = ''
          let end = 0
          for (const it of l.items) {
            if (s && it.x - end > 12) s += '   '
            else if (s && it.x - end > 1) s += ' '
            s += it.s
            end = it.x + it.w
          }
          return s.trim()
        })
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')
}

/** pdf.js menolak jalan bila Array.prototype punya properti enumerable (ada dependency yang menambah "random");
 *  dibuat non-enumerable, nilainya tetap */
function hideArrayExtras() {
  for (const k in Array.prototype) {
    const d = Object.getOwnPropertyDescriptor(Array.prototype, k)
    if (d?.configurable) Object.defineProperty(Array.prototype, k, { ...d, enumerable: false })
  }
}

export async function pdfPages(data: Uint8Array): Promise<PdfPage[]> {
  hideArrayExtras()
  const { getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(data)
  const pages: PdfPage[] = []
  for (let n = 1; n <= Math.min(pdf.numPages, 60); n++) {
    const page = await pdf.getPage(n)
    const h = page.getViewport({ scale: 1 }).height
    const tc = await page.getTextContent()
    pages.push(
      (tc.items as { str?: string; transform?: number[]; width?: number }[])
        .filter((i) => i.str?.trim() && i.transform)
        .map((i) => ({ x: i.transform![4], y: h - i.transform![5], w: i.width ?? 0, s: i.str! })),
    )
  }
  return pages
}


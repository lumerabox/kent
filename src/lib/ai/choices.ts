// Opsi yang bisa diklik dan saran langkah berikutnya di jawaban Kent (19 Nov 2026). Murni, dites.
// Kent menulis di akhir jawaban:
//   [[opsi]]
//   - Buat draft sekarang (rekomendasi)
//   - Tambah angka CPI dulu
//   [[/opsi]]
//   [[saran]]
//   - Buat versi singkat untuk newsletter
//   [[/saran]]
// Opsi = pilihan atas pertanyaan Kent (klik = kirim). Saran = isian kolom tulis (Tab untuk memakai).

export type Choice = { label: string; recommended: boolean }
export type Choices = { body: string; options: Choice[]; suggestions: string[] }

const BLOCK = /\[\[(opsi|saran)\]\]([\s\S]*?)\[\[\/\1\]\]/gi
const REC = /\s*[([]\s*(rekomendasi|recommended|disarankan)\s*[)\]]\s*$/i

const items = (raw: string) =>
  raw
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6)

export function splitChoices(text: string): Choices {
  const options: Choice[] = []
  const suggestions: string[] = []
  let body = text.replace(BLOCK, (_, kind: string, raw: string) => {
    for (const it of items(raw)) {
      if (kind.toLowerCase() === 'opsi') options.push({ label: it.replace(REC, '').slice(0, 160), recommended: REC.test(it) })
      else suggestions.push(it.slice(0, 160))
    }
    return ''
  })
  // blok yang belum selesai saat streaming tidak ikut tampil sebagai teks
  body = body.replace(/\[\[(opsi|saran)\]\][\s\S]*$/i, '').replace(/\[\[?(o(p(s(i)?)?)?|s(a(r(a(n)?)?)?)?)?$/i, '')
  // rekomendasi selalu di urutan pertama
  options.sort((a, b) => Number(b.recommended) - Number(a.recommended))
  return { body: body.trimEnd(), options, suggestions }
}

/** Isian kolom tulis setelah jawaban terakhir: opsi rekomendasi, lalu saran pertama */
export function nextSuggestion(text: string | undefined): string {
  if (!text) return ''
  const c = splitChoices(text)
  return c.options.find((o) => o.recommended)?.label ?? c.suggestions[0] ?? ''
}

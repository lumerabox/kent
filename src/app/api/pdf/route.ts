import { PDF_MAX_BYTES, pdfPages, pdfPlainText } from '@/lib/ai/pdf'

export const runtime = 'nodejs'

// POST /api/pdf (multipart "file") → { name, text }
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') return Response.json({ error: 'No PDF.' }, { status: 400 })
  if (file.size > PDF_MAX_BYTES) return Response.json({ error: 'PDF is larger than 15 MB.' }, { status: 400 })
  const name = file.name.replace(/[\]\n|]/g, ' ').slice(0, 80)
  try {
    const text = pdfPlainText(await pdfPages(new Uint8Array(await file.arrayBuffer())))
    if (!text.trim()) return Response.json({ error: `${name} has no text (scanned PDF?).` }, { status: 400 })
    return Response.json({ name, text })
  } catch {
    return Response.json({ error: `${name} could not be read.` }, { status: 400 })
  }
}

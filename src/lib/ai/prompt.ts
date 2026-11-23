// System prompt. Persona is neutral and can be replaced without code changes:
// KENT_SYSTEM_PROMPT (env) replaces the persona block; KENT_NAME renames the assistant.

export const kentName = () => process.env.KENT_NAME?.trim() || 'Kent'

const DEFAULT_PERSONA = (name: string) => `You are ${name}, a sharp, friendly assistant.
- Reply in the user's language. Be direct and concise; no filler, no repeating the question.
- Use Markdown when it helps (short lists, tables, code blocks). Keep paragraphs short.
- Never invent facts, numbers, quotes, dates or sources. If you are not sure, say so.
- For anything recent or time-sensitive, use web_search and cite sources as Markdown links.
- When the user shares a link, open it with read_web_page before answering about it.
- If a request is ambiguous, ask one short question instead of guessing.`

export function systemPrompt(opts: { now?: Date; tools: string[]; extra?: string | null }) {
  const name = kentName()
  const persona = process.env.KENT_SYSTEM_PROMPT?.trim() || DEFAULT_PERSONA(name)
  const now = opts.now ?? new Date()
  const parts = [
    persona,
    `Current date and time (UTC): ${now.toISOString().slice(0, 16).replace('T', ' ')}.`,
    opts.tools.length ? `Tools available: ${opts.tools.join(', ')}.` : 'No tools are available; answer from what you know.',
    'When you ask the user to pick, end with clickable options:\n[[opsi]]\n- First option (recommended)\n- Second option\n[[/opsi]]\nYou may also suggest up to 3 next steps:\n[[saran]]\n- A follow-up the user might send\n[[/saran]]',
  ]
  if (opts.extra) parts.push(opts.extra)
  return parts.join('\n\n')
}

// Slash commands in the composer. The message is sent as typed ("/summarize text…"); the server reads
// the command at the start of the last message and adds its instruction to the system prompt.

export type SlashCommand = {
  /** Without the slash, lowercase */
  cmd: string
  label: string
  hint: string
}

export const BUILTIN_SLASH: (SlashCommand & { prompt: string })[] = [
  {
    cmd: 'summarize',
    label: 'Summarize',
    hint: 'Text, file or link in 3–5 points',
    prompt:
      'Summarize the material in the user message (text, attachment or link; open links with read_web_page) in 3–5 short points. Keep numbers exactly as in the source and add no new facts.',
  },
  {
    cmd: 'rewrite',
    label: 'Rewrite',
    hint: 'Clearer and tighter, same facts',
    prompt:
      'Rewrite the text in the user message so it is clearer and tighter. Keep every fact, number and quote. Return only the rewritten text.',
  },
  {
    cmd: 'translate',
    label: 'Translate',
    hint: 'Indonesian ↔ English',
    prompt:
      'Translate the text in the user message. Indonesian becomes English, any other language becomes Indonesian, unless the user names a language. Keep the meaning, tone and formatting.',
  },
  {
    cmd: 'research',
    label: 'Research',
    hint: 'Search the web and cite sources',
    prompt:
      'Research the question in the user message with web_search (and read_web_page for key sources). Answer concisely and cite every source as a Markdown link. Say clearly when something could not be confirmed.',
  },
]

export const SLASH_COMMANDS: SlashCommand[] = BUILTIN_SLASH.map(({ prompt: _p, ...c }) => c)

/** Text in the composer is a command being typed → the word after "/" (may be empty); null = not a command */
export function slashQuery(text: string): string | null {
  const m = /^\/([\p{L}\p{N}-]*)$/u.exec(text)
  return m ? m[1].toLowerCase() : null
}

/** Filter commands: prefix matches first, then matches in the command or label */
export function filterSlash(list: SlashCommand[], q: string): SlashCommand[] {
  const k = q.toLowerCase()
  if (!k) return list
  const starts = list.filter((c) => c.cmd.startsWith(k))
  const has = list.filter((c) => !c.cmd.startsWith(k) && (c.cmd.includes(k) || c.label.toLowerCase().includes(k)))
  return [...starts, ...has]
}

/** Command at the start of a message: "/summarize text…" → its instruction; unknown = null */
export function slashSystem(text: string): string | null {
  const m = /^\/([\p{L}\p{N}-]+)(?:\s+|$)/u.exec(text.trimStart())
  if (!m) return null
  const c = BUILTIN_SLASH.find((x) => x.cmd === m[1].toLowerCase())
  return c ? `# Command /${c.cmd} from the user\n${c.prompt}` : null
}

// Reasoning modes (client safe). Order = menu order from the top; default Medium.

/** Kent version shown in settings */
export const KENT_VERSION = '1.0'

/** Model name shown in the mode picker (override with NEXT_PUBLIC_KENT_MODEL_NAME) */
export const AI_MODEL_NAME = process.env.NEXT_PUBLIC_KENT_MODEL_NAME || 'Kent'

export const AI_MODES = ['ultra', 'max', 'extra', 'high', 'medium', 'low'] as const
export type AiMode = (typeof AI_MODES)[number]
export const DEFAULT_AI_MODE: AiMode = 'medium'

export const isAiMode = (v: unknown): v is AiMode =>
  typeof v === 'string' && (AI_MODES as readonly string[]).includes(v)

export const AI_MODE_INFO: Record<AiMode, { label: string; hint: string }> = {
  ultra: { label: 'Ultra', hint: 'Most thorough. Longest research.' },
  max: { label: 'Max', hint: 'Deepest reasoning.' },
  extra: { label: 'Extra', hint: 'Extra reasoning and more context.' },
  high: { label: 'High', hint: 'Thinks longer and gathers more context.' },
  medium: { label: 'Med', hint: 'Balanced and fast.' },
  low: { label: 'Low', hint: 'Quick answers for simple tasks.' },
}

/** Per mode: reasoning effort, tool rounds and optional model override (env AI_MODEL_<MODE>) */
export const MODE_CONFIG: Record<AiMode, { effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'; rounds: number }> = {
  ultra: { effort: 'max', rounds: 12 },
  max: { effort: 'xhigh', rounds: 10 },
  extra: { effort: 'high', rounds: 8 },
  high: { effort: 'high', rounds: 6 },
  medium: { effort: 'medium', rounds: 5 },
  low: { effort: 'low', rounds: 3 },
}

const KEY = 'kent-mode'

/** Last choice in this browser (default Medium) */
export function readAiMode(): AiMode {
  try {
    const v = window.localStorage.getItem(KEY)
    return isAiMode(v) ? v : DEFAULT_AI_MODE
  } catch {
    return DEFAULT_AI_MODE
  }
}

export function saveAiMode(mode: AiMode) {
  try {
    window.localStorage.setItem(KEY, mode)
  } catch {}
  window.dispatchEvent(new CustomEvent('kent:mode', { detail: mode }))
}

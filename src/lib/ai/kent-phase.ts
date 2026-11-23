import { statusPhase } from './events'

// KentMark expression per phase. Pure; client hook in components/kent/useKentState.

export type KentPhaseState = 'idle' | 'think' | 'research' | 'write' | 'done' | 'fail'

/** Status stream (thinking / nama tool / compose:<tool>) → ekspresi Kent */
export function kentStateOf(streaming: boolean, status: string | null | undefined, outcome: 'done' | 'fail' | null = null): KentPhaseState {
  if (!streaming) return outcome ?? 'idle'
  const phase = statusPhase(status || 'thinking')
  if (phase === 'Research') return 'research'
  if (phase === 'Writing' || phase === 'Saving') return 'write'
  return 'think'
}

/** Lama ekspresi selesai/gagal sebelum kembali diam */
export const KENT_OUTCOME_MS = { done: 1800, fail: 3200 } as const

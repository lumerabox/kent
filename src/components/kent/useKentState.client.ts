'use client'

import { useEffect, useRef, useState } from 'react'

import { KENT_OUTCOME_MS, kentStateOf, type KentPhaseState } from '@/lib/ai/kent-phase'

/** Ekspresi Kent mengikuti stream: riset, menulis, lalu selesai (senyum) atau gagal (lesu) sebentar */
export function useKentState(streaming: boolean, status: string | null | undefined, error: string): KentPhaseState {
  const [outcome, setOutcome] = useState<'done' | 'fail' | null>(null)
  const was = useRef(streaming)
  useEffect(() => {
    // Selama stream, outcome lama diabaikan kentStateOf
    if (streaming) {
      was.current = true
      return
    }
    if (!was.current && !error) return
    was.current = false
    const o = error ? 'fail' : 'done'
    const a = window.setTimeout(() => setOutcome(o), 0)
    const b = window.setTimeout(() => setOutcome(null), KENT_OUTCOME_MS[o])
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [streaming, error])
  return kentStateOf(streaming, status, outcome)
}

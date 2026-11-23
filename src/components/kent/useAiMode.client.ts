'use client'

import { useSyncExternalStore } from 'react'

import { DEFAULT_AI_MODE, readAiMode, saveAiMode, type AiMode } from '@/lib/ai/modes'

const subscribe = (on: () => void) => {
  window.addEventListener('kent:mode', on)
  window.addEventListener('storage', on)
  return () => {
    window.removeEventListener('kent:mode', on)
    window.removeEventListener('storage', on)
  }
}

/** Mode reasoning bersama (drawer, halaman AI, Assist); tersimpan per browser, bawaan Medium */
export function useAiMode(): [AiMode, (m: AiMode) => void] {
  const mode = useSyncExternalStore(subscribe, readAiMode, () => DEFAULT_AI_MODE)
  return [mode, saveAiMode]
}

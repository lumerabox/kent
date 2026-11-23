'use client'

import { useSyncExternalStore } from 'react'

// Minimal toast store: toast.success/error/info, rendered by <Toaster /> in the root layout.

type Kind = 'success' | 'error' | 'info'
type Item = { id: number; kind: Kind; text: string }

let items: Item[] = []
let seq = 0
const ls = new Set<() => void>()
const emit = () => ls.forEach((l) => l())

function push(kind: Kind, text: string, ms = kind === 'error' ? 5000 : 3200) {
  const id = ++seq
  items = [...items.slice(-3), { id, kind, text }]
  emit()
  window.setTimeout(() => {
    items = items.filter((i) => i.id !== id)
    emit()
  }, ms)
}

export const toast = {
  success: (t: string) => push('success', t),
  error: (t: string) => push('error', t),
  info: (t: string) => push('info', t),
}

const subscribe = (l: () => void) => {
  ls.add(l)
  return () => {
    ls.delete(l)
  }
}
const EMPTY: Item[] = []

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY)
  return (
    <div className="kt-toasts" role="status" aria-live="polite">
      {list.map((i) => (
        <div key={i.id} className={`kt-toast kt-toast--${i.kind}`}>
          {i.text}
        </div>
      ))}
    </div>
  )
}

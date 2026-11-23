'use client'

import { useRef, useState, type DragEvent } from 'react'

/** Cocokkan berkas dengan atribut `accept` (".csv,text/csv", "image/*") */
export function fileMatches(file: File, accept?: string) {
  if (!accept) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return accept
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .some((a) => (a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? type.startsWith(a.slice(0, -1)) : type === a))
}

/**
 * Seret & lepas berkas ke elemen mana pun: sebarkan `dropProps` ke elemen sasaran,
 * `dragging` untuk gaya sorot. Berkas yang tidak cocok `accept` diteruskan ke `onReject`.
 */
export function useFileDrop(
  onFile: (file: File) => void,
  opts: {
    accept?: string
    disabled?: boolean
    onReject?: (file: File) => void
    /** Banyak berkas sekaligus: dipanggil sekali dengan semua berkas yang cocok (menggantikan onFile) */
    onFiles?: (files: File[]) => void
  } = {},
) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (opts.disabled || !hasFiles(e)) return
      e.preventDefault()
      depth.current += 1
      setDragging(true)
    },
    onDragOver: (e: DragEvent) => {
      if (opts.disabled || !hasFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: (e: DragEvent) => {
      if (opts.disabled || !hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    },
    onDrop: (e: DragEvent) => {
      if (opts.disabled || !hasFiles(e)) return
      e.preventDefault()
      // Area lepas bersarang (kolom tulis di dalam panel chat): hanya yang terdalam yang menerima
      e.stopPropagation()
      depth.current = 0
      setDragging(false)
      const all = Array.from(e.dataTransfer.files ?? [])
      if (opts.onFiles) {
        const ok = all.filter((f) => fileMatches(f, opts.accept))
        all.filter((f) => !ok.includes(f)).forEach((f) => opts.onReject?.(f))
        if (ok.length) opts.onFiles(ok)
        return
      }
      const file = all[0]
      if (!file) return
      if (fileMatches(file, opts.accept)) onFile(file)
      else opts.onReject?.(file)
    },
  }
  return { dragging, dropProps }
}

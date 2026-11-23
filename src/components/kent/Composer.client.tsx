'use client'

import { ArrowUp, Brain, Check, ChevronDown, Clock3, FileArchive, FileText, ImageIcon, LoaderCircle, Paperclip, Plus, Square, X, type LucideIcon } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'

import { Icon } from '@/components/icons'
import { toast } from '@/components/toast'
import { useFileDrop } from '@/components/useFileDrop.client'
import { AI_MODE_INFO, AI_MODEL_NAME, AI_MODES, type AiMode } from '@/lib/ai/modes'
import { SLASH_COMMANDS, filterSlash, slashQuery, type SlashCommand } from '@/lib/ai/slash'

import { htmlTables, tsvTable } from '@/lib/ai/html-table'

import {
  ATTACH_ACCEPT,
  ATTACH_BUDGET,
  ATTACH_MAX_FILES,
  FILE_ACCEPT,
  IMAGE_ACCEPT,
  MESSAGE_MAX,
  isImageFile,
  isPdfFile,
  isZipFile,
  readAttachments,
  uploadImage,
  withAttachments,
  type Attachment,
} from './attach'

/** Pilihan reasoning: tombol hanya nama mode (Ultra … Low, bawaan Med); nama model di kepala menu yang membuka ke atas. */
export function ModePicker({ mode, onChange }: { mode: AiMode; onChange: (m: AiMode) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', out)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', out)
      document.removeEventListener('keydown', key, true)
    }
  }, [open])
  return (
    <div ref={box} className="kt-pop kt-ai-mode">
      <button
        type="button"
        className={`kt-ai-mode__btn${open ? ' kt-ai-mode__btn--on' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${AI_MODEL_NAME}, reasoning ${AI_MODE_INFO[mode].label}`}
        title={`${AI_MODEL_NAME} ${AI_MODE_INFO[mode].label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon icon={Brain} size={13} />
        {AI_MODE_INFO[mode].label}
        <Icon icon={ChevronDown} size={12} />
      </button>
      {open ? (
        <div className="kt-menu kt-ai-mode__menu" role="menu" aria-label={`${AI_MODEL_NAME} reasoning`}>
          <div className="kt-ai-mode__head">{AI_MODEL_NAME}</div>
          {AI_MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={m === mode}
              className="kt-menu__item kt-ai-mode__item"
              onClick={() => {
                onChange(m)
                setOpen(false)
              }}
            >
              <span className="kt-ai-mode__text">
                <span>{AI_MODE_INFO[m].label}</span>
                <span className="kt-ai-mode__hint">{AI_MODE_INFO[m].hint}</span>
              </span>
              {m === mode ? <Icon icon={Check} size={14} /> : <span className="kt-ai-mode__check" />}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Daftar perintah di atas Composer: ↑/↓ pilih, Enter/Tab pakai, Esc tutup */
function SlashMenu({ items, active, onPick, onHover }: { items: SlashCommand[]; active: number; onPick: (c: SlashCommand) => void; onHover: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    box.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])
  return (
    <div ref={box} className="kt-menu kt-ai-slash" role="listbox" id="kt-ai-slash" aria-label="Commands">
      <p className="kt-ai-slash__head">Commands</p>
      {items.length ? (
        items.map((c, i) => (
          <button
            key={c.cmd}
            type="button"
            role="option"
            id={`kt-ai-slash-${i}`}
            data-i={i}
            aria-selected={i === active}
            className="kt-menu__item kt-ai-slash__item"
            // Tetap fokus di kolom tulis
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => i !== active && onHover(i)}
            onClick={() => onPick(c)}
          >
            <span className="kt-ai-slash__cmd">{`/${c.cmd}`}</span>
            <span className="kt-ai-slash__text">
              <span>{c.label}</span>
              <span className="kt-ai-slash__hint">{c.hint}</span>
            </span>
          </button>
        ))
      ) : (
        <p className="kt-ai-slash__empty">No matching command</p>
      )}
    </div>
  )
}

// Chat composer: text, chips, attachments, mode picker, send button.
export type Chip = { icon: LucideIcon; label: string; title?: string; on?: boolean; onClick?: () => void }
export type ComposerHandle = { fill: (text: string) => void; focus: () => void; addFiles: (files: File[]) => void }

export const Composer = forwardRef<
  ComposerHandle,
  {
    placeholder: string
    /** Saran langkah berikutnya dari jawaban terakhir: tampil sebagai placeholder, Tab mengisi kolom */
    suggestion?: string
    chips: Chip[]
    streaming: boolean
    disabled?: boolean
    mode?: AiMode
    onMode?: (m: AiMode) => void
    /** Tombol lampiran file teks (+ seret & lepas) */
    attach?: boolean
    /** Pesan yang menunggu alur sekarang selesai (dikirim otomatis berurutan) */
    queued?: string[]
    /** Batalkan pesan antrean; isinya kembali ke kolom teks */
    onUnqueue?: (i: number) => string
    onSend: (text: string) => void
    onStop: () => void
    /** ↑ di kolom kosong: isi pesan user terakhir untuk diubah (null = tidak bisa) */
    onEditLast?: () => string | null
    onEditCancel?: () => void
    /** Pasting long text sends it right away */
    sendOnPaste?: boolean
  }
>(function Composer({ placeholder, suggestion, chips, streaming, disabled, mode, onMode, attach, queued = [], onUnqueue, onSend, onStop, onEditLast, onEditCancel, sendOnPaste }, ref) {
  const pasteSend = useRef<'text' | 'file' | null>(null)
  const [text, setText] = useState('')
  /** Sedang mengubah pesan terakhir; tail = penanda lampiran/gambar pesan itu (ikut dikirim ulang) */
  const [editing, setEditing] = useState<{ tail: string } | null>(null)
  const stopEdit = () => {
    if (!editing) return
    setEditing(null)
    onEditCancel?.()
  }
  const [files, setFiles] = useState<Attachment[]>([])
  /** Gambar yang sedang diunggah & dibaca (nama) */
  const [busy, setBusy] = useState<string[]>([])
  // Satu baris (+, teks, mode, kirim sejajar) sampai teks butuh baris kedua; lalu teks di atas, kontrol di bawah
  const [multi, setMulti] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const photoPicker = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState(false)
  const menuBox = useRef<HTMLDivElement>(null)
  // Slash command hanya di chat Kent penuh (bukan Assist)
  const commands = attach ? SLASH_COMMANDS : null
  const [slashIdx, setSlashIdx] = useState(0)
  const [slashOff, setSlashOff] = useState(false)
  const sq = attach && !disabled ? slashQuery(text) : null
  const slashItems = sq !== null && commands ? filterSlash(commands, sq) : []
  const slashOpen = sq !== null && !!commands && !slashOff
  const pickSlash = (c: SlashCommand) => {
    const t = `/${c.cmd} `
    flushSync(() => setText(t))
    const el = area.current
    if (el) {
      el.focus()
      el.setSelectionRange(t.length, t.length)
    }
  }
  useEffect(() => {
    if (!menu) return
    const out = (e: PointerEvent) => !menuBox.current?.contains(e.target as Node) && setMenu(false)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setMenu(false)
      }
    }
    document.addEventListener('pointerdown', out)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', out)
      document.removeEventListener('keydown', key, true)
    }
  }, [menu])
  // Daftar lampiran terbaru untuk addFiles yang dipanggil dari luar (seret ke seluruh panel)
  const filesRef = useRef(files)
  const busyRef = useRef(busy)
  const textRef = useRef(text)
  useEffect(() => {
    filesRef.current = files
    busyRef.current = busy
    textRef.current = text
  })
  const addFiles = async (list: File[]) => {
    if (!attach || disabled) return
    const files = filesRef.current
    const busy = busyRef.current
    let left = ATTACH_BUDGET - files.reduce((n, f) => n + f.text.length, 0) - textRef.current.length
    const next: Attachment[] = []
    let slots = ATTACH_MAX_FILES - files.length - busy.length
    for (const file of list.slice(0, Math.max(0, slots))) {
      if (isImageFile(file)) {
        // Image: downscaled in the browser, read by the model when the message is sent
        slots--
        setBusy((b) => [...b, file.name])
        void uploadImage(file).then((r) => {
          setBusy((b) => b.filter((n) => n !== file.name))
          if (typeof r === 'string') return void toast.error(r)
          setFiles((f) => [...f, r])
        })
        continue
      }
      const zip = isZipFile(file)
      // ZIP dan PDF butuh beberapa detik (PDF dibaca server): tampilkan sedang dibaca
      const slow = zip || isPdfFile(file)
      if (slow) setBusy((b) => [...b, file.name])
      const r = await readAttachments(file, left, Math.max(1, slots - next.length))
      if (slow) setBusy((b) => b.filter((n) => n !== file.name))
      if (typeof r === 'string') {
        toast.error(r)
        continue
      }
      for (const a of r) {
        if (a.cut) toast.info(`${a.name} was trimmed to fit.`)
        left -= a.text.length
        next.push(a)
      }
      if (zip) toast.info(`${file.name}: ${r.length} file${r.length === 1 ? '' : 's'} read.`)
    }
    if (list.length > ATTACH_MAX_FILES - files.length - busy.length) toast.error(`Up to ${ATTACH_MAX_FILES} files per message.`)
    if (next.length) setFiles((f) => [...f, ...next].slice(0, ATTACH_MAX_FILES))
    area.current?.focus()
  }
  const { dragging, dropProps } = useFileDrop((f) => void addFiles([f]), {
    accept: ATTACH_ACCEPT,
    disabled: !attach || disabled,
    onFiles: (list) => void addFiles(list),
    onReject: (f) => toast.error(`${f.name}: use an image, PDF, .zip, or a text file (.html, .txt, .md, .csv, .json).`),
  })
  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = '22px'
    // Maks. 5,5 baris (22px per baris), sisanya bergulir
    el.style.height = `${Math.min(el.scrollHeight, 121)}px`
    if (!el.value) setMulti(false)
    else if (el.scrollHeight > 26 || el.value.includes('\n')) setMulti(true)
  }
  useImperativeHandle(ref, () => ({
    fill: (t: string) => {
      // Nilai harus sudah di DOM sebelum kursor dipindah ke akhir
      flushSync(() => setText(t))
      const el = area.current
      if (!el) return
      grow(el)
      el.focus()
      el.setSelectionRange(t.length, t.length)
    },
    focus: () => area.current?.focus(),
    addFiles: (list: File[]) => void addFiles(list),
  }))
  const ready = (!!text.trim() || files.length > 0) && !busy.length
  // Saat Kent masih bekerja pesan tetap bisa dikirim: masuk antrean dan dikirim setelah alur sekarang selesai
  const submit = () => {
    if (disabled || !ready) return
    const msg = withAttachments(text, files) + (editing?.tail ?? '')
    if (msg.length > MESSAGE_MAX) return void toast.error('Message is too long. Remove a file or shorten the text.')
    onSend(msg)
    setEditing(null)
    setText('')
    setFiles([])
    requestAnimationFrame(() => grow(area.current))
  }
  // Tempel saat sendOnPaste: kirim begitu teks/lampiran siap (lampiran dibaca asinkron)
  useEffect(() => {
    if (!pasteSend.current || !ready || (pasteSend.current === 'file' && !files.length)) return
    pasteSend.current = null
    submit()
  })
  return (
    <div
      className={`kt-ai-composer${multi ? ' kt-ai-composer--multi' : ''}${dragging ? ' kt-drop--on' : ''}`}
      onClick={(e) => e.target === e.currentTarget && area.current?.focus()}
      {...(attach ? dropProps : {})}
    >
      {slashOpen ? <SlashMenu items={slashItems} active={Math.min(slashIdx, Math.max(0, slashItems.length - 1))} onPick={pickSlash} onHover={setSlashIdx} /> : null}
      {queued.length ? (
        <div className="kt-ai-queue" aria-live="polite">
          {queued.map((q, i) => (
            <div key={`${i}-${q.slice(0, 20)}`} className="kt-ai-queue__item">
              <Icon icon={Clock3} size={13} />
              <span className="kt-ai-queue__label">Queued</span>
              <span className="kt-ai-queue__text" title={q}>
                {q.split('\n')[0]}
              </span>
              {onUnqueue ? (
                <button
                  type="button"
                  aria-label="Remove from queue"
                  title="Remove from queue (text goes back to the box)"
                  onClick={() => {
                    const back = onUnqueue(i)
                    if (back && !text.trim()) {
                      flushSync(() => setText(back.replace(/\n\n\[\[(lampiran|gambar):[\s\S]*$/, '')))
                      grow(area.current)
                      area.current?.focus()
                    }
                  }}
                >
                  <Icon icon={X} size={12} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {files.length || chips.length || busy.length ? (
        <div className="kt-ai-files">
          {chips.map((c) =>
            c.onClick ? (
              <button
                key={c.label}
                type="button"
                className={`kt-ai-chip${c.on ? ' kt-ai-chip--on' : ''}`}
                title={c.title}
                aria-pressed={c.on}
                onClick={c.onClick}
              >
                <Icon icon={c.icon} size={13} />
                {c.label}
              </button>
            ) : (
              <span key={c.label} className="kt-ai-chip" title={c.title}>
                <Icon icon={c.icon} size={13} />
                <span className="kt-ai-chip__text">{c.label}</span>
              </span>
            ),
          )}
          {busy.map((n) => (
            <span key={`busy-${n}`} className="kt-ai-file kt-ai-file--busy" title={n}>
              <Icon icon={LoaderCircle} size={14} />
              <span className="kt-ai-file__name">{`Reading ${n}…`}</span>
            </span>
          ))}
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className={`kt-ai-file${f.image ? ' kt-ai-file--image' : ''}`} title={f.name}>
              {f.image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- small preview
                <img className="kt-ai-file__thumb" src={f.image.url} alt="" width={22} height={22} />
              ) : (
                <Icon icon={f.image ? ImageIcon : /\.zip\//i.test(f.name) || f.name.includes('/') ? FileArchive : FileText} size={14} />
              )}
              <span className="kt-ai-file__name">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((l) => l.filter((_, j) => j !== i))}>
                <Icon icon={X} size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {editing ? (
        <p className="kt-ai-editing" role="status">
          Editing your last message · Esc to cancel
        </p>
      ) : null}
      <textarea
        ref={area}
        className="kt-ai-composer__input"
        rows={1}
        value={text}
        placeholder={suggestion && !streaming ? `${suggestion}  ·  Tab` : placeholder}
        aria-label={placeholder}
        maxLength={MESSAGE_MAX}
        role={attach ? 'combobox' : undefined}
        aria-expanded={attach ? slashOpen : undefined}
        aria-controls={slashOpen ? 'kt-ai-slash' : undefined}
        aria-activedescendant={slashOpen && slashItems.length ? `kt-ai-slash-${Math.min(slashIdx, slashItems.length - 1)}` : undefined}
        aria-autocomplete={attach ? 'list' : undefined}
        onChange={(e) => {
          setText(e.target.value)
          if (!e.target.value) stopEdit()
          setSlashIdx(0)
          setSlashOff(false)
          grow(e.target)
        }}
        onPaste={(e) => {
          // Tempel gambar dari clipboard (screenshot, gambar yang disalin) → unggah seperti pilih file
          if (sendOnPaste && !disabled && e.clipboardData.getData('text/plain').trim().length > 80) pasteSend.current = 'text'
          if (!attach || disabled) return
          const imgs = Array.from(e.clipboardData.files).filter(isImageFile)
          if (!imgs.length) {
            // Tabel yang disalin dari halaman atau spreadsheet → lampiran tabel Markdown
            // yang rapi per baris & kolom; teks panjang biasa → lampiran teks supaya kolom chat tetap bersih
            const html = e.clipboardData.getData('text/html')
            const plain = e.clipboardData.getData('text/plain')
            const tables = html ? htmlTables(html).map((t) => t.md) : []
            const tsv = tables.length ? null : tsvTable(plain)
            const body = tables.length ? tables.join('\n\n') : tsv ?? (plain.length > 2000 ? plain : null)
            if (!body) return
            e.preventDefault()
            const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '')
            const name = tables.length || tsv ? `pasted-table-${stamp}.md` : `pasted-text-${stamp}.txt`
            if (pasteSend.current) pasteSend.current = 'file'
            void addFiles([new File([body], name, { type: tables.length || tsv ? 'text/markdown' : 'text/plain' })])
            return
          }
          e.preventDefault()
          const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
          void addFiles(
            imgs.map((f, i) =>
              new File([f], `pasted-${stamp}${imgs.length > 1 ? `-${i + 1}` : ''}.${f.type.split('/')[1] || 'png'}`, { type: f.type }),
            ),
          )
        }}
        onKeyDown={(e) => {
          if (slashOpen && !e.nativeEvent.isComposing) {
            const n = slashItems.length
            if (e.key === 'ArrowDown' && n) {
              e.preventDefault()
              return setSlashIdx((i) => (i + 1) % n)
            }
            if (e.key === 'ArrowUp' && n) {
              e.preventDefault()
              return setSlashIdx((i) => (i - 1 + n) % n)
            }
            if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && n) {
              e.preventDefault()
              return pickSlash(slashItems[Math.min(slashIdx, n - 1)])
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              return setSlashOff(true)
            }
          }
          // Tab di kolom kosong = pakai saran (seperti Claude Code)
          if (e.key === 'Tab' && !e.shiftKey && !text && suggestion && !streaming && !e.nativeEvent.isComposing) {
            e.preventDefault()
            flushSync(() => setText(suggestion))
            grow(area.current)
            area.current?.setSelectionRange(suggestion.length, suggestion.length)
            return
          }
          if (e.key === 'ArrowUp' && !text && !files.length && !streaming && onEditLast && !e.nativeEvent.isComposing) {
            const last = onEditLast()
            if (last) {
              e.preventDefault()
              const cut = last.search(/\n\n\[\[(lampiran|gambar):/)
              const body = cut >= 0 ? last.slice(0, cut) : last
              setEditing({ tail: cut >= 0 ? last.slice(cut) : '' })
              flushSync(() => setText(body))
              grow(area.current)
              area.current?.setSelectionRange(body.length, body.length)
              return
            }
          }
          if (e.key === 'Escape' && editing) {
            e.preventDefault()
            e.stopPropagation()
            stopEdit()
            setText('')
            return
          }
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <div className="kt-ai-composer__row">
        {attach ? (
          <div ref={menuBox} className="kt-pop kt-ai-plus">
            <button
              type="button"
              className={`kt-ai-attach${menu ? ' kt-ai-attach--on' : ''}`}
              aria-label="Add"
              aria-haspopup="menu"
              aria-expanded={menu}
              title="Add photos or files"
              disabled={disabled || files.length + busy.length >= ATTACH_MAX_FILES}
              onClick={() => setMenu((m) => !m)}
            >
              <Icon icon={Plus} size={16} />
            </button>
            {menu ? (
              <div className="kt-menu kt-ai-plus__menu" role="menu" aria-label="Add">
                <button
                  type="button"
                  role="menuitem"
                  className="kt-menu__item kt-ai-plus__item"
                  onClick={() => {
                    setMenu(false)
                    photoPicker.current?.click()
                  }}
                >
                  <Icon icon={ImageIcon} size={15} />
                  <span className="kt-ai-plus__text">
                    <span>Add photos</span>
                    <span className="kt-ai-plus__hint">PNG, JPG, WebP, screenshot</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="kt-menu__item kt-ai-plus__item"
                  onClick={() => {
                    setMenu(false)
                    picker.current?.click()
                  }}
                >
                  <Icon icon={Paperclip} size={15} />
                  <span className="kt-ai-plus__text">
                    <span>Add files</span>
                    <span className="kt-ai-plus__hint">HTML, ZIP, CSV, TXT, MD, JSON</span>
                  </span>
                </button>
              </div>
            ) : null}
            <input
              ref={photoPicker}
              type="file"
              hidden
              multiple
              accept={IMAGE_ACCEPT}
              onChange={(e) => {
                const list = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (list.length) void addFiles(list)
              }}
            />
            <input
              ref={picker}
              type="file"
              hidden
              multiple
              accept={FILE_ACCEPT}
              onChange={(e) => {
                const list = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (list.length) void addFiles(list)
              }}
            />
          </div>
        ) : null}
        <span className="kt-ai-composer__fill" />
        {mode && onMode ? <ModePicker mode={mode} onChange={onMode} /> : null}
        {/* Kirim ↔ Stop satu tombol: ikon & sudut berubah (morph), bukan diganti elemen baru */}
        <button
          type="button"
          className={`kt-ai-send${streaming && !ready ? ' kt-ai-send--stop' : ''}`}
          aria-label={streaming && !ready ? 'Stop' : streaming ? 'Queue message' : 'Send'}
          title={streaming && !ready ? 'Stop' : streaming ? 'Send after this step finishes' : undefined}
          disabled={streaming && !ready ? false : disabled || !ready}
          onClick={streaming && !ready ? onStop : submit}
        >
          <span className="kt-ai-send__icon kt-ai-send__icon--send">
            <Icon icon={ArrowUp} size={16} />
          </span>
          <span className="kt-ai-send__icon kt-ai-send__icon--stop">
            <Icon icon={Square} size={12} />
          </span>
        </button>
      </div>
    </div>
  )
})

/** Seret & lepas ke seluruh panel chat (bukan hanya kolom tulis): berkas diteruskan ke Composer */
export function usePanelDrop(composer: RefObject<ComposerHandle | null>, enabled: boolean) {
  const { dragging, dropProps } = useFileDrop(() => {}, {
    accept: ATTACH_ACCEPT,
    disabled: !enabled,
    onFiles: (list) => composer.current?.addFiles(list),
    onReject: (f) => toast.error(`${f.name}: use an image, PDF, .zip, or a text file (.html, .txt, .md, .csv, .json).`),
  })
  const overlay = dragging ? (
    <div className="kt-ai-dropzone" aria-hidden="true">
      <div className="kt-ai-dropzone__box">
        <Icon icon={Paperclip} size={20} />
        <span>Drop files to add</span>
        <span className="kt-ai-dropzone__hint">Photos, HTML, ZIP, CSV, TXT</span>
      </div>
    </div>
  ) : null
  return { dropProps, overlay }
}

'use client'

import { Dices, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '@/components/icons'

import {
  KENT_ACCS,
  KENT_BODIES,
  KENT_DETAILS,
  KENT_MOUTH_COLORS,
  KENT_EYES,
  KENT_FACES,
  KENT_MOUTHS,
  KENT_SHAPES,
  saveKentLook,
  useKentLook,
  type KentLook,
} from './kent-look'
import { KENT_ACT_EVENT, KentMark } from './KentMark'

// Kent bermagnet: bisa ditarik sampai ±100% sisi terpendek area chat (2× versi awal); makin jauh makin berat tapi tetap ikut kursor.
// Lewat batas = lepas sendiri dan memantul pulang. Dilepas = pegas teredam dengan wobble
// (squash & stretch searah kecepatan). Hover lama (mouse) = Change appearance → modal 2 kolom.

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Tarikan d px → geser tampak. Kurva lembut (kemiringan di batas masih 0,56), jadi tidak terasa macet.
const K = 0.22
const band = (d: number, L: number) => d - (K * d * d) / L
/** Kebalikan band: posisi tampak → tarikan (untuk menangkap Kent yang masih memantul) */
const unband = (r: number, L: number) => (r >= L * (1 - K) ? L : ((1 - Math.sqrt(1 - (4 * K * r) / L)) * L) / (2 * K))

function act(box: HTMLElement | null, name: string) {
  box?.querySelector('svg.kt-kent')?.dispatchEvent(new CustomEvent(KENT_ACT_EVENT, { detail: name }))
}

export function KentGrab({
  children,
  radius,
  area = '.kt-ai-page__chat, .kt-ai',
  appearance = true,
  align = 'center',
}: {
  children: ReactNode
  /** Batas tarikan (px); kosong = 60% sisi terpendek elemen `area` */
  radius?: number
  /** Selektor wadah untuk menghitung batas tarikan */
  area?: string
  /** Hover lama menampilkan Change appearance */
  appearance?: boolean
  /** Posisi tombol hover terhadap Kent */
  align?: 'center' | 'start'
}) {
  const box = useRef<HTMLSpanElement>(null)
  const body = useRef<HTMLSpanElement>(null)
  const s = useRef({ id: -1, sx: 0, sy: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, down: 0, moved: false, eat: false, peak: 0, raf: 0, L: 200 })
  const [held, setHeld] = useState(false)
  // Posisi Kent saat tombol Change appearance muncul (null = tersembunyi)
  const [hint, setHintRect] = useState<DOMRect | null>(null)
  const setHint = (on: boolean) => setHintRect(on ? (box.current?.getBoundingClientRect() ?? null) : null)
  const [studio, setStudio] = useState(false)
  const hoverT = useRef<number | undefined>(undefined)
  const leaveT = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      cancelAnimationFrame(s.current.raf)
      clearTimeout(hoverT.current)
      clearTimeout(leaveT.current)
    },
    [],
  )

  // Tulis transform: geser + regang searah arah (tarik) atau kecepatan (pegas) + miring
  const paint = (x: number, y: number, stretch: number, ang: number, tilt: number) => {
    const el = body.current
    if (!el) return
    el.style.transform =
      `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${(ang + tilt).toFixed(2)}deg) ` +
      `scale(${(1 + stretch).toFixed(3)}, ${(1 - stretch * 0.6).toFixed(3)}) rotate(${(-ang).toFixed(2)}deg)`
  }

  const spring = () => {
    const st = s.current
    let prev = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - prev) / 1000)
      prev = now
      // Pegas teredam ringan (k 380, c 11) → 2–3 ayunan kecil sebelum diam
      const ax = -380 * st.x - 11 * st.vx
      const ay = -380 * st.y - 11 * st.vy
      st.vx += ax * dt
      st.vy += ay * dt
      st.x += st.vx * dt
      st.y += st.vy * dt
      const speed = Math.hypot(st.vx, st.vy)
      const ang = (Math.atan2(st.vy, st.vx) * 180) / Math.PI
      paint(st.x, st.y, Math.min(0.32, speed / 2400), ang, Math.max(-14, Math.min(14, st.vx / 60)))
      if (Math.hypot(st.x, st.y) < 0.25 && speed < 6) {
        if (body.current) body.current.style.transform = ''
        st.x = st.y = st.vx = st.vy = 0
        return
      }
      st.raf = requestAnimationFrame(step)
    }
    cancelAnimationFrame(st.raf)
    st.raf = requestAnimationFrame(step)
  }

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || reduced()) return
    const st = s.current
    cancelAnimationFrame(st.raf)
    st.id = e.pointerId
    const wrap = box.current?.closest(area)?.getBoundingClientRect()
    // Bawaan: 60% sisi terpendek area chat
    st.L = radius ?? Math.max(120, 0.6 * Math.min(wrap?.width ?? window.innerWidth, wrap?.height ?? window.innerHeight))
    // Mulai dari posisi tampak sekarang (bisa ditangkap lagi saat masih memantul)
    const d = Math.hypot(st.x, st.y)
    const inv = d ? unband(d, st.L) : 0
    st.sx = e.clientX - (d ? (st.x / d) * inv : 0)
    st.sy = e.clientY - (d ? (st.y / d) * inv : 0)
    st.vx = st.vy = 0
    st.t = e.timeStamp
    st.down = e.timeStamp
    st.moved = false
    st.peak = 0
    // Pointer capture baru dipasang saat seret dimulai: bila dipasang di sini, klik singkat jatuh ke
    // pembungkus (bukan svg Kent) dan animasi klik tidak pernah jalan.
  }

  const onMove = (e: React.PointerEvent) => {
    const st = s.current
    if (e.pointerId !== st.id) return
    const dx = e.clientX - st.sx
    const dy = e.clientY - st.sy
    const d = Math.hypot(dx, dy)
    if (!st.moved) {
      // Klik singkat dengan sedikit getaran tetap klik; seret = ditahan lalu digeser
      const holding = e.timeStamp - st.down >= 140
      if (d < 4 || (!holding && d < 12)) return
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      // Pengaman: pointerup di luar area/jendela, capture hilang, atau tab kehilangan fokus tetap melepas Kent
      const end = () => {
        window.removeEventListener('pointerup', end, true)
        window.removeEventListener('pointercancel', end, true)
        window.removeEventListener('blur', end)
        release()
      }
      window.addEventListener('pointerup', end, true)
      window.addEventListener('pointercancel', end, true)
      window.addEventListener('blur', end)
      st.moved = true
      setHeld(true)
      setHint(false)
      clearTimeout(hoverT.current)
      act(box.current, 'surprised')
      act(box.current, 'hold:on')
    }
    // Lewat batas magnet: lepas sendiri dan pulang
    if (d >= st.L) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      return release(true)
    }
    const r = band(d, st.L)
    const x = d ? (dx / d) * r : 0
    const y = d ? (dy / d) * r : 0
    const now = e.timeStamp
    const dt = Math.max(1, now - st.t) / 1000
    st.vx = st.vx * 0.6 + ((x - st.x) / dt) * 0.4
    st.vy = st.vy * 0.6 + ((y - st.y) / dt) * 0.4
    st.t = now
    st.x = x
    st.y = y
    const t = d / st.L
    st.peak = Math.max(st.peak, t)
    paint(x, y, t * 0.24, (Math.atan2(dy, dx) * 180) / Math.PI, Math.max(-10, Math.min(10, x / 8)))
  }

  const release = (snapped = false) => {
    const st = s.current
    st.id = -1
    if (!st.moved) return
    st.moved = false
    st.eat = true
    setHeld(false)
    act(box.current, 'hold:off')
    // Putus dari magnet: tambah sentakan ke arah rumah supaya terasa "ditarik balik"
    if (snapped) {
      st.vx -= st.x * 4
      st.vy -= st.y * 4
    }
    // Lontaran: pegas mulai dari posisi + kecepatan saat lepas
    spring()
    window.setTimeout(() => act(box.current, snapped || st.peak > 0.7 ? 'dizzy' : 'jelly-big'), 360)
  }

  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId !== s.current.id) return
    release()
  }

  const onEnter = (e: React.PointerEvent) => {
    // Portal (tombol, studio) ikut pohon React: masuk ke sana bukan hover Kent
    if (!appearance || studio || e.pointerType !== 'mouse' || !box.current?.contains(e.target as Node)) return
    clearTimeout(leaveT.current)
    clearTimeout(hoverT.current)
    hoverT.current = window.setTimeout(() => {
      if (s.current.id === -1) setHint(true)
    }, 750)
  }
  const onLeave = () => {
    clearTimeout(hoverT.current)
    leaveT.current = window.setTimeout(() => setHint(false), 220)
  }

  return (
    <span
      ref={box}
      className={`kt-kent-grab kt-kent-grab--${align}${held ? ' kt-kent-grab--held' : ''}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <span
        ref={body}
        className="kt-kent-grab__body"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={() => {
          if (s.current.id !== -1 && s.current.moved) release()
        }}
        onClickCapture={(e) => {
          // Klik setelah ditarik bukan klik
          if (s.current.eat) {
            s.current.eat = false
            e.stopPropagation()
            e.preventDefault()
          }
        }}
        onClick={(e) => {
          // Klik di area pegang sekitar Kent (bukan badannya) tetap memicu animasi klik
          const svg = body.current?.querySelector('svg.kt-kent')
          if (svg && !svg.contains(e.target as Node)) svg.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </span>
      {appearance && hint
        ? // Portal: drawer dan panel chat memotong isi (overflow), jadi tombol ditempatkan fixed di atas semuanya
          createPortal(
            <span
              className={`kt-page kt-page--part kt-kent-grab-float kt-kent-grab--${align}`}
              style={{ left: hint.left, top: hint.top, width: hint.width, height: hint.height }}
              onPointerEnter={() => clearTimeout(leaveT.current)}
              onPointerLeave={onLeave}
            >
              <button
                type="button"
                className="kt-kent-grab__hint"
                onClick={() => {
                  setHint(false)
                  setStudio(true)
                }}
              >
                Change appearance
              </button>
            </span>,
            document.body,
          )
        : null}
      {studio ? <KentStudio onClose={() => setStudio(false)} /> : null}
    </span>
  )
}

type Opt<T> = { value: T; label: string }
type TileField = 'shape' | 'eyes' | 'mouth' | 'face' | 'acc'
const TABS = [
  { id: 'shape', label: 'Shape' },
  { id: 'color', label: 'Color' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'mouth', label: 'Mouth' },
  { id: 'face', label: 'Face' },
  { id: 'acc', label: 'Accessory' },
] as const
type TabId = (typeof TABS)[number]['id']
const TILES: Record<TileField, Opt<string>[]> = { shape: KENT_SHAPES, eyes: KENT_EYES, mouth: KENT_MOUTHS, face: KENT_FACES, acc: KENT_ACCS }
const any = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)]
const HEX = /^#[0-9A-F]{6}$/i

function Swatches({ label, list, value, onPick }: { label: string; list: Opt<string>[]; value: string; onPick: (v: string) => void }) {
  const custom = !list.some((c) => c.value.toUpperCase() === value.toUpperCase())
  return (
    <section className="kt-kent-studio__group">
      <h3>{label}</h3>
      <div className="kt-kent-studio__swatches" role="radiogroup" aria-label={label}>
        {list.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={c.value.toUpperCase() === value.toUpperCase()}
            aria-label={c.label}
            title={c.label}
            className="kt-kent-studio__swatch"
            style={{ '--sw': c.value } as CSSProperties}
            onClick={() => onPick(c.value)}
          />
        ))}
        <label className="kt-kent-studio__swatch kt-kent-studio__swatch--custom" data-on={custom || undefined} title="Custom color" style={{ '--sw': value } as CSSProperties}>
          <input type="color" value={value} aria-label={`${label}: custom`} onChange={(e) => HEX.test(e.target.value) && onPick(e.target.value.toUpperCase())} />
        </label>
      </div>
    </section>
  )
}

function Tiles({ field, look }: { field: TileField; look: KentLook }) {
  return (
    <div className="kt-kent-studio__tiles" role="radiogroup" aria-label={field}>
      {TILES[field].map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === look[field]}
          className="kt-kent-studio__tile"
          style={{ '--i': Math.min(i, 14) } as CSSProperties}
          onClick={() => saveKentLook({ [field]: o.value } as Partial<KentLook>)}
        >
          <KentMark size={38} look={{ ...look, [field]: o.value } as KentLook} />
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Studio tampilan: modal di tengah, kiri pratinjau Kent (bisa ditarik), kanan pengaturan per tab */
export function KentStudio({ onClose }: { onClose: () => void }) {
  const look = useKentLook()
  const [leaving, setLeaving] = useState(false)
  const [tab, setTab] = useState<TabId>('shape')
  const card = useRef<HTMLDivElement>(null)
  const big = useRef<HTMLSpanElement>(null)
  const close = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(onClose, reduced() ? 0 : 200)
  }
  useEffect(() => {
    card.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      close()
    }
    document.addEventListener('keydown', key, true)
    return () => document.removeEventListener('keydown', key, true)
  })
  const surprise = () => {
    saveKentLook({
      body: any(KENT_BODIES).value,
      detail: any(KENT_DETAILS).value,
      shape: any(KENT_SHAPES).value,
      eyes: any(KENT_EYES).value,
      mouth: Math.random() < 0.35 ? 'dot' : any(KENT_MOUTHS).value,
      mouthColor: any(KENT_MOUTH_COLORS).value,
      face: Math.random() < 0.5 ? 'none' : any(KENT_FACES).value,
      acc: Math.random() < 0.3 ? 'none' : any(KENT_ACCS).value,
    })
    window.setTimeout(() => act(big.current, 'cheer'), 80)
  }
  const at = TABS.findIndex((t) => t.id === tab)

  return createPortal(
    <div
      className={`kt-page kt-page--part kt-kent-studio${leaving ? ' kt-kent-studio--leave' : ''}`}
      onPointerDown={(e) => e.target === e.currentTarget && close()}
    >
      <div ref={card} className="kt-kent-studio__card" role="dialog" aria-modal="true" aria-label="Change appearance" tabIndex={-1}>
        <div className="kt-kent-studio__preview">
          <span ref={big} className="kt-kent-studio__big">
            <span className="kt-kent-studio__stage" aria-hidden="true" />
            <KentGrab area=".kt-kent-studio__card" appearance={false}>
              <KentMark size={168} follow lively />
            </KentGrab>
          </span>
          <span className="kt-kent-studio__name">Kent</span>
          <span className="kt-kent-studio__tip">Click, drag, or just watch</span>
          <button type="button" className="kt-kent-studio__surprise" onClick={surprise}>
            <Icon icon={Dices} size={15} />
            Surprise me
          </button>
        </div>
        <div className="kt-kent-studio__panel">
          <div className="kt-kent-studio__head">
            <span>Change appearance</span>
            <button type="button" className="kt-kent-studio__close" aria-label="Close" title="Close" onClick={close}>
              <Icon icon={X} size={16} />
            </button>
          </div>
          <div className="kt-kent-studio__tabs" role="tablist" style={{ '--at': at, '--n': TABS.length } as CSSProperties}>
            <span className="kt-kent-studio__tab-pill" aria-hidden="true" />
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} className="kt-kent-studio__tab" onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="kt-kent-studio__body" key={tab}>
            {tab === 'color' ? (
              <>
                <Swatches label="Body color" list={KENT_BODIES} value={look.body} onPick={(v) => saveKentLook({ body: v })} />
                <Swatches label="Detail color" list={KENT_DETAILS} value={look.detail} onPick={(v) => saveKentLook({ detail: v })} />
                <Swatches label="Mouth color" list={KENT_MOUTH_COLORS} value={look.mouthColor} onPick={(v) => saveKentLook({ mouthColor: v })} />
              </>
            ) : tab === 'mouth' ? (
              <>
                <Swatches label="Mouth color" list={KENT_MOUTH_COLORS} value={look.mouthColor} onPick={(v) => saveKentLook({ mouthColor: v })} />
                <Tiles field={tab} look={look} />
              </>
            ) : (
              <Tiles field={tab} look={look} />
            )}
          </div>
          <div className="kt-kent-studio__foot">
            <button type="button" className="kt-kent-studio__reset" onClick={() => saveKentLook(null)}>
              <Icon icon={RotateCcw} size={14} />
              Reset
            </button>
            <span>Saved on this browser</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

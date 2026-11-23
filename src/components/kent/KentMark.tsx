'use client'

import { useEffect, useId, useRef, type CSSProperties } from 'react'

import { kentVars, useKentLook, type KentLook } from './kent-look'
import { BYE, INTRO, pickFrom } from './kent-motion'
import { FEAT, KentRig, featT, hatT, type KentState } from './kent-rig'
import { KENT_SHAPE_MAP } from './kent-shapes'
import { accessory, Eye, faceExtra, JOY_D, Mouth } from './KentParts'

// Logo Kent: karakter dengan wajah yang "menempel" di bola, jadi lirikan = badan berputar 3D
// (mata di sisi jauh mengecil lalu hilang di balik siluet). Gerak dijalankan rig (kent-rig.ts),
// aksi didefinisikan sebagai data (kent-motion.ts), bentuk di kent-shapes.ts, potongan wajah di KentParts.tsx.
// state: idle, think, happy; fase kerja: research = kaca pembesar, write = pena, done = loncat putar, fail = lesu.
// lively: napas, kedip, aksi iseng acak, reaksi klik. follow: wajah menoleh ke kursor.
// Reduced-motion: rig tidak dijalankan, pose diam tetap terlihat.
export type { KentState }
export type KentScope = 'drawer' | 'page'

/** Event dari luar (mis. KentGrab) ke elemen svg: detail = nama aksi, atau hold:on / hold:off */
export const KENT_ACT_EVENT = 'kt-kent-act'
/** Lama gestur bye sebelum wadahnya ikut menutup */
export const KENT_BYE_MS = 260
const BYE_EVENT = 'kt-kent-bye'
/** Minta Kent di drawer/halaman penuh pamit (dipanggil sebelum menutup) */
export const kentBye = (scope: KentScope) => window.dispatchEvent(new CustomEvent(BYE_EVENT, { detail: scope }))

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
/** Pilih acak, tidak sama dengan yang terakhir (per tab) */
function pickFresh(list: string[], key: string) {
  let prev: string | undefined
  try {
    prev = sessionStorage.getItem(key) ?? undefined
  } catch {}
  const a = pickFrom(list, prev)
  try {
    sessionStorage.setItem(key, a.name)
  } catch {}
  return a
}

export function KentMark({
  size = 24,
  className,
  state = 'idle',
  follow = false,
  lively = false,
  react,
  solo,
  look: lookProp,
  loader = false,
  greet = false,
}: {
  size?: number
  className?: string
  state?: KentState
  /** Wajah menoleh ke kursor */
  follow?: boolean
  /** Hidup sendiri: aksi iseng acak + reaksi klik */
  lively?: boolean
  /** Sapaan saat muncul + pamit lewat kentBye(scope) */
  react?: KentScope
  /** Selektor: bila elemen ini ada (Kent lain yang lebih besar), Kent ini tidak menyapa/pamit */
  solo?: string
  /** Tampilan tetap (pratinjau di studio, tanpa gerak); kosong = pilihan user */
  look?: KentLook
  /** Loop loncat kecil (pengganti titik tiga) */
  loader?: boolean
  /** Menyapa saat tombol/tautan pembungkusnya di-hover */
  greet?: boolean
}) {
  const stored = useKentLook()
  const look = lookProp ?? stored
  const still = !!lookProp
  const g = KENT_SHAPE_MAP[look.shape]
  const id = `k${useId().replace(/[^a-z0-9]/gi, '')}`
  const ref = useRef<SVGSVGElement>(null)
  const rig = useRef<KentRig | null>(null)
  const sig = `${look.shape}|${look.eyes}|${look.mouth}|${look.face}|${look.acc}`
  const saturn = look.shape === 'saturn'
  const first = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (!el || still || reduced()) return
    const r = (rig.current = new KentRig(el, g))
    const on = (e: Event) => {
      const n = (e as CustomEvent<string>).detail
      if (n.startsWith('hold:')) {
        r.hold = n === 'hold:on'
        r.wake()
      } else r.play(n)
    }
    el.addEventListener(KENT_ACT_EVENT, on)
    return () => {
      el.removeEventListener(KENT_ACT_EVENT, on)
      r.destroy()
      rig.current = null
    }
    // rig dibuat sekali; geometri baru lewat setGeo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still])

  useEffect(() => rig.current?.set({ state, lively, follow, loader }), [state, lively, follow, loader])

  // Ganti tampilan: rig membaca ulang elemen, Kent yang hidup ikut "kaget kecil"
  useEffect(() => {
    rig.current?.setGeo(g)
    if (!first.current && lively) rig.current?.play('morph')
    first.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  // Sapaan saat muncul dan pamit saat ditutup (hanya satu Kent per wadah, lihat solo)
  useEffect(() => {
    if (!react) return
    const alone = () => !solo || !document.querySelector(solo)
    const raf = requestAnimationFrame(() => {
      if (alone()) rig.current?.play(pickFresh(INTRO[react], `kt-kent-intro-${react}`))
    })
    const onBye = (e: Event) => {
      if ((e as CustomEvent<KentScope>).detail === react && alone()) rig.current?.play(pickFresh(BYE, 'kt-kent-bye'))
    }
    window.addEventListener(BYE_EVENT, onBye)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener(BYE_EVENT, onBye)
    }
  }, [react, solo])

  useEffect(() => {
    const host = greet ? ref.current?.closest('button, a') : null
    if (!host) return
    const on = () => rig.current?.play('greet')
    host.addEventListener('pointerenter', on)
    return () => host.removeEventListener('pointerenter', on)
  }, [greet])

  const acc = accessory(look.acc, g)
  const extra = faceExtra(look.face)
  const slot = (k: 'hat' | 'fa' | 'neck') => (acc?.[0] === k ? acc[1] : null)
  const f = (k: keyof typeof FEAT) => featT(g, 0, 0, FEAT[k][0], FEAT[k][1])
  const hide: CSSProperties = { opacity: 0 }
  const joyed = state === 'happy' || state === 'done'

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      data-state={state}
      onClick={lively ? () => rig.current?.click() : undefined}
      style={kentVars(look) as CSSProperties}
      className={`kt-kent kt-kent--${state}${lively ? ' kt-kent--lively' : ''}${className ? ` ${className}` : ''}`}
    >
      <g data-k="all">
        <g data-k="body">
          <g transform={`rotate(${g.tilt} 12 13)`}>
            {saturn ? (
              // Separuh belakang cincin (di balik badan)
              <g transform="rotate(-16 12 12.4)">
                <path d="M1.4 12.4a10.6 3.2 0 0 1 21.2 0" className="kt-kent__ring k-sd" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
              </g>
            ) : null}
            <path className="kt-kent__shape k-fb" d={g.d} />
            <clipPath id={id}>
              <path d={g.d} />
            </clipPath>
            <g clipPath={`url(#${id})`}>
              <g data-k="neck" transform={f('neck')}>
                {slot('neck')}
              </g>
              {/* Mulut Classic (bawaan): kotak kecil melayang; mulut lain menggantikannya */}
              <g data-k="dot" transform={f('dot')}>
                {look.mouth === 'dot' ? <rect className="kt-kent__dot k-fm" x="-1.7" y="-1.1" width="3.4" height="2.2" rx="0.7" /> : null}
              </g>
              {extra
                ? ([-1, 1] as const).map((s) => (
                    <g key={s} data-k={s < 0 ? 'xl' : 'xr'} data-lon={extra[0] * s} data-lat={extra[1]} transform={featT(g, 0, 0, extra[0] * s, extra[1])}>
                      {extra[2](s)}
                    </g>
                  ))
                : null}
              {(['el', 'er'] as const).map((k) => (
                <g key={k} data-k={k} className="kt-kent__eye" transform={f(k)}>
                  <g data-k={`${k}n`} style={joyed ? hide : undefined}>
                    <Eye kind={look.eyes} s={k === 'el' ? -1 : 1} />
                  </g>
                  <path data-k={`${k}j`} d={JOY_D} className="k-se" strokeWidth="1.3" strokeLinecap="round" style={joyed ? undefined : hide} />
                </g>
              ))}
              <g data-k="mo" transform={f('mo')}>
                <g data-k="mon">
                  <Mouth kind={look.mouth} />
                </g>
                <ellipse data-k="mog" rx="0.9" ry="1" cy="0.2" className="k-fm" style={hide} />
              </g>
              <g data-k="fa" transform={f('fa')}>
                {slot('fa')}
              </g>
            </g>
            {saturn ? (
              // Separuh depan cincin + bulan kecil yang mengorbit
              <g transform="rotate(-16 12 12.4)">
                <path d="M22.6 12.4a10.6 3.2 0 0 1-21.2 0" className="kt-kent__ring k-sd" strokeWidth="1" strokeLinecap="round" />
                <circle r="0.75" className="kt-kent__moon k-fd">
                  {still ? null : <animateMotion dur="3.2s" repeatCount="indefinite" path="M22.6 12.4a10.6 3.2 0 0 1-21.2 0a10.6 3.2 0 0 1 21.2 0" />}
                </circle>
              </g>
            ) : null}
            <g data-k="hat" transform={hatT(g)}>
              {slot('hat')}
            </g>
          </g>
        </g>
        <g data-k="spark" className="k-sd" strokeWidth="1.3" strokeLinecap="round" style={hide}>
          <path d="M12 0.2v1.6M5.4 2.2l1 1.2M18.6 2.2l-1 1.2" />
        </g>
        <path data-k="heart" className="k-fd" style={hide} d="M19.6 3.2c.5-.9 2.2-.8 2.2.5 0 1.2-1.4 2-2.2 2.6-.8-.6-2.2-1.4-2.2-2.6 0-1.3 1.7-1.4 2.2-.5Z" />
        <path data-k="star" className="k-fd" style={hide} d="M4.4 1.6Q4.7 3.7 6.8 4 4.7 4.3 4.4 6.4 4.1 4.3 2 4 4.1 3.7 4.4 1.6Z" />
        <g data-k="note" style={hide}>
          <path className="k-st" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" d="M4 5.6V2.5l2.2-.6v3.2" />
          <circle className="k-ft" cx="3.3" cy="5.6" r="0.75" />
          <circle className="k-ft" cx="5.5" cy="5.1" r="0.75" />
        </g>
        <g data-k="q" style={hide}>
          <path className="k-st" strokeWidth="1" strokeLinecap="round" d="M18.2 2.3c.2-1.5 2.5-1.5 2.5 0 0 1-1.3 1.2-1.3 2.3" />
          <circle className="k-ft" cx="19.4" cy="6" r="0.55" />
        </g>
        <g data-k="bang" style={hide}>
          <path className="k-st" strokeWidth="1.2" strokeLinecap="round" d="M12-1.8v2.6" />
          <circle className="k-ft" cx="12" cy="2.5" r="0.6" />
        </g>
        <g data-k="lens" className="kt-kent__lens k-st" strokeWidth="1" strokeLinecap="round" style={hide}>
          <circle cx="19.6" cy="16.4" r="2.1" />
          <path d="M21.1 17.9l1.9 1.9" />
        </g>
        <path data-k="pen" className="kt-kent__pen k-st" style={hide} d="M18.6 22.6l3.6-5.2M22.2 17.4l.8-.4-.1.9" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        <path data-k="drop" className="kt-kent__drop k-ft" style={hide} d="M5.2 4.6c.7 1 1.1 1.7 1.1 2.2a1.1 1.1 0 0 1-2.2 0c0-.5.4-1.2 1.1-2.2Z" />
        <path data-k="zz" className="k-st" style={hide} d="M18.4 2.4h2.4l-2.4 2.6h2.4" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

/** Pengganti titik tiga saat Kent berpikir/menulis: Kent loop loncat, melirik, kedip */
export function KentLoader({ size = 22, label, state = 'think' }: { size?: number; label?: string; state?: KentState }) {
  return (
    <span className="kt-kent-loader" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <KentMark size={size} state={state} loader />
    </span>
  )
}

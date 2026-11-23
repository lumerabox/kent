import { ACTS, CHS, E, clear, hopPrim, pickFrom, pickIdle, zero, CLICK, type Act, type Pose } from './kent-motion'
import type { Geo } from './kent-shapes'

// Rig Kent: satu loop requestAnimationFrame untuk semua Kent (ikut refresh rate layar, 60/120 Hz).
// Wajah diproyeksikan dari bola: yaw/pitch memutar "badan", mata di sisi jauh mengecil, menyempit,
// lalu hilang di balik siluet. Target (state, kursor) lewat pegas; aksi ditumpuk aditif dan saling memudar.

const RAD = Math.PI / 180
const { sin, cos, min, max, abs } = Math
const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const n2 = (v: number) => (Math.round(v * 100) / 100).toString()

export type KentState = 'idle' | 'think' | 'happy' | 'research' | 'write' | 'done' | 'fail'

/** Posisi fitur wajah (derajat di bola): bujur, lintang */
export const FEAT = {
  el: [-18.6, 0],
  er: [18.6, 0],
  mo: [0, -24],
  fa: [0, 0],
  dot: [26, -36],
  neck: [0, -52],
} as const
export type FeatKey = keyof typeof FEAT

const raw = (a: number, b: number) => {
  const ca = cos(a)
  const cb = cos(b)
  const z = ca * cb
  const depth = 0.5 + 0.5 * max(0, z)
  return { z, sx: depth * (0.25 + 0.75 * abs(ca)), sy: depth * (0.25 + 0.75 * abs(cb)), rot: -Math.atan2(sin(a) * sin(b), max(0.08, ca)) / RAD }
}
/** Transform satu fitur pada yaw/pitch tertentu, relatif terhadap pose diam */
export function project(g: Geo, yaw: number, pitch: number, lon: number, lat: number) {
  const a = (yaw + lon) * RAD
  const b = (pitch + lat) * RAD
  const now = raw(a, b)
  const rest = raw(lon * RAD, lat * RAD)
  return {
    x: g.cx + g.r * sin(a) * cos(b),
    y: g.cy - g.r * 0.92 * sin(b),
    z: now.z,
    sx: now.sx / rest.sx,
    sy: now.sy / rest.sy,
    rot: now.rot - rest.rot,
  }
}
/** String transform fitur; dipakai render awal (React) dan rig */
export function featT(g: Geo, yaw: number, pitch: number, lon: number, lat: number, mx = 1, my = 1) {
  const p = project(g, yaw, pitch, lon, lat)
  const k = g.r / 8
  return `translate(${n2(p.x)} ${n2(p.y)}) rotate(${n2(p.rot)}) scale(${n2(k * p.sx * mx)} ${n2(max(0.02, k * p.sy * my))})`
}
export const hatT = (g: Geo, yaw = 0, pitch = 0, lag = 0) =>
  `translate(${n2(12 + sin(yaw * RAD) * 2.4)} ${n2(g.top - sin(pitch * RAD) * 1.1)}) rotate(${n2(lag)} 0 3) scale(${n2((g.r / 8) * (0.8 + 0.2 * abs(cos(yaw * RAD))))} ${n2(g.r / 8)})`

type Run = { act: Act; t0: number; out: number }
const SPRUNG = ['yaw', 'pitch', 'joy', 'sx', 'sy', 'wide', 'lens', 'pen', 'bl', 'br'] as const
const FX = { heart: [19.6, 4.3], zz: [19.6, 3.7], note: [4.6, 4.2], q: [19.4, 3.4], bang: [12, 0.6], star: [4.4, 4], spark: [12, 2], drop: [5.2, 6] } as const // prettier-ignore

const rigs = new Set<KentRig>()
let raf = 0
const loop = (now: number) => {
  for (const r of rigs) if (!r.frame(now)) rigs.delete(r)
  raf = rigs.size ? requestAnimationFrame(loop) : 0
}

// Kursor: satu listener untuk semua Kent yang mengikuti
const followers = new Set<KentRig>()
let px = 0
let py = 0
let pin = false
const onMove = (e: PointerEvent) => {
  px = e.clientX
  py = e.clientY
  pin = true
  for (const r of followers) r.aim()
}
const onOut = () => {
  pin = false
  for (const r of followers) r.aim()
}

export class KentRig {
  private el: Record<string, SVGElement | null> = {}
  private memo: Record<string, string> = {}
  private p = zero()
  private q = zero()
  private T = zero()
  private S = zero()
  private V = zero()
  private runs: Run[] = []
  private last = 0
  private t = 0
  private st0 = 0
  private lag = 0
  private lagV = 0
  private prevX = 0
  private prevRot = 0
  private fYaw = 0
  private fPitch = 0
  private aimRaf = 0
  private nextIdle = 0
  private nextBlink = 0
  private lastAct?: string
  private clicks: number[] = []
  private seed = Math.random() * 100
  private dead = false
  state: KentState = 'idle'
  lively = false
  follow = false
  loader = false
  hold = false

  constructor(
    private svg: SVGSVGElement,
    private geo: Geo,
  ) {
    for (const n of svg.querySelectorAll<SVGElement>('[data-k]')) this.el[n.dataset.k as string] = n
    this.nextBlink = performance.now() + 1200 + Math.random() * 3000
    this.nextIdle = performance.now() + 1400
    this.wake()
  }

  setGeo(g: Geo) {
    this.geo = g
    this.el = {}
    for (const n of this.svg.querySelectorAll<SVGElement>('[data-k]')) this.el[n.dataset.k as string] = n
    this.memo = {}
    this.wake()
  }
  set(o: { state: KentState; lively: boolean; follow: boolean; loader: boolean }) {
    if (o.state !== this.state) {
      this.st0 = this.t
      if (o.state === 'done') this.play('done')
      if (o.state === 'happy') this.play('hop')
    }
    if (o.follow !== this.follow) {
      if (o.follow) {
        if (!followers.size) {
          window.addEventListener('pointermove', onMove, { passive: true })
          document.addEventListener('pointerleave', onOut)
        }
        followers.add(this)
      } else this.unfollow()
    }
    Object.assign(this, o)
    this.wake()
  }
  private unfollow() {
    followers.delete(this)
    if (!followers.size) {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onOut)
    }
  }
  destroy() {
    this.dead = true
    this.unfollow()
    cancelAnimationFrame(this.aimRaf)
    rigs.delete(this)
  }
  wake() {
    if (this.dead) return
    rigs.add(this)
    if (!raf) raf = requestAnimationFrame(loop)
  }
  /** Arah pandang ke kursor: seluruh wajah berputar, bukan hanya mata bergeser */
  aim() {
    if (this.aimRaf) return
    this.aimRaf = requestAnimationFrame(() => {
      this.aimRaf = 0
      if (!pin) this.fYaw = this.fPitch = 0
      else {
        const r = this.svg.getBoundingClientRect()
        const dx = px - (r.left + r.width / 2)
        const dy = py - (r.top + r.height / 2)
        const d = Math.hypot(dx, dy) || 1
        const k = min(1, d / 260)
        this.fYaw = (dx / d) * k * 40
        this.fPitch = (-dy / d) * k * 30
      }
      this.wake()
    })
  }
  play(a: Act | string | undefined) {
    const act = typeof a === 'string' ? ACTS[a] : a
    if (!act || this.dead) return
    const now = performance.now()
    for (const r of this.runs) if (!r.out) r.out = now
    this.runs.push({ act, t0: now, out: 0 })
    this.lastAct = act.name
    this.nextIdle = now + act.ms + 1200 + Math.random() * 3300
    this.svg.dataset.act = act.name
    this.wake()
  }
  click() {
    const now = performance.now()
    this.clicks = [...this.clicks.filter((c) => now - c < 2000), now]
    // Diklik bertubi-tubi: pusing
    if (this.clicks.length >= 5) {
      this.clicks = []
      return this.play('dizzy')
    }
    this.play(pickFrom(CLICK, this.lastAct))
  }

  private attr(k: string, name: string, v: string) {
    const e = this.el[k]
    const key = `${k}.${name}`
    if (!e || this.memo[key] === v) return
    this.memo[key] = v
    if (name === 'o') e.style.opacity = v
    else e.setAttribute(name, v)
  }

  frame(now: number): boolean {
    if (this.dead || !this.svg.isConnected) return false
    const dt = min(0.05, this.last ? (now - this.last) / 1000 : 0.016)
    this.last = now
    this.t += dt
    const { p, q, T, S, V, geo: g } = this
    const t = this.t
    const ts = t - this.st0
    clear(p)
    clear(T)

    // Aksi: aditif, yang disela memudar 160 ms
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const r = this.runs[i]
      const u0 = (now - r.t0) / r.act.ms
      const w = r.out ? 1 - E.io(min(1, (now - r.out) / 160)) : 1
      if (w <= 0 || (u0 > 1 && !r.out)) {
        this.runs.splice(i, 1)
        if (!this.runs.length) delete this.svg.dataset.act
        continue
      }
      clear(q)
      for (const [fn, a = 0, b = 0, f = 0, e = 1, hold] of r.act.ls) {
        let u = (u0 - f) / (e - f)
        if (u < 0) continue
        if (u > 1) {
          if (!hold) continue
          u = 1
        }
        fn(q, u, a, b)
      }
      for (const c of CHS) p[c] += q[c] * w
    }
    const busy = this.runs.length > 0

    // State kerja: pose target (lewat pegas) + loop langsung
    const s = this.state
    let live = this.lively || this.loader
    if (s === 'think') {
      T.yaw = 24 * sin(ts * 3.5)
      T.pitch = 10 + 5 * sin(ts * 7)
      p.dot += 0.5 + 0.5 * sin(ts * 5.7)
      live = true
    } else if (s === 'research') {
      T.yaw = 26 * sin(ts * 2.9)
      T.pitch = -10
      T.lens = 1
      live = true
    } else if (s === 'write') {
      T.yaw = 22
      T.pitch = -16 + 3 * sin(ts * 14)
      T.pen = 1
      p.sy -= 0.02 * abs(sin(ts * 7))
      live = true
    } else if (s === 'happy' || s === 'done') T.joy = 1
    else if (s === 'fail') {
      T.sx = 0.04
      T.sy = -0.07
      T.pitch = -18
      p.drop += ((ts / 1.6) % 1) + 0.001
      live = true
    }
    if (this.loader && s !== 'research' && s !== 'write' && s !== 'fail') {
      const ph = (ts % 1.2) / 1.2
      if (ph < 0.6) hopPrim(p, ph / 0.6, 2.4, 0)
    }
    if (this.hold) T.wide = 0.16
    T.yaw += this.fYaw
    T.pitch += this.fPitch
    // Hidup: napas + kepala mengembara pelan, kedip acak, aksi iseng
    if (this.lively && s === 'idle') {
      const k = this.seed
      p.sy += 0.012 * sin(t * 1.7 + k)
      p.sx -= 0.006 * sin(t * 1.7 + k)
      if (!busy) {
        T.yaw += 4 * sin(t * 0.37 + k) + 2.5 * sin(t * 0.83 + k * 2)
        T.pitch += 2.5 * sin(t * 0.53 + k * 3)
      }
      if (!busy && !this.hold && now > this.nextIdle && !document.hidden) this.play(pickIdle(this.lastAct))
    }
    if (now > this.nextBlink) {
      this.nextBlink = now + 1800 + Math.random() * 4200
      if (!busy && s !== 'happy' && s !== 'done') this.runs.push({ act: ACTS[Math.random() < 0.2 ? 'blink2' : 'blink'], t0: now, out: 0 })
    }

    // Pegas target: sedikit overshoot = follow-through
    let moving = false
    for (const c of SPRUNG) {
      const a = 190 * (T[c] - S[c]) - 20 * V[c]
      V[c] += a * dt
      S[c] += V[c] * dt
      if (abs(T[c] - S[c]) > 0.002 || abs(V[c]) > 0.01) moving = true
      p[c] += S[c]
    }
    // Aksesori kepala tertinggal lalu berayun (overlapping action)
    const vx = (p.x - this.prevX) / dt
    const vr = (p.rot + p.roll - this.prevRot) / dt
    this.prevX = p.x
    this.prevRot = p.rot + p.roll
    const lt = max(-22, min(22, -vx * 0.9 - vr * 0.05 - V.yaw * 0.03))
    this.lagV += (130 * (lt - this.lag) - 8 * this.lagV) * dt
    this.lag += this.lagV * dt
    if (abs(this.lag) > 0.05 || abs(this.lagV) > 0.5) moving = true

    this.paint(p, t, g)
    return live || busy || moving || this.runs.length > 0
  }

  private paint(p: Pose, t: number, g: Geo) {
    const yaw = p.yaw
    const pitch = p.pitch
    this.attr('all', 'transform', `translate(${n2(p.x)} ${n2(p.y)}) rotate(${n2(p.rot)} 12 21) rotate(${n2(p.roll)} 12 12.5) translate(12 21) scale(${n2(max(0.01, 1 + p.s))}) translate(-12 -21)`)
    this.attr('all', 'o', n2(c01(1 + p.op)))
    this.attr('body', 'transform', `translate(12 21) scale(${n2(max(0.2, 1 + p.sx))} ${n2(max(0.2, 1 + p.sy))}) translate(-12 -21)`)

    const vis = (lon: number, lat: number) => n2(c01((cos((yaw + lon) * RAD) * cos((pitch + lat) * RAD) + 0.05) / 0.25))
    const joyOn = p.joy > 0.5
    const squeeze = joyOn ? 0.8 + 0.2 * min(1, (p.joy - 0.5) * 4) : 1 - min(p.joy, 0.5) * 1.3
    const w = 1 + p.wide
    for (const [k, bl] of [['el', p.bl], ['er', p.br]] as const) {
      const [lon, lat] = FEAT[k]
      this.attr(k, 'transform', featT(g, yaw, pitch, lon, lat, w, w * (1 - c01(bl) * 0.92) * squeeze))
      this.attr(k, 'o', vis(lon, lat))
      this.attr(`${k}n`, 'o', joyOn ? '0' : '1')
      this.attr(`${k}j`, 'o', joyOn ? '1' : '0')
    }
    // Pipi/alis: posisi dari data-lon/lat di elemennya
    for (const k of ['xl', 'xr']) {
      const e = this.el[k]
      if (!e) continue
      const lon = +(e.dataset.lon ?? 0)
      const lat = +(e.dataset.lat ?? 0)
      this.attr(k, 'transform', featT(g, yaw, pitch, lon, lat))
      this.attr(k, 'o', vis(lon, lat))
    }
    const gp = c01(p.gasp)
    this.attr('mo', 'transform', featT(g, yaw, pitch, FEAT.mo[0], FEAT.mo[1], 1, 1 + p.mouth * 1.4))
    this.attr('mo', 'o', vis(FEAT.mo[0], FEAT.mo[1]))
    this.attr('mon', 'o', n2(1 - c01(gp * 3)))
    this.attr('mog', 'o', n2(c01(gp * 3)))
    this.attr('mog', 'transform', `scale(${n2(0.4 + 0.8 * gp)} ${n2(0.3 + 1.1 * gp)})`)
    this.attr('fa', 'transform', featT(g, yaw, pitch, 0, 0))
    this.attr('fa', 'o', vis(0, 0))
    this.attr('neck', 'transform', featT(g, yaw, pitch, FEAT.neck[0], FEAT.neck[1]))
    this.attr('neck', 'o', vis(FEAT.neck[0], FEAT.neck[1]))
    this.attr('dot', 'transform', featT(g, yaw, pitch, FEAT.dot[0], FEAT.dot[1], 1 + p.dot * 0.45, 1 + p.dot * 0.45))
    this.attr('dot', 'o', vis(FEAT.dot[0], FEAT.dot[1]))
    this.attr('hat', 'transform', hatT(g, yaw, pitch, this.lag))

    // Efek kecil: muncul, melayang naik, hilang
    for (const k of Object.keys(FX) as (keyof typeof FX)[]) {
      const u = c01(p[k])
      if (u <= 0) {
        this.attr(k, 'o', '0')
        continue
      }
      const [cx, cy] = FX[k]
      const o = min(1, u * 6) * min(1, (1 - u) * 2.5)
      const sc = k === 'spark' ? 0.6 + 0.6 * u : 0.5 + 0.5 * E.back(min(1, u * 3))
      const dy = k === 'spark' ? 0 : k === 'drop' ? -1 + 3.4 * u : -3.4 * E.out(u)
      const dx = k === 'note' || k === 'zz' ? sin(u * 7) * 0.9 : 0
      this.attr(k, 'o', n2(o))
      this.attr(k, 'transform', `translate(${n2(cx + dx)} ${n2(cy + dy)}) scale(${n2(sc)}) translate(${-cx} ${-cy})`)
    }
    this.attr('lens', 'o', n2(c01(p.lens)))
    if (p.lens > 0.01) this.attr('lens', 'transform', `translate(${n2(-1.2 - 1.4 * sin(t * 2.9))} ${n2(-0.6 - 0.8 * sin(t * 5.8))})`)
    this.attr('pen', 'o', n2(c01(p.pen)))
    if (p.pen > 0.01) this.attr('pen', 'transform', `translate(${n2(0.6 * sin(t * 9))} 0) rotate(${n2(6 * sin(t * 14))} 18.6 22.6)`)
  }
}

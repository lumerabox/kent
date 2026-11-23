// Gerak Kent sebagai data. Pose = kanal aditif di sekitar 0; aksi = lapisan primitif dengan rentang waktu.
// Primitif memakai prinsip animasi klasik: antisipasi, squash & stretch, busur, follow-through, ease in/out.

export const CHS = [
  'x', 'y', 'rot', 'roll', 's', 'sx', 'sy', 'yaw', 'pitch', 'bl', 'br', 'joy', 'wide', 'mouth', 'gasp', 'op', 'dot',
  'spark', 'heart', 'zz', 'note', 'q', 'bang', 'star', 'drop', 'lens', 'pen',
] as const // prettier-ignore
export type Ch = (typeof CHS)[number]
export type Pose = Record<Ch, number>
export const zero = () => Object.fromEntries(CHS.map((c) => [c, 0])) as Pose
export const clear = (p: Pose) => {
  for (const c of CHS) p[c] = 0
}

const { sin, cos, abs, min, max, exp, floor, PI, random } = Math
const TAU = PI * 2
const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export const E = {
  io: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out: (t: number) => 1 - (1 - t) ** 5,
  in: (t: number) => t * t * t,
  back: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
}
type Ease = (t: number) => number
const seg = (u: number, a: number, b: number) => c01((u - a) / (b - a))
/** Naik (i) → tahan → turun (o) */
const env = (u: number, i = 0.3, o = 0.3, e: Ease = E.io) => (u < i ? e(u / i) : u > 1 - o ? E.io((1 - u) / o) : 1)
/** Keyframe [t, v, t, v, …], ease in-out per segmen */
const kf = (u: number, k: number[]) => {
  if (u <= k[0]) return k[1]
  for (let i = 2; i < k.length; i += 2)
    if (u <= k[i]) return k[i - 1] + (k[i + 1] - k[i - 1]) * E.io((u - k[i - 2]) / (k[i] - k[i - 2]))
  return k[k.length - 1]
}

export type Prim = (p: Pose, u: number, a: number, b: number) => void
/** [primitif, a, b, mulai 0–1, selesai 0–1, tahan nilai akhir] */
export type Layer = [Prim, number?, number?, number?, number?, boolean?]
export type Act = { name: string; ms: number; ls: Layer[]; w: number }

// ---- Badan ----
const hop: Prim = (p, u, a) => {
  const air = seg(u, 0.22, 0.72)
  const m = min(1.25, 0.5 + a / 10)
  p.y -= a * 4 * air * (1 - air)
  p.sy += m * kf(u, [0, 0, 0.16, -0.2, 0.27, 0.2, 0.47, 0.02, 0.68, 0.12, 0.76, -0.22, 0.88, 0.07, 1, 0])
  p.sx += m * kf(u, [0, 0, 0.16, 0.16, 0.27, -0.13, 0.47, 0, 0.68, -0.08, 0.76, 0.18, 0.88, -0.05, 1, 0])
}
const bounce: Prim = (p, u, a, b) => {
  const n = b || 3
  const ph = (u * n) % 1
  const d = (1 - floor(min(u, 0.999) * n) / n) ** 1.6
  const hit = exp(-(min(ph, 1 - ph) ** 2) * 110) * d * c01(u * n * 3)
  p.y -= a * d * 4 * ph * (1 - ph)
  p.sy -= 0.17 * hit
  p.sx += 0.14 * hit
}
const jelly: Prim = (p, u, a) => {
  const v = a * sin(TAU * 3 * u) * exp(-3.2 * u) * (1 - u)
  p.sy += v
  p.sx -= v * 0.8
}
const squash: Prim = (p, u, a) => {
  const e = env(u, 0.25, 0.4, E.back)
  p.sy -= a * e
  p.sx += a * 0.8 * e
}
const stretch: Prim = (p, u, a) => {
  const e = env(u, 0.3, 0.3, E.back)
  p.sy += a * e
  p.sx -= a * 0.55 * e
}
const sway: Prim = (p, u, a, b) => void (p.rot += a * sin(TAU * (b || 1) * u) * env(u, 0.2, 0.2))
const wiggle: Prim = (p, u, a, b) => void (p.rot += a * sin(TAU * (b || 4) * u) * (1 - u))
const tilt: Prim = (p, u, a) => void (p.rot += a * env(u, 0.3, 0.3, E.back))
const shakeX: Prim = (p, u, a, b) => void (p.x += a * sin(TAU * (b || 5) * u) * (1 - u))
const roll: Prim = (p, u, a) => void (p.roll += 360 * a * E.io(u))
const slide: Prim = (p, u, a) => void (p.x += a * env(u, 0.35, 0.35))
const walk: Prim = (p, u, a, b) => {
  const e = env(u, 0.06, 0.06)
  const st = TAU * (b || 8) * u
  p.x += a * sin(TAU * u) * e
  p.yaw += 46 * max(-1, min(1, cos(TAU * u) * 2.4)) * e
  p.y -= 0.7 * abs(sin(st)) * e
  p.rot += 3.5 * sin(st) * e
}
const float: Prim = (p, u, a) => {
  const e = env(u, 0.3, 0.3)
  p.y -= (a + 0.5 * sin(TAU * 3 * u)) * e
  p.sy += 0.04 * e
}
const pop: Prim = (p, u, a) => void (p.s += a * kf(u, [0, 0, 0.3, 1, 0.55, -0.25, 0.78, 0.08, 1, 0]))
const duck: Prim = (p, u, a) => {
  const e = env(u, 0.22, 0.25, E.back)
  p.sy -= 0.52 * a * e
  p.sx += 0.22 * a * e
}
const shiver: Prim = (p, u, a, b) => void (p.x += a * sin(TAU * (b || 16) * u) * env(u, 0.15, 0.3))
const pulse: Prim = (p, u, a, b) => void (p.s += a * exp(-((((u * (b || 2)) % 1) - 0.18) ** 2) * 130))
const lean: Prim = (p, u, a) => {
  const e = env(u, 0.3, 0.3)
  p.rot += a * e
  p.x += a * 0.14 * e
}

// ---- Kepala (rotasi 3D: yaw kiri-kanan, pitch atas-bawah) ----
const turn: Prim = (p, u, a, b) => {
  const e = env(u, 0.28, 0.28, E.back)
  p.yaw += a * e
  p.pitch += b * e
}
const glance: Prim = (p, u, a, b) => {
  const e = env(u, 0.12, 0.16, E.out)
  p.yaw += a * e
  p.pitch += b * e
}
const scan: Prim = (p, u, a, b) => void (p.yaw += a * sin(TAU * (b || 1) * u) * env(u, 0.1, 0.1))
const nod: Prim = (p, u, a, b) => void (p.pitch -= a * sin(TAU * (b || 2) * u) * (1 - u * 0.5))
const no: Prim = (p, u, a, b) => void (p.yaw += a * sin(TAU * (b || 3) * u) * (1 - u * 0.5))
const spin: Prim = (p, u, a) => void (p.yaw += 360 * a * E.io(u))
const orbit: Prim = (p, u, a, b) => {
  const e = env(u, 0.15, 0.2)
  p.yaw += a * sin(TAU * (b || 1) * u) * e
  p.pitch += a * 0.7 * cos(TAU * (b || 1) * u) * e
}
const fig8: Prim = (p, u, a) => {
  const e = env(u, 0.1, 0.12)
  p.yaw += a * sin(TAU * u) * e
  p.pitch += a * 0.55 * sin(TAU * 2 * u) * e
}

// ---- Mata & mulut ----
const blink: Prim = (p, u) => {
  const v = u < 0.4 ? E.out(u / 0.4) : 1 - E.io((u - 0.4) / 0.6)
  p.bl += v
  p.br += v
}
const winkL: Prim = (p, u) => void (p.bl += env(u, 0.22, 0.3, E.out))
const winkR: Prim = (p, u) => void (p.br += env(u, 0.22, 0.3, E.out))
const joy: Prim = (p, u) => void (p.joy += env(u, 0.12, 0.16))
const wide: Prim = (p, u, a) => void (p.wide += a * env(u, 0.15, 0.3, E.back))
const squint: Prim = (p, u, a) => {
  const v = a * env(u, 0.25, 0.25)
  p.bl += v
  p.br += v
}
const doze: Prim = (p, u) => {
  const v = kf(u, [0, 0, 0.22, 0.7, 0.32, 0.4, 0.55, 0.96, 0.9, 0.96, 1, 0])
  p.bl += v
  p.br += v
}
const flutter: Prim = (p, u, _a, b) => {
  const v = abs(sin(PI * (b || 3) * u))
  p.bl += v
  p.br += v
}
const talk: Prim = (p, u, a, b) => void (p.mouth += a * abs(sin(PI * (b || 6) * u)) * env(u, 0.1, 0.1))
const gasp: Prim = (p, u, a) => void (p.gasp += a * env(u, 0.15, 0.3, E.back))
const ping: Prim = (p, u, a) => void (p.dot += a * sin(PI * u) ** 2)
const fx =
  (c: Ch): Prim =>
  (p, u) =>
    void (p[c] += max(u, 0.001))
const [spark, heart, zz, note, q, bang, star, drop] = (['spark', 'heart', 'zz', 'note', 'q', 'bang', 'star', 'drop'] as const).map(fx)

// ---- Masuk & keluar ----
const growIn: Prim = (p, u) => {
  p.s += E.back(u) - 1
  p.op += seg(u, 0, 0.35) - 1
}
const from: Prim = (p, u, a, b) => {
  const k = 1 - E.out(u)
  p.x += a * k
  p.y += b * k
  p.op += seg(u, 0, 0.3) - 1
}
const shrinkOut: Prim = (p, u) => {
  p.s -= 0.9 * E.in(u)
  p.op -= E.in(u)
}
const to: Prim = (p, u, a, b) => {
  const k = E.in(u)
  p.x += a * k
  p.y += b * k
  p.op -= k
}

export const ACTS: Record<string, Act> = {}
/** w = bobot di antrean idle (0 = tidak pernah dipilih saat idle) */
const d = (name: string, ms: number, ls: Layer[], w = 0) => void (ACTS[name] = { name, ms, ls, w })

// Mata
d('blink', 240, [[blink]])
d('blink2', 520, [[blink, 0, 0, 0, 0.45], [blink, 0, 0, 0.55, 1]], 2) // prettier-ignore
d('flutter', 900, [[flutter, 0, 3]], 1)
d('smile', 1500, [[joy], [stretch, 0.04]], 2)
d('squint', 1700, [[squint, 0.6], [turn, 14, -6], [lean, 4]], 1) // prettier-ignore
d('wide', 1100, [[wide, 0.3], [stretch, 0.05]], 1)
// Lirik 8 arah: seluruh wajah berputar, mata di sisi jauh mengecil
for (const [n, y, pt] of [['l', -38, 0], ['r', 38, 0], ['u', 0, 28], ['d', 0, -24], ['ul', -32, 22], ['ur', 32, 22], ['dl', -32, -18], ['dr', 32, -18]] as const) // prettier-ignore
  d(`look-${n}`, 1500, [[turn, y, pt]], 2)
d('look-around', 2800, [[turn, -38, 6, 0, 0.4], [turn, 38, 6, 0.36, 0.78], [turn, 0, 24, 0.72, 1]], 3) // prettier-ignore
d('scan', 2000, [[scan, 36, 1.5]], 2)
d('double-take', 1800, [[turn, 34, 0, 0, 0.42], [glance, 42, 4, 0.5, 1], [wide, 0.3, 0, 0.5, 0.95], [jelly, 0.08, 0, 0.5, 1]], 2) // prettier-ignore
d('owl', 2200, [[spin, 1], [wide, 0.15]], 1)
d('look-behind', 2000, [[turn, 150, 0], [q, 0, 0, 0.25, 0.9]], 1) // prettier-ignore
d('fig8', 2800, [[fig8, 32]], 1)
d('orbit', 2000, [[orbit, 28, 1]], 1)
d('roll-eyes', 1500, [[orbit, 22, 1], [squint, 0.25]], 1) // prettier-ignore
d('nod', 1100, [[nod, 16, 2]], 2)
d('nod-big', 1500, [[nod, 24, 3], [joy, 0, 0, 0.3, 1]], 1) // prettier-ignore
d('nope', 1000, [[no, 30, 3]], 1)
d('think', 2200, [[turn, -24, 20], [tilt, -5], [squint, 0.2]], 2) // prettier-ignore
d('hmm', 2400, [[tilt, -9], [turn, -20, 20], [squint, 0.35], [q, 0, 0, 0.2, 0.9]], 2) // prettier-ignore
// Kiri/kanan
for (const [n, k] of [['l', -1], ['r', 1]] as const) {
  d(`wink-${n}`, 700, [[k < 0 ? winkL : winkR], [tilt, k * 6]], 1)
  d(`tilt-${n}`, 1300, [[tilt, k * 11], [turn, k * 12, 6]], 2) // prettier-ignore
  d(`curious-${n}`, 2000, [[tilt, k * 12], [turn, k * 30, 10], [wide, 0.18], [q, 0, 0, 0.2, 1]], 2) // prettier-ignore
  d(`spin-${n}`, 900, [[spin, k], [stretch, 0.06]], 1) // prettier-ignore
  d(`hop-spin-${n}`, 980, [[hop, 7], [spin, k, 0, 0.2, 0.75]], 1) // prettier-ignore
  d(`flip-${n}`, 1050, [[hop, 8], [roll, k, 0, 0.2, 0.75]], 1) // prettier-ignore
  d(`cartwheel-${n}`, 1300, [[roll, k], [slide, k * 6], [joy, 0, 0, 0.1, 0.9]], 1) // prettier-ignore
  d(`dash-${n}`, 1300, [[slide, k * 8], [lean, k * 8], [glance, k * 44, 0], [stretch, 0.06]], 1) // prettier-ignore
  d(`peek-${n}`, 1500, [[slide, k * 3], [tilt, k * 9], [glance, k * 40, 2]], 2) // prettier-ignore
  d(`shy-${n}`, 2400, [[turn, k * 64, -8, 0, 0.62], [tilt, k * 6], [squash, 0.06], [glance, k * 18, 0, 0.58, 1], [joy, 0, 0, 0.62, 1]], 1) // prettier-ignore
  d(`lean-${n}`, 1600, [[lean, k * 12], [turn, k * 20, -6]], 1) // prettier-ignore
}
// Loncat & pantul
d('hop-s', 620, [[hop, 2.5]], 2)
d('hop', 760, [[hop, 5]], 3)
d('hop-big', 900, [[hop, 8], [joy, 0, 0, 0.2, 0.9]], 1) // prettier-ignore
d('hop-joy', 820, [[hop, 5], [joy, 0, 0, 0.15, 0.95], [spark, 0, 0, 0.3, 1]], 2) // prettier-ignore
d('hop2', 1300, [[hop, 4, 0, 0, 0.5], [hop, 6, 0, 0.5, 1]], 2) // prettier-ignore
d('hop3', 1800, [[hop, 3, 0, 0, 0.3], [hop, 5, 0, 0.3, 0.62], [hop, 8, 0, 0.6, 1], [joy, 0, 0, 0.3, 1]], 1) // prettier-ignore
d('bounce', 1400, [[bounce, 6, 3]], 2)
d('bounce-joy', 1800, [[bounce, 7, 4], [joy]], 1) // prettier-ignore
d('jelly', 1000, [[jelly, 0.22]], 3)
d('jelly-big', 1300, [[jelly, 0.34], [wide, 0.2, 0, 0, 0.5]], 1) // prettier-ignore
d('squish', 700, [[squash, 0.26]], 1)
d('stretch', 1000, [[stretch, 0.22], [turn, 0, 18]], 2) // prettier-ignore
d('stretch-up', 1700, [[stretch, 0.26, 0, 0, 0.72], [squint, 0.9, 0, 0, 0.72], [turn, 0, 22, 0, 0.74], [jelly, 0.1, 0, 0.66, 1]], 2) // prettier-ignore
d('squats', 1800, [[squash, 0.2, 0, 0, 0.34], [squash, 0.2, 0, 0.33, 0.67], [squash, 0.2, 0, 0.66, 1]], 1) // prettier-ignore
d('wiggle', 800, [[wiggle, 10, 4]], 3)
d('wiggle-joy', 1000, [[wiggle, 12, 5], [joy]], 1) // prettier-ignore
d('shimmy', 1100, [[shakeX, 1.6, 6], [wiggle, 5, 6]], 1) // prettier-ignore
d('sway', 2000, [[sway, 8, 1]], 3)
d('sway-joy', 2200, [[sway, 9, 2], [joy, 0, 0, 0.1, 0.9]], 1) // prettier-ignore
d('shake', 620, [[shakeX, 1.6, 5], [no, 18, 5]]) // prettier-ignore
d('shiver', 1100, [[shiver, 0.5, 18], [squint, 0.5], [squash, 0.08]], 1) // prettier-ignore
d('pop', 600, [[pop, 0.18]], 1)
d('heartbeat', 1200, [[pulse, 0.08, 2], [heart]], 1) // prettier-ignore
d('walk', 3400, [[walk, 7, 8]], 3)
d('walk-far', 4200, [[walk, 10, 10]], 1)
d('moonwalk', 2600, [[slide, 6], [turn, -42, 0], [sway, 4, 3]], 1) // prettier-ignore
d('zoomies', 2200, [[shakeX, 7, 3], [no, 44, 3], [bounce, 1.5, 6]], 1) // prettier-ignore
d('float', 2800, [[float, 4], [squint, 0.95, 0, 0.08, 0.92], [sway, 3, 1]], 1) // prettier-ignore
d('levitate-spin', 2400, [[float, 5], [spin, 1, 0, 0.2, 0.8]], 1) // prettier-ignore
d('tumble', 1500, [[roll, 2], [slide, 7]]) // prettier-ignore
// Cerita kecil: Kent sibuk sendiri
d('duck', 1600, [[duck, 1], [turn, 0, 20, 0.2, 0.9]], 1) // prettier-ignore
d('peekaboo', 2100, [[duck, 1, 0, 0, 0.55], [squint, 0.95, 0, 0, 0.5], [hop, 5, 0, 0.5, 1], [joy, 0, 0, 0.55, 1], [spark, 0, 0, 0.55, 1]], 2) // prettier-ignore
d('bow', 1300, [[turn, 0, -36], [squash, 0.1], [squint, 0.9, 0, 0.15, 0.85]], 1) // prettier-ignore
d('proud', 1800, [[stretch, 0.1], [turn, 0, 16], [joy], [ping, 1, 0, 0.3, 0.75]], 1) // prettier-ignore
d('card', 1200, [[turn, 24, -24], [ping, 1, 0, 0.25, 0.8]], 2) // prettier-ignore
d('sleepy', 3400, [[doze], [squash, 0.06], [turn, 0, -12], [zz, 0, 0, 0.3, 0.95]], 1) // prettier-ignore
d('nap', 4800, [[squint, 0.96, 0, 0.04, 0.74], [turn, 0, -16, 0, 0.75], [squash, 0.07, 0, 0, 0.75], [zz, 0, 0, 0.14, 0.44], [zz, 0, 0, 0.42, 0.72], [hop, 3, 0, 0.74, 0.9], [wide, 0.3, 0, 0.74, 1], [bang, 0, 0, 0.74, 1]], 1) // prettier-ignore
d('yawn', 2100, [[gasp, 1, 0, 0.1, 0.78], [squint, 0.9, 0, 0.1, 0.8], [stretch, 0.1, 0, 0.1, 0.8], [turn, 0, 14, 0.1, 0.8]], 2) // prettier-ignore
d('sneeze', 1900, [[turn, 0, 24, 0, 0.6], [stretch, 0.12, 0, 0, 0.6], [squint, 0.7, 0, 0.2, 0.62], [squash, 0.25, 0, 0.6, 0.86], [glance, 0, -28, 0.6, 0.9], [squint, 1, 0, 0.6, 0.85], [spark, 0, 0, 0.62, 1], [jelly, 0.12, 0, 0.8, 1]], 1) // prettier-ignore
d('hiccup', 1500, [[hop, 1.6, 0, 0, 0.3], [wide, 0.25, 0, 0, 0.3], [hop, 1.6, 0, 0.5, 0.8], [wide, 0.25, 0, 0.5, 0.8]], 1) // prettier-ignore
d('dance', 3200, [[sway, 9, 4], [bounce, 2.4, 8], [joy, 0, 0, 0.05, 0.95], [scan, 18, 2], [note, 0, 0, 0, 0.5], [note, 0, 0, 0.5, 1]], 2) // prettier-ignore
d('disco', 3000, [[scan, 40, 3], [bounce, 3, 6], [star, 0, 0, 0.1, 0.6], [spark, 0, 0, 0.5, 1]], 1) // prettier-ignore
d('whistle', 2400, [[sway, 5, 2], [turn, 24, 10], [gasp, 0.5], [note, 0, 0, 0.1, 0.55], [note, 0, 0, 0.5, 0.95]], 2) // prettier-ignore
d('sing', 2600, [[talk, 1, 8], [sway, 6, 2], [squint, 0.9, 0, 0.1, 0.9], [note, 0, 0, 0.2, 0.7]], 1) // prettier-ignore
d('idea', 1600, [[turn, 0, 22, 0, 0.5], [bang, 0, 0, 0.15, 0.8], [hop, 5, 0, 0.35, 1], [wide, 0.25, 0, 0.15, 0.6], [joy, 0, 0, 0.55, 1]], 2) // prettier-ignore
d('chase', 4200, [[bang, 0, 0, 0, 0.2], [wide, 0.3, 0, 0, 0.2], [turn, -42, 0, 0, 0.56], [slide, -7, 0, 0.2, 0.82], [bounce, 2, 3, 0.24, 0.5], [scan, 30, 1, 0.55, 0.82], [q, 0, 0, 0.55, 0.82]], 2) // prettier-ignore
d('butterfly', 3200, [[fig8, 34], [wide, 0.15], [joy, 0, 0, 0.8, 1]], 2) // prettier-ignore
d('tap', 1600, [[bounce, 1, 5], [turn, 26, 10], [squint, 0.3]], 1) // prettier-ignore
d('giggle', 1200, [[joy], [bounce, 1.2, 6]], 2) // prettier-ignore
d('grumpy', 1700, [[squint, 0.5], [turn, 0, -10], [squash, 0.08], [shakeX, 0.6, 6]], 1) // prettier-ignore
d('sparkle', 1200, [[star], [wide, 0.2], [pop, 0.08]], 1) // prettier-ignore
d('kiss', 1300, [[winkR, 0, 0, 0.1, 0.8], [gasp, 0.4], [heart], [lean, 6]], 1) // prettier-ignore
d('drumroll', 1600, [[shiver, 0.4, 20, 0, 0.6], [squash, 0.1, 0, 0, 0.62], [pop, 0.2, 0, 0.6, 1], [joy, 0, 0, 0.6, 1], [spark, 0, 0, 0.6, 1]], 1) // prettier-ignore
d('cheer', 1500, [[hop, 6, 0, 0, 0.5], [hop, 6, 0, 0.5, 1], [joy], [spark, 0, 0, 0.1, 0.5], [star, 0, 0, 0.5, 0.95]], 1) // prettier-ignore
d('oops', 1700, [[turn, 0, -22], [squash, 0.1], [drop, 0, 0, 0.2, 0.9]], 1) // prettier-ignore
// Reaksi klik & khusus
d('jump', 860, [[hop, 8], [joy, 0, 0, 0.15, 0.9], [spark, 0, 0, 0.25, 0.9]]) // prettier-ignore
d('surprised', 1100, [[wide, 0.35], [gasp, 1], [hop, 2.5, 0, 0, 0.5], [spark]]) // prettier-ignore
d('startle', 1000, [[hop, 3, 0, 0, 0.6], [wide, 0.35], [bang]]) // prettier-ignore
d('love', 1500, [[joy], [sway, 7, 1.5], [heart], [pulse, 0.06, 2]]) // prettier-ignore
d('dizzy', 2000, [[orbit, 30, 3], [sway, 9, 2], [squint, 0.3], [star, 0, 0, 0.1, 0.9]]) // prettier-ignore
d('greet', 900, [[hop, 2.5, 0, 0, 0.55], [wiggle, 9, 3, 0.4, 1], [blink, 0, 0, 0.15, 0.45], [ping, 1, 0, 0, 0.6]]) // prettier-ignore
d('wave', 1100, [[sway, 11, 2.5], [joy]]) // prettier-ignore
d('done', 1100, [[hop, 7, 0, 0, 0.75], [spin, 1, 0, 0.15, 0.6], [spark, 0, 0, 0.3, 1]]) // prettier-ignore
d('morph', 620, [[jelly, 0.2], [blink, 0, 0, 0, 0.5]]) // prettier-ignore
// Sapaan drawer
d('hi-wave', 1400, [[growIn, 0, 0, 0, 0.4], [sway, 12, 2.5, 0.34, 1], [joy, 0, 0, 0.34, 0.98]]) // prettier-ignore
d('hi-excited', 1500, [[growIn, 0, 0, 0, 0.3], [hop, 7, 0, 0.26, 0.64], [hop, 4, 0, 0.62, 1], [joy, 0, 0, 0.3, 0.95], [spark, 0, 0, 0.4, 0.9]]) // prettier-ignore
d('hi-wink', 1400, [[growIn, 0, 0, 0, 0.4], [tilt, 9, 0, 0.36, 1], [winkR, 0, 0, 0.4, 0.9], [heart, 0, 0, 0.38, 1]]) // prettier-ignore
d('hi-peekaboo', 1400, [[from, 0, 14, 0, 0.36], [duck, 0.8, 0, 0, 0.5], [wide, 0.3, 0, 0.36, 0.8], [jelly, 0.14, 0, 0.42, 1], [spark, 0, 0, 0.45, 0.95]]) // prettier-ignore
d('hi-spin', 1300, [[growIn, 0, 0, 0, 0.45], [spin, 2, 0, 0, 0.62], [hop, 3, 0, 0.6, 1], [joy, 0, 0, 0.5, 0.98]]) // prettier-ignore
d('hi-drop', 1400, [[from, 0, -26, 0, 0.3], [bounce, 5, 3, 0.26, 1], [wide, 0.2, 0, 0, 0.4], [joy, 0, 0, 0.5, 1]]) // prettier-ignore
d('hi-look', 1700, [[growIn, 0, 0, 0, 0.32], [turn, -36, 6, 0.26, 0.62], [turn, 36, 6, 0.56, 0.92], [joy, 0, 0, 0.84, 1]]) // prettier-ignore
d('hi-roll', 1400, [[from, 22, 0, 0, 0.5], [roll, -1, 0, 0, 0.52], [jelly, 0.14, 0, 0.5, 1], [joy, 0, 0, 0.55, 1]]) // prettier-ignore
// Sapaan halaman penuh
d('big-stretch', 1400, [[growIn, 0, 0, 0, 0.3], [stretch, 0.34, 0, 0.1, 0.62], [jelly, 0.2, 0, 0.55, 1], [wide, 0.25, 0, 0.15, 0.85], [spark, 0, 0, 0.4, 0.95]]) // prettier-ignore
d('big-zoom', 1500, [[growIn, 0, 0, 0, 0.4], [pop, 0.3, 0, 0.1, 0.7], [turn, -30, 8, 0.45, 1]]) // prettier-ignore
d('big-fly', 1400, [[from, -40, -12, 0, 0.5], [lean, 14, 0, 0, 0.5], [jelly, 0.2, 0, 0.46, 1], [joy, 0, 0, 0.5, 1]]) // prettier-ignore
d('big-rocket', 1400, [[from, 0, 34, 0, 0.36], [stretch, 0.3, 0, 0, 0.4], [hop, 6, 0, 0.3, 0.8], [spark, 0, 0, 0.4, 0.95]]) // prettier-ignore
d('big-tumble', 1500, [[from, 40, 0, 0, 0.52], [roll, -2, 0, 0, 0.54], [hop, 3, 0, 0.56, 0.9], [joy, 0, 0, 0.6, 1]]) // prettier-ignore
d('big-spin', 1500, [[growIn, 0, 0, 0, 0.4], [spin, 3, 0, 0, 0.7], [jelly, 0.14, 0, 0.66, 1], [star, 0, 0, 0.5, 1]]) // prettier-ignore
d('big-drop', 1500, [[from, 0, -40, 0, 0.3], [bounce, 7, 3, 0.26, 1], [joy, 0, 0, 0.5, 1]]) // prettier-ignore
// Pamit: gestur singkat lalu mengecil dan bertahan (wadah menutup pada KENT_BYE_MS)
d('bye-wave', 1500, [[sway, 12, 1.5, 0, 0.2], [joy, 0, 0, 0, 0.4], [shrinkOut, 0, 0, 0.13, 0.31, true]]) // prettier-ignore
d('bye-hop', 1500, [[hop, 6, 0, 0, 0.3], [joy, 0, 0, 0, 0.4], [shrinkOut, 0, 0, 0.12, 0.3, true]]) // prettier-ignore
d('bye-wink', 1500, [[winkR, 0, 0, 0, 0.2], [tilt, 8, 0, 0, 0.22], [heart, 0, 0, 0, 0.3], [shrinkOut, 0, 0, 0.13, 0.31, true]]) // prettier-ignore
d('bye-spin', 1500, [[spin, 2, 0, 0, 0.3], [shrinkOut, 0, 0, 0.08, 0.3, true]]) // prettier-ignore
d('bye-fly', 1500, [[stretch, 0.2, 0, 0, 0.2], [to, 0, -30, 0.08, 0.3, true]]) // prettier-ignore
d('bye-sink', 1500, [[squint, 0.9, 0, 0, 0.3], [to, 0, 12, 0.06, 0.3, true]]) // prettier-ignore

const names = (re: RegExp) => Object.keys(ACTS).filter((n) => re.test(n))
export const INTRO = { drawer: names(/^hi-/), page: names(/^big-/) }
export const BYE = names(/^bye-/)
export const CLICK = ['jump', 'spin-l', 'spin-r', 'squish', 'surprised', 'wink-r', 'shake', 'card', 'love', 'hop-spin-r', 'flip-l', 'jelly-big', 'giggle', 'cheer', 'kiss', 'startle', 'pop', 'cartwheel-r', 'drumroll', 'sparkle', 'peekaboo', 'wave'] // prettier-ignore
const IDLE = Object.values(ACTS).filter((a) => a.w > 0)

const rnd = (a: number, b: number) => a + random() * (b - a)
const any = <T>(l: T[]) => l[floor(random() * l.length)]
const side = () => (random() < 0.5 ? -1 : 1)
/** Aksi rakitan acak: badan × kepala × mata × efek, jadi jarang ada dua gerakan yang persis sama */
function improv(): Act {
  const body: (() => Layer | null)[] = [
    () => [hop, rnd(2, 7)],
    () => [bounce, rnd(2, 6), any([2, 3, 4])],
    () => [jelly, rnd(0.12, 0.3)],
    () => [sway, rnd(5, 10), any([1, 2])],
    () => [wiggle, rnd(6, 12), any([3, 4, 5])],
    () => [tilt, side() * rnd(6, 12)],
    () => [stretch, rnd(0.08, 0.22)],
    () => [squash, rnd(0.08, 0.22)],
    () => [float, rnd(2, 4)],
    () => [lean, side() * rnd(6, 12)],
    () => null,
  ]
  const head: (() => Layer | null)[] = [
    () => [turn, side() * rnd(16, 42), rnd(-20, 24)],
    () => [glance, side() * rnd(20, 44), rnd(-10, 14), 0.1, 0.8],
    () => [scan, rnd(18, 38), any([1, 1.5, 2])],
    () => [nod, rnd(10, 22), any([2, 3])],
    () => [no, rnd(16, 30), any([2, 3])],
    () => [orbit, rnd(16, 28), 1],
    () => [spin, side(), 0, 0.15, 0.75],
    () => null,
  ]
  const eyes: (() => Layer | null)[] = [
    () => [joy, 0, 0, 0.1, 0.95],
    () => [wide, rnd(0.15, 0.3)],
    () => [random() < 0.5 ? winkL : winkR, 0, 0, 0.2, 0.7],
    () => [squint, rnd(0.3, 0.6)],
    () => [blink, 0, 0, 0.3, 0.5],
    () => null,
    () => null,
  ]
  const f = random() < 0.3 ? ([any([spark, heart, note, q, bang, star]), 0, 0, 0.2, 0.95] as Layer) : null
  const ls = [any(body)(), any(head)(), any(eyes)(), f].filter((l): l is Layer => !!l)
  return { name: 'improv', ms: rnd(1000, 2200), ls: ls.length ? ls : [[blink]], w: 0 }
}

export function pickIdle(not?: string): Act {
  if (random() < 0.3) return improv()
  const pool = IDLE.filter((a) => a.name !== not)
  let r = random() * pool.reduce((n, a) => n + a.w, 0)
  for (const a of pool) if ((r -= a.w) <= 0) return a
  return pool[0]
}
export const pickFrom = (list: string[], not?: string) => ACTS[any(list.filter((n) => n !== not))] ?? ACTS[list[0]]
export const hopPrim = hop

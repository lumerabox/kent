// Bentuk badan Kent (viewBox 24). Tiap bentuk membawa geometri wajah untuk rig 3D:
// cx/cy = pusat wajah, r = jari-jari bola tempat mata "menempel", top = puncak badan (jangkar topi).

export type Geo = { d: string; top: number; cx: number; cy: number; r: number; tilt: number }

const TAU = Math.PI * 2
const f = (n: number) => +n.toFixed(2)
type Pt = [number, number]

/** Poligon bersudut bulat; t = porsi sisi yang dibulatkan (0,5 = kurva halus penuh) */
function poly(v: Pt[], t = 0.3) {
  const n = v.length
  let d = ''
  for (let i = 0; i < n; i++) {
    const p = v[(i + n - 1) % n]
    const c = v[i]
    const q = v[(i + 1) % n]
    d += `${i ? 'L' : 'M'}${f(c[0] + (p[0] - c[0]) * t)} ${f(c[1] + (p[1] - c[1]) * t)}Q${f(c[0])} ${f(c[1])} ${f(c[0] + (q[0] - c[0]) * t)} ${f(c[1] + (q[1] - c[1]) * t)}`
  }
  return `${d}Z`
}
/** Kurva polar r(θ), θ = 0 di atas, searah jarum jam */
function polar(r: (t: number) => number, cy = 12.4, n = 48) {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU
    pts.push([12 + r(t) * Math.sin(t), cy - r(t) * Math.cos(t)])
  }
  return poly(pts, 0.5)
}
const superE = (n: number, a: number, b: number) => (t: number) =>
  (Math.abs(Math.sin(t) / a) ** n + Math.abs(Math.cos(t) / b) ** n) ** (-1 / n)
/** Poligon beraturan n sisi; rot = putaran awal (rad) */
const ngon = (n: number, R: number, cy: number, rot = 0, inner = 0): Pt[] =>
  Array.from({ length: inner ? n * 2 : n }, (_, i) => {
    const t = rot + (i / (inner ? n * 2 : n)) * TAU
    const r = inner && i % 2 ? inner : R
    return [12 + r * Math.sin(t), cy - r * Math.cos(t)] as Pt
  })
const circle = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${f(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${f(rx * 2)} 0a${rx} ${ry} 0 1 0 ${f(-rx * 2)} 0Z`

const g = (d: string, top: number, cy: number, r: number, tilt = 0): Geo => ({ d, top, cx: 12, cy, r, tilt })

export const KENT_SHAPE_MAP = {
  gumdrop: g(
    'M12 3.2c5 0 8.6 5.4 9.3 12.1.3 2.7-1.1 4.6-3.8 5-1.8.3-3.6.4-5.5.4s-3.7-.1-5.5-.4c-2.7-.4-4.1-2.3-3.8-5C3.4 8.6 7 3.2 12 3.2Z',
    3.2,
    12,
    8,
    -6,
  ),
  ball: g(polar(() => 8.8), 3.6, 12.2, 8.2),
  tile: g(polar(superE(4, 8.7, 8.7)), 3.8, 12.2, 8, -4),
  tv: g(polar(superE(7, 9.3, 7.6)), 4.8, 12.2, 8.4),
  lemon: g(polar(superE(1.55, 9.8, 7.8)), 4.8, 12.2, 7.2),
  capsule: g(polar(superE(2.7, 6.8, 9)), 3.4, 12, 6.2, 5),
  egg: g('M12 2.8c4.4 0 8 5.6 8 10.6 0 4.6-3.4 7.8-8 7.8s-8-3.2-8-7.8c0-5 3.6-10.6 8-10.6Z', 2.8, 13, 7.4),
  drop: g('M12 2.6c3.4 3.6 8 8 8 12.2a8 6.6 0 0 1-16 0c0-4.2 4.6-8.6 8-12.2Z', 2.8, 14, 7.2),
  pebble: g(polar((t) => 8.4 * (1 + 0.07 * Math.cos(2 * t + 0.7) + 0.05 * Math.cos(3 * t - 1.1))), 3.8, 12.4, 7.6),
  peanut: g(polar((t) => 7.9 * (1 + 0.11 * Math.cos(2 * t))), 3.7, 12.2, 6.6),
  cookie: g(polar((t) => 8.5 * (1 + 0.045 * Math.cos(8 * t)), 12.4, 64), 3.6, 12.2, 7.8),
  flower: g(polar((t) => 8.1 * (1 + 0.12 * Math.cos(6 * t)), 12.4, 60), 3.4, 12.2, 7.2),
  fuzzy: g(polar((t) => 8.4 * (1 + 0.06 * Math.cos(14 * t)), 12.4, 112), 3.6, 12.2, 7.6),
  star: g(poly(ngon(5, 10, 12.9, 0, 6), 0.36), 4.2, 13, 6.2),
  hex: g(poly(ngon(6, 9.4, 12.3, Math.PI / 6), 0.28), 4.3, 12.2, 7.8),
  octo: g(poly(ngon(8, 9.3, 12.3, Math.PI / 8), 0.3), 3.9, 12.2, 8),
  gem: g(
    poly(
      [
        [12, 3],
        [21.6, 12],
        [12, 21],
        [2.4, 12],
      ],
      0.3,
    ),
    4.6,
    12,
    6.6,
  ),
  onigiri: g(
    'M12 3.2c1.5 0 2.6.8 3.5 2.3l5.2 9.3c1.5 2.8-.2 5.8-3.6 5.8H6.9c-3.4 0-5.1-3-3.6-5.8l5.2-9.3c.9-1.5 2-2.3 3.5-2.3Z',
    3.2,
    14.2,
    7,
  ),
  house: g(
    poly(
      [
        [12, 2.6],
        [20.8, 9.6],
        [19.4, 20.8],
        [4.6, 20.8],
        [3.2, 9.6],
      ],
      0.3,
    ),
    4.2,
    13.6,
    7.4,
  ),
  shield: g(
    poly(
      [
        [3.8, 4],
        [20.2, 4],
        [20.6, 12.8],
        [12, 22],
        [3.4, 12.8],
      ],
      0.32,
    ),
    4,
    11.2,
    7.6,
  ),
  pot: g(
    poly(
      [
        [3.2, 4.8],
        [20.8, 4.8],
        [18.4, 20.6],
        [5.6, 20.6],
      ],
      0.3,
    ),
    4.8,
    11.8,
    7.6,
  ),
  ghost: g('M3.8 11.4A8.2 8.4 0 0 1 20.2 11.4V19.6q-1.37 2.6-2.73 0t-2.73 0-2.74 0-2.73 0-2.73 0-2.74 0Z', 3, 11.6, 7.6),
  cat: g(
    'M5 9.2 5.4 3.6Q5.5 2.6 6.4 3.2L10 5.6Q12 5.1 14 5.6L17.6 3.2Q18.5 2.6 18.6 3.6L19 9.2Q20.4 11.4 20.4 13.6C20.4 18.4 16.8 21 12 21S3.6 18.4 3.6 13.6Q3.6 11.4 5 9.2Z',
    5.4,
    13.4,
    7.8,
  ),
  bear: g(`${circle(12, 13, 8.4, 8)}${circle(5.6, 5.8, 2.8)}${circle(18.4, 5.8, 2.8)}`, 5, 13.2, 7.8),
  bunny: g(`${circle(12, 14.2, 7.8, 6.9)}${circle(8.4, 5.8, 1.9, 4.4)}${circle(15.6, 5.8, 1.9, 4.4)}`, 7.3, 14.4, 7.2),
  cloud: g(`${circle(12, 14.6, 9.2, 5.9)}${circle(8, 10.2, 4.6)}${circle(14.4, 9, 5.4)}`, 4.2, 13.6, 8),
  bubble: g(
    'M7.6 3.6h8.8A4.6 4.6 0 0 1 21 8.2v6.4a4.6 4.6 0 0 1-4.6 4.6h-5.2l-3.9 2.7c-.6.4-1.3-.1-1.2-.8l.3-2.2A4.6 4.6 0 0 1 3 14.6V8.2a4.6 4.6 0 0 1 4.6-4.6Z',
    3.6,
    11.4,
    8.4,
  ),
  candle: g(
    'M8.6 5h6.8A3.6 3.6 0 0 1 19 8.6v7.3a3.6 3.6 0 0 1-3.6 3.6H8.6A3.6 3.6 0 0 1 5 15.9V8.6A3.6 3.6 0 0 1 8.6 5ZM11.2 1.8a.8.8 0 0 1 1.6 0V5.4h-1.6ZM11.2 19.2h1.6v3a.8.8 0 0 1-1.6 0Z',
    5,
    12.2,
    6.4,
  ),
  heart: g(
    'M12 20.8C5.4 16.4 2.8 12.6 2.8 8.9 2.8 5.9 5 3.6 7.8 3.6c1.7 0 3.2.8 4.2 2.2 1-1.4 2.5-2.2 4.2-2.2 2.8 0 5 2.3 5 5.3 0 3.7-2.6 7.5-9.2 11.9Z',
    5.8,
    10.6,
    7,
  ),
  mushroom: g(
    'M12 3c5.4 0 9.4 3.4 9.4 7.6 0 1.5-1 2.4-2.6 2.4h-1.3v4.6c0 2-1.5 3.4-3.5 3.4h-4c-2 0-3.5-1.4-3.5-3.4V13H5.2c-1.6 0-2.6-.9-2.6-2.4C2.6 6.4 6.6 3 12 3Z',
    3,
    8.8,
    8,
  ),
  // 19 Nov: bentuk tambahan; Saturnus menggambar cincin berputar di KentMark
  saturn: g(polar(() => 7.2, 12.4), 5.2, 12.4, 6.8),
  sun: g(polar((t) => 8.2 * (1 + 0.09 * Math.cos(12 * t)), 12.4, 96), 3.6, 12.3, 7.2),
  blob: g(polar((t) => 8.4 * (1 + 0.1 * Math.cos(3 * t + 0.4) + 0.05 * Math.sin(5 * t))), 3.6, 12.4, 7.4),
  bean: g(polar(superE(2.2, 9.6, 7)), 5.4, 12.6, 7),
  diamond: g(poly(ngon(4, 10, 12.4, 0), 0.4), 3.4, 12.4, 6.8),
  leaf: g('M12 2.6C17.6 5.4 20.6 10 20 15.2 19.6 19 16.2 21.2 12 21.2S4.4 19 4 15.2C3.4 10 6.4 5.4 12 2.6Z', 3, 13.4, 7.2),
  acorn: g('M4 9.6C4 6 7.6 3.4 12 3.4S20 6 20 9.6v.8H18.6c.4 1.2.6 2.6.6 4 0 4-3.2 6.8-7.2 6.8S4.8 18.4 4.8 14.4c0-1.4.2-2.8.6-4H4Z', 3.4, 14, 6.8),
  pumpkin: g(polar((t) => 8.6 * (1 + 0.07 * Math.abs(Math.cos(2.5 * t))), 12.6, 80), 4, 12.6, 7.6),
  robot: g(poly(ngon(4, 11.6, 12.6, Math.PI / 4), 0.16), 4.4, 12.6, 7.8),
  ufo: g(`${circle(12, 14.6, 10.2, 4.4)}${circle(12, 10.6, 6.4, 6)}`, 4.6, 11.8, 6),
} satisfies Record<string, Geo>

export type KentShape = keyof typeof KENT_SHAPE_MAP

export const KENT_SHAPES: { value: KentShape; label: string }[] = [
  { value: 'gumdrop', label: 'Classic' },
  { value: 'ball', label: 'Ball' },
  { value: 'tile', label: 'Tile' },
  { value: 'egg', label: 'Egg' },
  { value: 'drop', label: 'Drop' },
  { value: 'pebble', label: 'Pebble' },
  { value: 'peanut', label: 'Peanut' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'tv', label: 'Screen' },
  { value: 'lemon', label: 'Lemon' },
  { value: 'cookie', label: 'Cookie' },
  { value: 'flower', label: 'Flower' },
  { value: 'fuzzy', label: 'Fuzzy' },
  { value: 'star', label: 'Star' },
  { value: 'hex', label: 'Hex' },
  { value: 'octo', label: 'Octo' },
  { value: 'gem', label: 'Gem' },
  { value: 'onigiri', label: 'Onigiri' },
  { value: 'house', label: 'House' },
  { value: 'shield', label: 'Shield' },
  { value: 'pot', label: 'Pot' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'cat', label: 'Cat' },
  { value: 'bear', label: 'Bear' },
  { value: 'bunny', label: 'Bunny' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'bubble', label: 'Bubble' },
  { value: 'candle', label: 'Candle' },
  { value: 'heart', label: 'Heart' },
  { value: 'mushroom', label: 'Mushroom' },
  { value: 'saturn', label: 'Saturn' },
  { value: 'sun', label: 'Sun' },
  { value: 'blob', label: 'Blob' },
  { value: 'bean', label: 'Bean' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'acorn', label: 'Acorn' },
  { value: 'pumpkin', label: 'Pumpkin' },
  { value: 'robot', label: 'Robot' },
  { value: 'ufo', label: 'UFO' },
]

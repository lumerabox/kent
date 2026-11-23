'use client'

import { useSyncExternalStore } from 'react'

import { KENT_SHAPES, type KentShape } from './kent-shapes'

// Tampilan Kent (warna badan, warna detail, bentuk, mata, mulut, wajah, aksesori), per browser lewat localStorage.
// Semua KentMark membaca store ini, jadi perubahan di studio langsung terlihat di mana-mana.

export type { KentShape }
export type KentEyes = (typeof KENT_EYES)[number]['value']
export type KentAcc = (typeof KENT_ACCS)[number]['value']
export type KentMouth = (typeof KENT_MOUTHS)[number]['value']
export type KentFace = (typeof KENT_FACES)[number]['value']
export type KentLook = {
  body: string
  detail: string
  shape: KentShape
  eyes: KentEyes
  mouth: KentMouth
  /** Warna mulut (19 Nov); bawaan biru seperti mulut Classic */
  mouthColor: string
  face: KentFace
  acc: KentAcc
}

export const KENT_DEFAULT: KentLook = {
  body: '#0B0B0C',
  detail: '#2F7BFF',
  shape: 'gumdrop',
  eyes: 'pill',
  mouth: 'dot',
  mouthColor: '#2F7BFF',
  face: 'none',
  acc: 'none',
}

export const KENT_BODIES = [
  { value: '#0B0B0C', label: 'Ink' },
  { value: '#0156FC', label: 'Blue' },
  { value: '#475569', label: 'Slate' },
  { value: '#0D9488', label: 'Teal' },
  { value: '#15803D', label: 'Green' },
  { value: '#6E56CF', label: 'Purple' },
  { value: '#D6336C', label: 'Pink' },
  { value: '#E5484D', label: 'Red' },
  { value: '#EA580C', label: 'Orange' },
  { value: '#7C4A2D', label: 'Cocoa' },
  { value: '#1E3A8A', label: 'Navy' },
  { value: '#0EA5E9', label: 'Sky' },
  { value: '#34D399', label: 'Mint' },
  { value: '#A78BFA', label: 'Lavender' },
  { value: '#FB7185', label: 'Coral' },
  { value: '#E2E8F0', label: 'Cloud' },
]
export const KENT_DETAILS = [
  { value: '#2F7BFF', label: 'Blue' },
  { value: '#FFFFFF', label: 'White' },
  { value: '#84CC16', label: 'Lime' },
  { value: '#22D3EE', label: 'Cyan' },
  { value: '#F472B6', label: 'Pink' },
  { value: '#FB923C', label: 'Orange' },
  { value: '#A78BFA', label: 'Lilac' },
  { value: '#F43F5E', label: 'Rose' },
]
const opt = <T extends string>(...v: [T, string][]) => v.map(([value, label]) => ({ value, label }))
export const KENT_EYES = opt(
  ['pill', 'Classic'],
  ['dot', 'Dot'],
  ['wide', 'Wide'],
  ['smile', 'Smile'],
  ['oval', 'Oval'],
  ['sparkle', 'Sparkle'],
  ['sleepy', 'Sleepy'],
  ['square', 'Square'],
  ['dash', 'Dash'],
  ['ring', 'Ring'],
  ['odd', 'Odd'],
  ['lash', 'Lash'],
  ['bold', 'Bold'],
  ['heart', 'Heart'],
  ['star', 'Star'],
  ['cross', 'Cross'],
  ['button', 'Button'],
  ['wink', 'Wink'],
  ['happy', 'Happy'],
  ['spiral', 'Spiral'],
  ['moon', 'Moon'],
  ['diamond', 'Diamond'],
  ['tall', 'Tall'],
  ['visor', 'Visor'],
)
export const KENT_MOUTH_COLORS = [
  { value: '#2F7BFF', label: 'Blue' },
  { value: '#FFFFFF', label: 'White' },
  { value: '#F43F5E', label: 'Rose' },
  { value: '#F472B6', label: 'Pink' },
  { value: '#FB923C', label: 'Orange' },
  { value: '#FACC15', label: 'Yellow' },
  { value: '#84CC16', label: 'Lime' },
  { value: '#22D3EE', label: 'Cyan' },
  { value: '#A78BFA', label: 'Lilac' },
  { value: '#0B0B0C', label: 'Ink' },
]
// 19 Nov: kotak biru di bawah mata = mulut Classic (bawaan); mulut lain menggantikannya, bukan menambah
export const KENT_MOUTHS = opt(
  ['dot', 'Classic'],
  ['none', 'None'],
  ['smile', 'Smile'],
  ['grin', 'Grin'],
  ['open', 'Open'],
  ['cat', 'Cat'],
  ['flat', 'Flat'],
  ['smirk', 'Smirk'],
  ['tongue', 'Tongue'],
  ['fang', 'Fang'],
  ['wavy', 'Wavy'],
  ['beak', 'Beak'],
  ['frown', 'Frown'],
  ['kiss', 'Kiss'],
  ['teeth', 'Teeth'],
  ['zigzag', 'Zigzag'],
  ['uwu', 'UwU'],
  ['o', 'Oh'],
  ['bigsmile', 'Big smile'],
  ['pout', 'Pout'],
  ['vamp', 'Vampire'],
  ['pill', 'Pill'],
)
export const KENT_FACES = opt(
  ['none', 'None'],
  ['blush', 'Blush'],
  ['freckles', 'Freckles'],
  ['brows', 'Brows'],
  ['angry', 'Fierce'],
  ['worried', 'Worried'],
  ['whiskers', 'Whiskers'],
  ['tear', 'Tear'],
  ['spark', 'Sparkle'],
)
export const KENT_ACCS = opt(
  ['none', 'None'],
  ['glasses', 'Glasses'],
  ['shades', 'Shades'],
  ['monocle', 'Monocle'],
  ['mustache', 'Mustache'],
  ['cap', 'Cap'],
  ['beanie', 'Beanie'],
  ['party', 'Party hat'],
  ['crown', 'Crown'],
  ['tophat', 'Top hat'],
  ['chef', 'Chef hat'],
  ['grad', 'Grad cap'],
  ['halo', 'Halo'],
  ['sprout', 'Sprout'],
  ['antenna', 'Antenna'],
  ['propeller', 'Propeller'],
  ['horns', 'Horns'],
  ['catears', 'Cat ears'],
  ['bunny', 'Bunny ears'],
  ['flower', 'Flower'],
  ['headband', 'Headband'],
  ['headphones', 'Headphones'],
  ['bow', 'Bow tie'],
  ['tie', 'Tie'],
  ['scarf', 'Scarf'],
)
export { KENT_SHAPES }

const KEY = 'kt-kent-look'
const EVENT = 'kt:kent-look'
const HEX = /^#[0-9A-F]{6}$/i

let cacheRaw: string | null | undefined
let cache: KentLook = KENT_DEFAULT

const pick = <T extends string>(list: { value: T }[], v: unknown, d: T): T => (list.some((o) => o.value === v) ? (v as T) : d)

function parse(raw: string | null): KentLook {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<KentLook> & { mv?: number }) : {}
    return {
      body: typeof v.body === 'string' && HEX.test(v.body) ? v.body : KENT_DEFAULT.body,
      detail: typeof v.detail === 'string' && HEX.test(v.detail) ? v.detail : KENT_DEFAULT.detail,
      shape: pick(KENT_SHAPES, v.shape, KENT_DEFAULT.shape),
      eyes: pick(KENT_EYES, v.eyes, KENT_DEFAULT.eyes),
      // Simpanan lama (sebelum mv 2): mulut 'none' berarti kotak biru tampil → Classic
      mouth: v.mv === 2 ? pick(KENT_MOUTHS, v.mouth, KENT_DEFAULT.mouth) : v.mouth && v.mouth !== 'none' ? pick(KENT_MOUTHS, v.mouth, KENT_DEFAULT.mouth) : 'dot',
      mouthColor:
        typeof v.mouthColor === 'string' && HEX.test(v.mouthColor)
          ? v.mouthColor
          : typeof v.detail === 'string' && HEX.test(v.detail)
            ? v.detail
            : KENT_DEFAULT.mouthColor,
      face: pick(KENT_FACES, v.face, KENT_DEFAULT.face),
      acc: pick(KENT_ACCS, v.acc, KENT_DEFAULT.acc),
    }
  } catch {
    return KENT_DEFAULT
  }
}

function read(): KentLook {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {}
  if (raw !== cacheRaw) {
    cacheRaw = raw
    cache = parse(raw)
  }
  return cache
}

export function saveKentLook(next: Partial<KentLook> | null) {
  const v = next ? { ...read(), ...next } : KENT_DEFAULT
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...v, mv: 2 }))
  } catch {
    cacheRaw = JSON.stringify(v)
    cache = v
  }
  window.dispatchEvent(new Event(EVENT))
}

const subscribe = (on: () => void) => {
  window.addEventListener(EVENT, on)
  window.addEventListener('storage', on)
  return () => {
    window.removeEventListener(EVENT, on)
    window.removeEventListener('storage', on)
  }
}

export const useKentLook = () => useSyncExternalStore(subscribe, read, () => KENT_DEFAULT)

const INK = '#0B0B0C'
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
const same = (a: string, b: string) => a.toUpperCase() === b.toUpperCase()
/**
 * Warna turunan sebagai variabel CSS: --kb/--ke/--kd/--kt untuk latar terang, --kbd/... untuk latar gelap
 * (tombol hitam, dark mode). Mata selalu kontras dengan badan; badan gelap dibalik jadi putih di latar gelap.
 */
export function kentVars(look: KentLook): Record<string, string> {
  const set = (body: string, dark: boolean) => {
    const eye = lum(body) > 0.62 ? INK : '#FFFFFF'
    const detail = same(look.detail, body) ? eye : look.detail
    const l = lum(look.detail)
    const tool = dark ? (l < 0.2 ? '#FFFFFF' : look.detail) : l > 0.85 ? INK : look.detail
    // Mulut sewarna badan tidak terlihat: pakai warna mata
    const mouth = Math.abs(lum(look.mouthColor) - lum(body)) < 0.12 ? eye : look.mouthColor
    return [body, eye, detail, tool, mouth]
  }
  const a = set(look.body, false)
  const b = set(lum(look.body) < 0.2 ? '#FFFFFF' : look.body, true)
  return {
    '--kb': a[0], '--ke': a[1], '--kd': a[2], '--kt': a[3], '--km': a[4],
    '--kbd': b[0], '--ked': b[1], '--kdd': b[2], '--ktd': b[3], '--kmd': b[4],
  }
}

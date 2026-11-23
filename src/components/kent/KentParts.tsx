import type { ReactNode } from 'react'

import type { KentAcc, KentEyes, KentFace, KentMouth } from './kent-look'
import type { Geo } from './kent-shapes'

// Potongan wajah Kent, digambar di sekitar titik (0,0); posisi/skala diatur rig (kent-rig.ts).
// Warna lewat kelas: k-fe/k-se = mata (kontras badan), k-fb/k-sb = badan, k-fd/k-sd = detail.

/** Mata; s = -1 kiri, 1 kanan */
export function Eye({ kind, s }: { kind: KentEyes; s: number }): ReactNode {
  switch (kind) {
    case 'dot':
      return <circle r="1.35" className="k-fe" />
    case 'wide':
      return (
        <>
          <ellipse rx="1.75" ry="2.5" className="k-fe" />
          <circle cx="0.4" cy="0.5" r="0.8" className="k-fb" />
        </>
      )
    case 'smile':
      return <path d="M-1.3.7c.4-1.5 2.2-1.5 2.6 0" className="k-se" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    case 'oval':
      return <ellipse rx="1.5" ry="2" className="k-fe" />
    case 'sparkle':
      return (
        <>
          <circle r="1.8" className="k-fe" />
          <circle cx="0.6" cy="-0.6" r="0.6" className="k-fb" />
        </>
      )
    case 'sleepy':
      return <path d="M-1.7-.3h3.4a1.7 1.7 0 0 1-3.4 0Z" className="k-fe" />
    case 'square':
      return <rect x="-1.3" y="-1.3" width="2.6" height="2.6" rx="0.6" className="k-fe" />
    case 'dash':
      return <rect x="-1.4" y="-0.55" width="2.8" height="1.1" rx="0.55" className="k-fe" />
    case 'ring':
      return <circle r="1.4" className="k-se" strokeWidth="0.9" fill="none" />
    case 'odd':
      return <circle r={s < 0 ? 1.8 : 1.05} className="k-fe" />
    case 'lash':
      return (
        <g transform={`scale(${s} 1)`}>
          <rect x="-1.15" y="-2.1" width="2.3" height="4.2" rx="1.15" className="k-fe" />
          <path d="M1-1.9l1-.8M1.3-.9l1.1-.4" className="k-se" strokeWidth="0.55" strokeLinecap="round" />
        </g>
      )
    case 'bold':
      return <path d="M-1.3-1.5 1.3-.3V1.1a1.3 1.3 0 0 1-2.6 0Z" className="k-fe" transform={`scale(${-s} 1)`} />
    case 'heart':
      return <path d="M0 1.9C-2.2.4-2.3-1-1.5-1.7-.9-2.2-.2-1.9 0-1.3.2-1.9.9-2.2 1.5-1.7 2.3-1 2.2.4 0 1.9Z" className="k-fe" />
    case 'star':
      return <path d="M0-2.3Q.35-.35 2.3 0 .35.35 0 2.3-.35.35-2.3 0-.35-.35 0-2.3Z" className="k-fe" />
    case 'cross':
      return <path d="M-1.2-1.2l2.4 2.4M1.2-1.2l-2.4 2.4" className="k-se" strokeWidth="1" strokeLinecap="round" />
    case 'button':
      return (
        <>
          <circle r="1.7" className="k-fe" />
          <circle cx="-0.5" cy="-0.5" r="0.45" className="k-fb" />
          <circle cx="0.5" cy="0.5" r="0.45" className="k-fb" />
        </>
      )
    case 'wink':
      return s < 0 ? (
        <path d="M-1.3.3h2.6" className="k-se" strokeWidth="1.1" strokeLinecap="round" />
      ) : (
        <rect x="-1.15" y="-2.3" width="2.3" height="4.6" rx="1.15" className="k-fe" />
      )
    case 'happy':
      return <path d="M-1.4.6q1.4-1.9 2.8 0" className="k-se" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    case 'spiral':
      return <path d="M0 0a.4.4 0 0 1 .7.2.9.9 0 0 1-1.1.9A1.4 1.4 0 0 1-1.4-.5 1.9 1.9 0 0 1 1-1.6" className="k-se" strokeWidth="0.55" strokeLinecap="round" fill="none" />
    case 'moon':
      return <path d="M.6-1.9A2 2 0 1 0 1.9.6 1.6 1.6 0 1 1 .6-1.9Z" className="k-fe" transform={`scale(${-s} 1)`} />
    case 'diamond':
      return <path d="M0-2 1.6 0 0 2-1.6 0Z" className="k-fe" strokeLinejoin="round" />
    case 'tall':
      return <rect x="-0.8" y="-2.7" width="1.6" height="5.4" rx="0.8" className="k-fe" />
    case 'visor':
      return <rect x={s < 0 ? -2.2 : -2.6} y="-0.8" width="4.8" height="1.6" rx="0.8" className="k-fe" />
    default:
      return <rect x="-1.15" y="-2.3" width="2.3" height="4.6" rx="1.15" className="k-fe" />
  }
}
/** Mata senyum (^), dipakai saat kanal joy aktif */
export const JOY_D = 'M-1.3.7c.4-1.5 2.2-1.5 2.6 0'

export function Mouth({ kind }: { kind: KentMouth }): ReactNode {
  // Warna mulut sendiri (k-fm/k-sm, --k-mouth), 19 Nov
  const line = { className: 'k-sm', strokeWidth: 0.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  switch (kind) {
    case 'smile':
      return <path d="M-1.5 0q1.5 1.5 3 0" {...line} />
    case 'grin':
      return <path d="M-1.7-.3h3.4a1.7 1.7 0 0 1-3.4 0Z" className="k-fm" />
    case 'open':
      return <ellipse rx="0.85" ry="1.05" cy="0.3" className="k-fm" />
    case 'cat':
      return <path d="M-1.7-.1q.85 1.1 1.7 0q.85 1.1 1.7 0" {...line} strokeWidth={0.7} />
    case 'flat':
      return <path d="M-1.2.2h2.4" {...line} />
    case 'smirk':
      return <path d="M-1.2.3q1.5.7 2.5-.7" {...line} />
    case 'tongue':
      return (
        <>
          <path d="M-1.7-.3h3.4a1.7 1.7 0 0 1-3.4 0Z" className="k-fm" />
          <ellipse cx="0.2" cy="1" rx="0.8" ry="0.6" className="k-fe" opacity="0.85" />
        </>
      )
    case 'fang':
      return (
        <>
          <path d="M-1.5 0q1.5 1.5 3 0" {...line} />
          <path d="M.5.5 1 1.6l.5-1.3Z" className="k-fm" />
        </>
      )
    case 'wavy':
      return <path d="M-1.6.2q.55-.7 1.1 0t1.05 0 1.05 0" {...line} strokeWidth={0.7} />
    case 'beak':
      return <path d="M-1.1-.4h2.2L0 1.1Z" className="k-fm" strokeLinejoin="round" />
    case 'frown':
      return <path d="M-1.5.9q1.5-1.5 3 0" {...line} />
    case 'kiss':
      return <path d="M-.2-.9q.9.2.3.7.8.3-.1.9" {...line} strokeWidth={0.7} />
    case 'teeth':
      return (
        <>
          <rect x="-1.8" y="-.6" width="3.6" height="1.6" rx="0.6" className="k-fm" />
          <path d="M-.6-.6v1.6M.6-.6v1.6M-1.8.2h3.6" className="k-sb" strokeWidth="0.3" />
        </>
      )
    case 'zigzag':
      return <path d="M-1.8.3-1.2-.3-.6.3 0-.3.6.3 1.2-.3 1.8.3" {...line} strokeWidth={0.6} />
    case 'uwu':
      return <path d="M-1.8-.2q.45.9.9 0 .45.9.9 0 .45.9.9 0 .45.9.9 0" {...line} strokeWidth={0.6} />
    case 'o':
      return <circle r="0.6" cy="0.2" className="k-sm" strokeWidth="0.6" fill="none" />
    case 'bigsmile':
      return <path d="M-2-.5h4a2 2.1 0 0 1-4 0Z" className="k-fm" />
    case 'pout':
      return <ellipse rx="0.75" ry="0.5" cy="0.3" className="k-fm" />
    case 'vamp':
      return (
        <>
          <path d="M-1.6-.1q1.6 1 3.2 0" {...line} />
          <path d="M-.9.25-.6 1.3-.3.4ZM.3.4.6 1.3.9.25Z" className="k-fm" />
        </>
      )
    case 'pill':
      return <rect x="-1.4" y="-.45" width="2.8" height="1.1" rx="0.55" className="k-fm" />
    default:
      return null
  }
}

/** Hiasan wajah berpasangan: [bujur, lintang, isi(sisi)] */
export function faceExtra(kind: KentFace): [number, number, (s: number) => ReactNode] | null {
  switch (kind) {
    case 'blush':
      return [36, -14, () => <ellipse rx="1.3" ry="0.75" className="k-fd" opacity="0.6" />]
    case 'freckles':
      return [
        34,
        -12,
        () => (
          <g className="k-fe" opacity="0.75">
            <circle cx="-0.8" cy="0" r="0.3" />
            <circle cx="0.2" cy="-0.5" r="0.3" />
            <circle cx="0.5" cy="0.5" r="0.3" />
          </g>
        ),
      ]
    case 'brows':
      return [18.6, 25, () => <path d="M-1.3.3q1.3-.9 2.6 0" className="k-se" strokeWidth="0.7" strokeLinecap="round" fill="none" />]
    case 'angry':
      return [18.6, 24, (s) => <path d={`M${-1.4 * s} .7 ${1.3 * s}-.5`} className="k-se" strokeWidth="0.8" strokeLinecap="round" />]
    case 'worried':
      return [18.6, 25, (s) => <path d={`M${-1.4 * s}-.5 ${1.3 * s} .6`} className="k-se" strokeWidth="0.7" strokeLinecap="round" />]
    case 'whiskers':
      return [
        40,
        -14,
        (s) => <path d={`M${-1.2 * s}-.3 ${1.6 * s}-.8M${-1.2 * s} .5 ${1.6 * s} .9`} className="k-se" strokeWidth="0.5" strokeLinecap="round" />,
      ]
    case 'tear':
      return [22, -18, (s) => (s > 0 ? <path d="M0-1.1c.7 1 1 1.5 1 2a1 1 0 0 1-2 0c0-.5.3-1 1-2Z" className="k-fd" /> : null)]
    case 'spark':
      return [38, 14, (s) => (s > 0 ? <path d="M0-1.5Q.2-.2 1.5 0 .2.2 0 1.5-.2.2-1.5 0-.2-.2 0-1.5Z" className="k-fd" /> : null)]
    default:
      return null
  }
}

export type AccSlot = 'hat' | 'fa' | 'neck'
/** Aksesori + tempatnya: hat = di puncak badan (asal 0,0 = puncak), fa = di wajah, neck = di badan bawah */
export function accessory(kind: KentAcc, g: Geo): [AccSlot, ReactNode] | null {
  const sd = { className: 'k-sd', fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'glasses':
      return [
        'fa',
        <g {...sd} strokeWidth="0.7" key="a">
          <circle cx="-2.55" r="2.4" />
          <circle cx="2.55" r="2.4" />
          <path d="M-.2-.4q.2-.3.4 0M-4.9-.5l-2.4-.7M4.9-.5l2.4-.7" />
        </g>,
      ]
    case 'shades':
      return [
        'fa',
        <g className="k-fd" key="a">
          <rect x="-5" y="-1.5" width="4.4" height="3" rx="1.2" />
          <rect x="0.6" y="-1.5" width="4.4" height="3" rx="1.2" />
          <path d="M-.9-1.1h1.8v.8H-.9ZM-5-1.1l-2.2-.5v.7L-5-.4ZM5-1.1l2.2-.5v.7L5-.4Z" />
        </g>,
      ]
    case 'monocle':
      return [
        'fa',
        <g {...sd} strokeWidth="0.7" key="a">
          <circle cx="2.55" r="2.5" />
          <path d="M4.6 1.6q1.6 2.4.6 6" strokeWidth="0.45" />
        </g>,
      ]
    case 'mustache':
      return ['fa', <path key="a" className="k-fd" d="M0 2.5c-1 1.5-3 1.5-3.9.2 1 .2 1.7-.4 2.1-1 .5-.8 1.4-.7 1.8 0 .4-.7 1.3-.8 1.8 0 .4.6 1.1 1.2 2.1 1-.9 1.3-2.9 1.3-3.9-.2Z" />]
    case 'cap':
      return [
        'hat',
        <g className="k-fd" key="a">
          <path d="M-5.1 4C-4.4 1.2-2.4-.6 0-.6S4.4 1.2 5.1 4c-3.3-.8-6.9-.8-10.2 0Z" />
          <path d="M3.6 3.3c1.6-.2 3.4.1 4.6.8.3.2.2.6-.1.6-1.6.1-3.2-.1-4.6-.6Z" />
          <circle cy="-0.7" r="0.6" />
        </g>,
      ]
    case 'beanie':
      return [
        'hat',
        <g className="k-fd" key="a">
          <path d="M-5.4 4.4C-4.8 1.2-2.6-.8 0-.8s4.8 2 5.4 5.2c-3.6-.9-7.2-.9-10.8 0Z" />
          <path d="M-5.6 4.5c3.7-1 7.5-1 11.2 0l-.2 1.3c-3.6-.9-7.2-.9-10.8 0Z" opacity="0.7" />
          <circle cy="-1.5" r="1.2" />
        </g>,
      ]
    case 'party':
      return [
        'hat',
        <g className="k-fd" key="a">
          <path d="M-2.6 1.4.9-4.6l2.4 5.6c-2-.5-3.9-.4-5.9.4Z" />
          <circle cx="0.9" cy="-4.8" r="0.9" />
        </g>,
      ]
    case 'crown':
      return ['hat', <path key="a" className="k-fd" strokeLinejoin="round" d="M-3.6 1.2l-.6-4.2 2.3 2L0-3.9 1.9-1l2.3-2-.6 4.2c-2.4-.6-4.8-.6-7.2 0Z" />]
    case 'tophat':
      return [
        'hat',
        <g className="k-fd" key="a">
          <path d="M-4.8.7c3.1-.8 6.5-.8 9.6 0l-.2 1.3c-3-.7-6.2-.7-9.2 0Z" />
          <path d="M-3-3.4q0-.6.6-.6h4.8q.6 0 .6.6V.4c-2-.4-4-.4-6 0Z" />
        </g>,
      ]
    case 'chef':
      return ['hat', <path key="a" className="k-fd" d="M-3.4 1.2v-2.3a2.2 2.2 0 0 1 1.5-3.7 2.5 2.5 0 0 1 3.8 0 2.2 2.2 0 0 1 1.5 3.7v2.3c-2.2-.5-4.6-.5-6.8 0Z" />]
    case 'grad':
      return [
        'hat',
        <g key="a">
          <path className="k-fd" d="M-5.4-.6 0-2.9 5.4-.6 0 1.7Z" strokeLinejoin="round" />
          <path {...sd} strokeWidth="0.5" d="M5.4-.6v2.8" />
          <circle className="k-fd" cx="5.4" cy="2.5" r="0.55" />
        </g>,
      ]
    case 'halo':
      return ['hat', <ellipse key="a" {...sd} strokeWidth="0.8" cy="-2.4" rx="3.4" ry="1" />]
    case 'sprout':
      return [
        'hat',
        <g key="a">
          <path {...sd} strokeWidth="0.7" d="M0 .6V-1.8" />
          <path className="k-fd" d="M0-1.8c-.2-1.6-1.6-2.4-3-2.2.1 1.6 1.4 2.5 3 2.2ZM0-1.8c.2-1.6 1.6-2.4 3-2.2-.1 1.6-1.4 2.5-3 2.2Z" />
        </g>,
      ]
    case 'antenna':
      return [
        'hat',
        <g key="a">
          <path className="k-sb" strokeWidth="0.8" strokeLinecap="round" d="M0 .4V-2.6" />
          <circle className="k-fd" cy="-3" r="1.1" />
        </g>,
      ]
    case 'propeller':
      return [
        'hat',
        <g key="a">
          <path className="k-fd" d="M-3.6 2.6C-3.2.8-1.8-.2 0-.2s3.2 1 3.6 2.8c-2.4-.6-4.8-.6-7.2 0Z" />
          <path {...sd} strokeWidth="0.6" d="M0-.2V-2.2" />
          <g className="kt-kent__prop k-fd">
            <ellipse cx="-1.9" cy="-2.4" rx="1.9" ry="0.6" />
            <ellipse cx="1.9" cy="-2.4" rx="1.9" ry="0.6" />
          </g>
          <circle className="k-fd" cy="-2.4" r="0.55" />
        </g>,
      ]
    case 'horns':
      return ['hat', <path key="a" className="k-fd" d="M-4.6 2c-.7-1.9-.3-3.6 1-4.6.2 1.6.9 2.7 1.9 3.5ZM4.6 2c.7-1.9.3-3.6-1-4.6-.2 1.6-.9 2.7-1.9 3.5Z" />]
    case 'catears':
      return ['hat', <path key="a" className="k-fd" strokeLinejoin="round" d="M-5.8 3.6-5.2-2-1.6.8ZM5.8 3.6 5.2-2 1.6.8Z" />]
    case 'bunny':
      return [
        'hat',
        <g className="k-fd" key="a">
          <ellipse cx="-2.3" cy="-2.6" rx="1.25" ry="3.6" transform="rotate(-10 -2.3 -2.6)" />
          <ellipse cx="2.3" cy="-2.6" rx="1.25" ry="3.6" transform="rotate(10 2.3 -2.6)" />
        </g>,
      ]
    case 'flower':
      return [
        'hat',
        <g key="a" transform="translate(3.6 1)">
          <g className="k-fd">
            {[0, 72, 144, 216, 288].map((a) => (
              <circle key={a} cy="-1.15" r="0.95" transform={`rotate(${a})`} />
            ))}
          </g>
          <circle r="0.7" className="k-fe" />
        </g>,
      ]
    case 'headband':
      return ['hat', <path key="a" {...sd} strokeWidth="1.2" d="M-5.4 3.4c3.5-1.2 7.3-1.2 10.8 0" />]
    case 'headphones': {
      const w = g.r + 0.5
      const h = g.top - 1.2 - g.cy
      // Dihitung dari pusat wajah supaya pas di semua bentuk
      return [
        'fa',
        <g key="a" transform={`scale(${8 / g.r})`}>
          <path {...sd} strokeWidth="1.1" d={`M${-w} 0C${-w} ${h * 1.33} ${w} ${h * 1.33} ${w} 0`} />
          <rect className="k-fd" x={-w - 1.5} y="-1.8" width="2.6" height="4.4" rx="1.2" />
          <rect className="k-fd" x={w - 1.1} y="-1.8" width="2.6" height="4.4" rx="1.2" />
        </g>,
      ]
    }
    case 'bow':
      return [
        'neck',
        <g className="k-fd" key="a">
          <path d="M0 0-3.1-1.6c-.4-.2-.8.1-.8.5v2.4c0 .4.4.7.8.5ZM0 0l3.1-1.6c.4-.2.8.1.8.5v2.4c0 .4-.4.7-.8.5Z" />
          <rect x="-0.9" y="-0.8" width="1.8" height="1.6" rx="0.5" />
        </g>,
      ]
    case 'tie':
      return ['neck', <path key="a" className="k-fd" strokeLinejoin="round" d="M-.9-1.4h1.8l-.5 1.3 1.1 3L0 4.2-1.5 2.9l1.1-3Z" />]
    case 'scarf':
      return [
        'neck',
        <g key="a">
          <path {...sd} strokeWidth="2" d="M-9-.8c5.6 1.8 12.4 1.8 18 0" />
          <path className="k-fd" d="M2.2.4h2.2l.5 3.6H2.4Z" />
        </g>,
      ]
    default:
      return null
  }
}

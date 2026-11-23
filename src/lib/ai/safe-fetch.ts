import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import type { Readable } from 'node:stream'

// Ambil URL dari luar dengan aman (anti-SSRF): hanya http(s) port bawaan, host harus IP publik.
// IP hasil DNS divalidasi di lookup koneksi itu sendiri, jadi DNS rebinding (cek publik, sambung privat) gagal.
// Body dibatasi saat streaming: baca dihentikan begitu melewati batas.

/** IPv6 → 16 byte; null bila tidak valid. Mendukung :: dan ekor IPv4 bertitik. */
function v6Bytes(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/%.*$/, '')
  const tail = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (tail) {
    const q = tail.slice(1).map(Number)
    if (q.some((n) => n > 255)) return null
    s = s.slice(0, -tail[0].length) + ((q[0] << 8) | q[1]).toString(16) + ':' + ((q[2] << 8) | q[3]).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const part = (x: string) => (x ? x.split(':') : [])
  const head = part(halves[0])
  const rest = halves.length === 2 ? part(halves[1]) : []
  const fill = 8 - head.length - rest.length
  if (halves.length === 2 ? fill < 0 : fill !== 0) return null
  const groups = [...head, ...Array(Math.max(fill, 0)).fill('0'), ...rest]
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.flatMap((g) => {
    const n = parseInt(g, 16)
    return [n >> 8, n & 255]
  })
}

function privateV4(ip: string): boolean {
  const q = ip.split('.').map(Number)
  if (q.length !== 4 || q.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b, c] = q
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / metadata cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF, TEST-NET-1
    (a === 192 && b === 88 && c === 99) || // 6to4 relay
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reserved, broadcast
  )
}

/**
 * IP yang tidak boleh dihubungi (privat, loopback, link-local, multicast, dokumentasi, dsb.). Murni, dites.
 * IPv6 memakai allowlist: hanya global unicast 2000::/3, minus range yang bisa membungkus IPv4
 * (Teredo 2001::/32, 6to4 2002::/16) dan dokumentasi. Jadi ::, ::1, IPv4-mapped/compatible (titik maupun hex),
 * NAT64 64:ff9b::/96, ULA fc00::/7, link-local fe80::/10, multicast ff00::/8 semuanya ditolak.
 */
export function privateIp(ip: string): boolean {
  const kind = isIP(ip.replace(/%.*$/, ''))
  if (kind === 4) return privateV4(ip)
  if (kind !== 6) return true
  const b = v6Bytes(ip)
  if (!b) return true
  if ((b[0] & 0xe0) !== 0x20) return true // di luar 2000::/3
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] < 0x02) return true // 2001::/23 (Teredo, benchmarking, ORCHID)
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true // 2001:db8::/32
  if (b[0] === 0x20 && b[1] === 0x02) return true // 6to4
  if (b[0] === 0x3f && (b[1] & 0xf0) === 0xf0) return true // 3fff::/20 dokumentasi
  return false
}

/** Validasi URL: http(s), port bawaan, semua IP host publik. Kembalikan URL atau pesan error. */
export async function safeUrl(raw: string): Promise<URL | string> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return 'Not a valid link.'
  }
  if (!/^https?:$/.test(u.protocol) || (u.port && u.port !== '80' && u.port !== '443')) return 'Only http(s) links.'
  if (u.username || u.password) return 'This address is not allowed.'
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) return privateIp(host) ? 'This address is not allowed.' : u
  const ips = await new Promise<string[]>((res) =>
    dnsLookup(host, { all: true }, (err, list) => res(err ? [] : list.map((x) => x.address))),
  )
  if (!ips.length) return 'The site could not be found.'
  if (ips.some(privateIp)) return 'This address is not allowed.'
  return u
}

/** Lookup untuk koneksi: tolak bila ada IP privat, jadi IP yang dipakai menyambung pasti sudah diperiksa. */
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, list: LookupAddress[]) => {
    if (err) return callback(err, '', 0)
    if (!list.length || list.some((x) => privateIp(x.address))) {
      const e = Object.assign(new Error(`Blocked address for ${hostname}`), { code: 'EBLOCKED' })
      return callback(e, '', 0)
    }
    if (options.all) return (callback as unknown as (e: null, l: LookupAddress[]) => void)(null, list)
    const pick = options.family ? list.find((x) => x.family === options.family) ?? list[0] : list[0]
    callback(null, pick.address, pick.family)
  })
}

export type SafeResponse = { status: number; headers: Headers; location: string | null; body: Buffer | null; tooLarge: boolean }

/**
 * GET satu kali (tanpa ikut redirect) ke URL yang sudah lolos safeUrl. Body dibaca streaming dan dihentikan
 * begitu melewati maxBytes (setelah dekompresi juga), tooLarge = true.
 */
export function safeGet(
  url: URL,
  opts: {
    headers?: Record<string, string>
    maxBytes: number
    signal?: AbortSignal
    readBody?: (status: number, headers: Headers) => boolean
    /** Hanya untuk tes (server lokal); produksi selalu safeLookup */
    lookup?: LookupFunction
  },
): Promise<SafeResponse> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) && privateIp(host)) return reject(new Error('Blocked address'))
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.request(
      url,
      {
        method: 'GET',
        headers: { 'accept-encoding': 'gzip, deflate, br', ...opts.headers },
        lookup: opts.lookup ?? safeLookup,
        signal: opts.signal,
        agent: false,
      },
      (res) => {
        const headers = new Headers()
        for (const [k, v] of Object.entries(res.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v))
        const status = res.statusCode ?? 0
        const location = headers.get('location')
        const done = (body: Buffer | null, tooLarge = false) => resolve({ status, headers, location, body, tooLarge })
        if (opts.readBody && !opts.readBody(status, headers)) {
          res.destroy()
          return done(null)
        }
        const declared = Number(headers.get('content-length') ?? 0)
        const enc = (headers.get('content-encoding') ?? '').toLowerCase()
        if (!enc && declared > opts.maxBytes) {
          res.destroy()
          return done(null, true)
        }
        let stream: Readable = res
        if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(createGunzip())
        else if (enc === 'deflate') stream = res.pipe(createInflate())
        else if (enc === 'br') stream = res.pipe(createBrotliDecompress())
        const chunks: Buffer[] = []
        let size = 0
        let finished = false
        stream.on('data', (c: Buffer) => {
          if (finished) return
          size += c.length
          if (size > opts.maxBytes) {
            finished = true
            res.destroy()
            stream.destroy()
            return done(null, true)
          }
          chunks.push(c)
        })
        stream.on('end', () => {
          if (!finished) {
            finished = true
            done(Buffer.concat(chunks))
          }
        })
        const fail = (e: Error) => {
          if (!finished) {
            finished = true
            stream.destroy()
            reject(e)
          }
        }
        stream.on('error', fail)
        if (stream !== res) res.on('error', fail)
        res.on('aborted', () => fail(new Error('Response aborted')))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BookingQrCode, encodeQrMatrix } from './qr-code'

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
{
  let v = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = v
    GF_EXP[i + 255] = v
    GF_LOG[v] = i
    v <<= 1
    if (v & 0x100) v ^= 0x11d
  }
}

function evalPoly(poly: number[], x: number): number {
  let acc = 0
  for (const coeff of poly) {
    acc = (acc === 0 ? 0 : (GF_EXP[(GF_LOG[acc] ?? 0) + (GF_LOG[x] ?? 0)] ?? 0)) ^ coeff
  }
  return acc
}

function readFormatFromMatrix(matrix: boolean[][]): { mask: number; rawBits: number } {
  const coords: [number, number][] = [
    [0, 8],
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
    [5, 8],
    [7, 8],
    [8, 8],
    [8, 7],
    [8, 5],
    [8, 4],
    [8, 3],
    [8, 2],
    [8, 1],
    [8, 0],
  ]
  let raw = 0
  coords.forEach(([r, c], i) => {
    if (matrix[r]?.[c]) raw |= 1 << i
  })
  const unmasked = raw ^ 0x5412
  return { mask: (unmasked >> 10) & 0b111, rawBits: raw }
}

function extractCodewords(matrix: boolean[][], mask: number): number[] {
  const size = 21
  const isReserved = (r: number, c: number) => {
    if (r <= 8 && c <= 8) return true
    if (r <= 8 && c >= size - 8) return true
    if (r >= size - 8 && c <= 8) return true
    if (r === 6 || c === 6) return true
    return false
  }
  const unmaskedBit = (r: number, c: number) => {
    let m = false
    switch (mask) {
      case 0:
        m = (r + c) % 2 === 0
        break
      case 1:
        m = r % 2 === 0
        break
      case 2:
        m = c % 3 === 0
        break
      case 3:
        m = (r + c) % 3 === 0
        break
      case 4:
        m = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0
        break
      case 5:
        m = ((r * c) % 2) + ((r * c) % 3) === 0
        break
      case 6:
        m = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0
        break
      case 7:
        m = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
        break
    }
    return Boolean(matrix[r]?.[c]) !== m
  }

  const bits: number[] = []
  let upward = true
  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step
      for (const c of [rightCol, rightCol - 1]) {
        if (!isReserved(r, c)) {
          bits.push(unmaskedBit(r, c) ? 1 : 0)
        }
      }
    }
    upward = !upward
  }

  const codewords: number[] = []
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i + b] ?? 0)
    codewords.push(byte)
  }
  return codewords
}

describe('BookingQrCode (STORY-10, TSK-10.3)', () => {
  it('encodes an ISO/IEC 18004 Version 1-M matrix with valid finders, timing, and zero RS syndromes', () => {
    const token = 'ABCDEFGHJKMN'
    const matrix = encodeQrMatrix(token)
    expect(matrix).toHaveLength(21)
    for (const row of matrix) expect(row).toHaveLength(21)

    // Finder centers and dark module (13, 8)
    expect(matrix[3]?.[3]).toBe(true)
    expect(matrix[3]?.[17]).toBe(true)
    expect(matrix[17]?.[3]).toBe(true)
    expect(matrix[13]?.[8]).toBe(true)
    // Timing pattern alternating along row 6
    expect([
      matrix[6]?.[8],
      matrix[6]?.[9],
      matrix[6]?.[10],
      matrix[6]?.[11],
      matrix[6]?.[12],
    ]).toEqual([true, false, true, false, true])

    const { mask } = readFormatFromMatrix(matrix)
    const codewords = extractCodewords(matrix, mask)
    expect(codewords).toHaveLength(26)

    // Verify zero Reed-Solomon error syndromes across all 10 generator roots α^0..α^9
    for (let root = 0; root < 10; root++) {
      expect(evalPoly(codewords, GF_EXP[root] ?? 0)).toBe(0)
    }

    // Verify decoded payload bytes equal ONLY the raw 12-character normalized token
    const bits = codewords
      .slice(0, 16)
      .flatMap((byte) => Array.from({ length: 8 }, (_, b) => (byte >> (7 - b)) & 1))
    const readInt = (start: number, len: number) =>
      bits.slice(start, start + len).reduce((acc, b) => (acc << 1) | b, 0)
    expect(readInt(0, 4)).toBe(0b0100)
    expect(readInt(4, 8)).toBe(12)
    const decoded = Array.from({ length: 12 }, (_, idx) =>
      String.fromCharCode(readInt(12 + idx * 8, 8)),
    ).join('')
    expect(decoded).toBe('ABCDEFGHJKMN')
  })

  it('normalizes token input while producing identical SVG modules', () => {
    const a = renderToStaticMarkup(<BookingQrCode token="ABCDEFGHJKMN" />)
    const b = renderToStaticMarkup(<BookingQrCode token="abcd-efgh-jkmn" />)
    expect(a).toBe(b)
  })

  it('renders accessible pure SVG with design tokens and responsive min size', () => {
    const html = renderToStaticMarkup(<BookingQrCode token="ABCDEFGHJKMN" />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Booking QR code for token ABCD-EFGH-JKMN"')
    expect(html).toContain('viewBox="0 0 29 29"')
    expect(html).toContain('bg-card')
    expect(html).toContain('text-card-foreground')
    expect(html).toContain('h-[180px] w-[180px]')
    expect(html).toContain('sm:h-[220px] sm:w-[220px]')
    expect(html).toContain('<path')
  })
})

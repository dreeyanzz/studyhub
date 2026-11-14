'use client'

/**
 * Pure SVG QR code generator for STORY-10 booking tokens (TSK-10.3, FR-2.7, D-031, D-059, D-060).
 *
 * Implements ISO/IEC 18004 Version 1 (21x21 modules, Error Correction Level M, Byte mode)
 * with zero external runtime dependencies. Encodes only the raw 12-character normalized token.
 */
import { formatToken, normalizeToken } from '@/lib/check-in/normalize'
import { cn } from '@/lib/utils'

const SIZE = 21
const QUIET_ZONE = 4
const DATA_CODEWORDS = 16
const EC_CODEWORDS = 10
const FORMAT_MASK = 0x5412
const FORMAT_GENERATOR = 0x537

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
{
  let value = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = value
    GF_EXP[i + 255] = value
    GF_LOG[value] = i
    value <<= 1
    if (value & 0x100) value ^= 0x11d
  }
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[(GF_LOG[a] ?? 0) + (GF_LOG[b] ?? 0)] ?? 0
}

function rsGenerator(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0)
    const factor = GF_EXP[i] ?? 0
    for (let j = 0; j < poly.length; j++) {
      const term = poly[j] ?? 0
      next[j] = (next[j] ?? 0) ^ term
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(term, factor)
    }
    poly = next
  }
  return poly
}

function computeEcCodewords(data: number[]): number[] {
  const gen = rsGenerator(EC_CODEWORDS)
  const buffer = new Array<number>(data.length + EC_CODEWORDS).fill(0)
  for (let i = 0; i < data.length; i++) buffer[i] = data[i] ?? 0

  for (let i = 0; i < data.length; i++) {
    const coeff = buffer[i] ?? 0
    if (coeff === 0) continue
    for (let j = 0; j < gen.length; j++) {
      buffer[i + j] = (buffer[i + j] ?? 0) ^ gfMul(gen[j] ?? 0, coeff)
    }
  }
  return buffer.slice(data.length)
}

function encodeByteCodewords(payload: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(payload))
  if (bytes.length > 14) {
    throw new RangeError(
      `Version 1-M byte mode supports at most 14 bytes (received ${bytes.length})`,
    )
  }

  const bits: number[] = []
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1)
    }
  }

  // Byte mode (0100), 8-bit length, payload bytes, terminator, byte boundary alignment
  pushBits(0b0100, 4)
  pushBits(bytes.length, 8)
  for (const byte of bytes) pushBits(byte, 8)
  const maxDataBits = DATA_CODEWORDS * 8
  pushBits(0, Math.min(4, maxDataBits - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i + b] ?? 0)
    codewords.push(byte)
  }

  let padIndex = 0
  while (codewords.length < DATA_CODEWORDS) {
    codewords.push(padIndex % 2 === 0 ? 0xec : 0x11)
    padIndex++
  }

  return [...codewords, ...computeEcCodewords(codewords)]
}

function getCell(grid: boolean[][], r: number, c: number): boolean {
  return grid[r]?.[c] ?? false
}

function setCell(grid: boolean[][], r: number, c: number, value: boolean): void {
  const row = grid[r]
  if (row) row[c] = value
}

function createReservedAndBase(): { modules: boolean[][]; reserved: boolean[][] } {
  const modules = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false))
  const reserved = Array.from({ length: SIZE }, () =>
    new Array<boolean>(SIZE).fill(false),
  )

  const placeFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr
        const c = left + dc
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue
        const inFinder = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const dark =
          inFinder &&
          (dr === 0 ||
            dr === 6 ||
            dc === 0 ||
            dc === 6 ||
            (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
        setCell(modules, r, c, dark)
        setCell(reserved, r, c, true)
      }
    }
  }

  placeFinder(0, 0)
  placeFinder(0, SIZE - 7)
  placeFinder(SIZE - 7, 0)

  // Timing patterns along row 6 and column 6
  for (let i = 8; i < SIZE - 8; i++) {
    const dark = i % 2 === 0
    setCell(modules, 6, i, dark)
    setCell(reserved, 6, i, true)
    setCell(modules, i, 6, dark)
    setCell(reserved, i, 6, true)
  }

  // Dark module (4 * version + 9, 8) = (13, 8)
  setCell(modules, 13, 8, true)
  setCell(reserved, 13, 8, true)

  // Reserve format info coordinates around finders
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setCell(reserved, 8, i, true)
      setCell(reserved, i, 8, true)
    }
  }
  for (let i = SIZE - 8; i < SIZE; i++) setCell(reserved, 8, i, true)
  for (let i = SIZE - 7; i < SIZE; i++) setCell(reserved, i, 8, true)

  return { modules, reserved }
}

function computeFormatBits(mask: number): number {
  // Error correction level M = 0b00
  const data = mask & 0b111
  let rem = data << 10
  for (let bit = 14; bit >= 10; bit--) {
    if ((rem >> bit) & 1) {
      rem ^= FORMAT_GENERATOR << (bit - 10)
    }
  }
  return ((data << 10) | rem) ^ FORMAT_MASK
}

function writeFormatInfo(modules: boolean[][], mask: number): void {
  const format = computeFormatBits(mask)
  const bit = (pos: number) => Boolean((format >> pos) & 1)

  const topLeftCoords: [number, number][] = [
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
  topLeftCoords.forEach(([r, c], i) => {
    setCell(modules, r, c, bit(i))
  })

  const splitCoords: [number, number][] = [
    [8, 20],
    [8, 19],
    [8, 18],
    [8, 17],
    [8, 16],
    [8, 15],
    [8, 14],
    [8, 13],
    [14, 8],
    [15, 8],
    [16, 8],
    [17, 8],
    [18, 8],
    [19, 8],
    [20, 8],
  ]
  splitCoords.forEach(([r, c], i) => {
    setCell(modules, r, c, bit(i))
  })
}

function shouldMask(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0
    case 1:
      return r % 2 === 0
    case 2:
      return c % 3 === 0
    case 3:
      return (r + c) % 3 === 0
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
    default:
      return false
  }
}

function placeDataBits(
  modules: boolean[][],
  reserved: boolean[][],
  codewords: number[],
): void {
  let bitIndex = 0
  let upward = true

  for (let rightCol = SIZE - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5
    for (let step = 0; step < SIZE; step++) {
      const r = upward ? SIZE - 1 - step : step
      for (const c of [rightCol, rightCol - 1]) {
        if (getCell(reserved, r, c)) continue
        const byteIdx = bitIndex >> 3
        const bitPos = 7 - (bitIndex & 7)
        const cw = codewords[byteIdx]
        setCell(modules, r, c, cw !== undefined ? Boolean((cw >> bitPos) & 1) : false)
        bitIndex++
      }
    }
    upward = !upward
  }
}

function scoreMask(modules: boolean[][]): number {
  let penalty = 0

  // Rule 1: 5+ consecutive same-color modules in rows and columns
  for (let r = 0; r < SIZE; r++) {
    let runColor = getCell(modules, r, 0)
    let runLength = 1
    for (let c = 1; c < SIZE; c++) {
      const cell = getCell(modules, r, c)
      if (cell === runColor) {
        runLength++
      } else {
        if (runLength >= 5) penalty += 3 + (runLength - 5)
        runColor = cell
        runLength = 1
      }
    }
    if (runLength >= 5) penalty += 3 + (runLength - 5)
  }
  for (let c = 0; c < SIZE; c++) {
    let runColor = getCell(modules, 0, c)
    let runLength = 1
    for (let r = 1; r < SIZE; r++) {
      const cell = getCell(modules, r, c)
      if (cell === runColor) {
        runLength++
      } else {
        if (runLength >= 5) penalty += 3 + (runLength - 5)
        runColor = cell
        runLength = 1
      }
    }
    if (runLength >= 5) penalty += 3 + (runLength - 5)
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < SIZE - 1; r++) {
    for (let c = 0; c < SIZE - 1; c++) {
      const color = getCell(modules, r, c)
      if (
        getCell(modules, r, c + 1) === color &&
        getCell(modules, r + 1, c) === color &&
        getCell(modules, r + 1, c + 1) === color
      ) {
        penalty += 3
      }
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns in rows/cols
  const hasFinderLike = (line: boolean[], i: number) => {
    const at = (k: number) => line[i + k] ?? false
    const matchesCore = at(0) && !at(1) && at(2) && at(3) && at(4) && !at(5) && at(6)
    if (!matchesCore) return false
    const leftLight = i >= 4 && !at(-1) && !at(-2) && !at(-3) && !at(-4)
    const rightLight = i + 10 < line.length && !at(7) && !at(8) && !at(9) && !at(10)
    return leftLight || rightLight
  }
  for (let r = 0; r < SIZE; r++) {
    const row = modules[r] ?? []
    for (let c = 0; c <= SIZE - 7; c++) {
      if (hasFinderLike(row, c)) penalty += 40
    }
  }
  for (let c = 0; c < SIZE; c++) {
    const col = modules.map((row) => row[c] ?? false)
    for (let r = 0; r <= SIZE - 7; r++) {
      if (hasFinderLike(col, r)) penalty += 40
    }
  }

  // Rule 4: proportion of dark modules away from 50%
  let dark = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (getCell(modules, r, c)) dark++
    }
  }
  const percent = (dark * 100) / (SIZE * SIZE)
  const prevMultiple = Math.floor(percent / 5) * 5
  const nextMultiple = Math.ceil(percent / 5) * 5
  penalty +=
    Math.min(Math.abs(prevMultiple - 50) / 5, Math.abs(nextMultiple - 50) / 5) * 10

  return penalty
}

/**
 * Generates a 21x21 ISO/IEC 18004 QR code matrix (Version 1-M, Byte mode) for the
 * raw booking token string. Exported for deterministic verification in unit tests.
 */
export function encodeQrMatrix(rawToken: string): boolean[][] {
  const token = normalizeToken(rawToken)
  const codewords = encodeByteCodewords(token)
  const { modules: baseModules, reserved } = createReservedAndBase()
  placeDataBits(baseModules, reserved, codewords)

  let bestScore = Number.POSITIVE_INFINITY
  let bestMatrix: boolean[][] = baseModules

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseModules.map((row, r) =>
      row.map((val, c) =>
        getCell(reserved, r, c) ? val : val !== shouldMask(mask, r, c),
      ),
    )
    writeFormatInfo(candidate, mask)
    const score = scoreMask(candidate)
    if (score < bestScore) {
      bestScore = score
      bestMatrix = candidate
    }
  }

  return bestMatrix
}

function matrixToSvgPath(matrix: boolean[][]): string {
  const commands: string[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (getCell(matrix, r, c)) {
        commands.push(`M${c + QUIET_ZONE} ${r + QUIET_ZONE}h1v1h-1z`)
      }
    }
  }
  return commands.join('')
}

/**
 * High-contrast pure SVG QR code encoding ONLY the raw 12-character Crockford base32
 * booking token (D-031, D-059, D-060). Uses `bg-card` and `text-card-foreground` tokens.
 */
export function BookingQrCode({
  token,
  className,
}: {
  token: string
  className?: string
}) {
  const normalized = normalizeToken(token)
  const matrix = encodeQrMatrix(normalized)
  const viewSize = SIZE + QUIET_ZONE * 2
  const grouped = formatToken(normalized)

  return (
    <div
      className={cn(
        'inline-flex rounded-lg border border-border bg-card p-2 text-card-foreground',
        className,
      )}
    >
      <svg
        role="img"
        aria-label={`Booking QR code for token ${grouped}`}
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        shapeRendering="crispEdges"
        className="h-[180px] w-[180px] bg-card text-card-foreground sm:h-[220px] sm:w-[220px]"
      >
        <rect width={viewSize} height={viewSize} className="fill-card" />
        <path d={matrixToSvgPath(matrix)} fill="currentColor" />
      </svg>
    </div>
  )
}

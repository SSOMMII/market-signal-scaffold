/**
 * Technical indicator calculations (pure TypeScript)
 * Used for KIS API data where the Python `ta` library is unavailable
 */

function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return []
  const k = 2 / (period + 1)
  // Seed with SMA of first `period` values
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result: number[] = [prev]
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

export function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

export function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? -diff : 0)
  }
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export function calcMACD(closes: number[]): { macd: number | null; signal: number | null } {
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  if (!ema12.length || !ema26.length) return { macd: null, signal: null }
  // ema12 starts at index 11, ema26 at index 25 — offset aligns them
  const offset = ema12.length - ema26.length
  const macdLine = ema26.map((v26, i) => ema12[i + offset] - v26)
  if (!macdLine.length) return { macd: null, signal: null }
  const signalEma = calcEMA(macdLine, 9)
  return {
    macd: macdLine[macdLine.length - 1],
    signal: signalEma.length > 0 ? signalEma[signalEma.length - 1] : null,
  }
}

export function calcBollinger(closes: number[], period = 20): {
  upper: number | null; middle: number | null; lower: number | null
} {
  if (closes.length < period) return { upper: null, middle: null, lower: null }
  const slice = closes.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const std = Math.sqrt(slice.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / period)
  return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std }
}

export function calcStochastic(
  highs: number[], lows: number[], closes: number[], period = 14, smooth = 3
): { k: number | null; d: number | null } {
  if (closes.length < period) return { k: null, d: null }
  const kValues: number[] = []
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1))
    const ll = Math.min(...lows.slice(i - period + 1, i + 1))
    kValues.push(hh === ll ? 50 : (closes[i] - ll) / (hh - ll) * 100)
  }
  const k = kValues[kValues.length - 1]
  const dSlice = kValues.slice(-smooth)
  const d = dSlice.reduce((a, b) => a + b, 0) / dSlice.length
  return { k, d }
}

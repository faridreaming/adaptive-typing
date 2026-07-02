import { describe, it, expect } from 'vitest'
import {
  calculateErrorRate,
  calculateWpm,
  calculateAccuracy,
  pickWeightedWords,
  breakdownWordResults,
} from './scoring'

describe('calculateErrorRate', () => {
  it('returns 0 when never exposed', () => {
    expect(calculateErrorRate({ exposureCount: 0, errorCount: 0 })).toBe(0)
  })

  it('returns 0 when no errors', () => {
    expect(calculateErrorRate({ exposureCount: 10, errorCount: 0 })).toBe(0)
  })

  it('returns correct ratio', () => {
    expect(calculateErrorRate({ exposureCount: 10, errorCount: 3 })).toBe(0.3)
  })
})

describe('calculateWpm', () => {
  it('returns 0 for zero elapsed time', () => {
    expect(calculateWpm(100, 0)).toBe(0)
  })

  it('calculates standard WPM (5 chars = 1 word)', () => {
    // 250 characters in 1 minute = 50 words
    expect(calculateWpm(250, 60_000)).toBe(50)
  })
})

describe('calculateAccuracy', () => {
  it('returns 1 when no characters typed yet', () => {
    expect(calculateAccuracy(0, 0)).toBe(1)
  })

  it('calculates correct ratio', () => {
    expect(calculateAccuracy(90, 100)).toBe(0.9)
  })
})

describe('pickWeightedWords', () => {
  const stats = [
    { word: 'yang', exposureCount: 100, errorCount: 50, avgLatencyMs: 200 }, // weak
    { word: 'dan', exposureCount: 100, errorCount: 1, avgLatencyMs: 100 }, // strong
  ]

  it('returns requested count', () => {
    const result = pickWeightedWords(stats, 20)
    expect(result).toHaveLength(20)
  })

  it('picks the weaker word more often over many samples', () => {
    const result = pickWeightedWords(stats, 1000)
    const weakCount = result.filter((w) => w === 'yang').length
    // Not asserting an exact number (it's random), just that the weighting
    // clearly favors the weaker word over a large sample.
    expect(weakCount).toBeGreaterThan(600)
  })

  it('returns empty array when no stats given', () => {
    expect(pickWeightedWords([], 5)).toEqual([])
  })
})

describe('breakdownWordResults', () => {
  it('marks all words correct when typed text matches exactly', () => {
    const result = breakdownWordResults('yang dan dengan', 'yang dan dengan')
    expect(result).toEqual([
      { word: 'yang', isError: false },
      { word: 'dan', isError: false },
      { word: 'dengan', isError: false },
    ])
  })

  it('marks a word as error when it does not match', () => {
    const result = breakdownWordResults('yang dan dengan', 'yng dan dengan')
    expect(result).toEqual([
      { word: 'yang', isError: true },
      { word: 'dan', isError: false },
      { word: 'dengan', isError: false },
    ])
  })

  it('marks missing trailing words as error (test ended early)', () => {
    const result = breakdownWordResults('yang dan dengan', 'yang dan')
    expect(result).toEqual([
      { word: 'yang', isError: false },
      { word: 'dan', isError: false },
      { word: 'dengan', isError: true },
    ])
  })
})

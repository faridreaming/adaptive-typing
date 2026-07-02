// Pure functions only — no React, no Supabase, no side effects.
// This makes everything here trivial to unit test (see scoring.test.ts).

export interface WordStat {
  word: string
  exposureCount: number
  errorCount: number
  avgLatencyMs: number
}

/**
 * Error rate for a single word, normalized by exposure.
 * Returns 0 if the word has never been seen (avoids division by zero).
 */
export function calculateErrorRate(stat: {
  exposureCount: number
  errorCount: number
}): number {
  if (stat.exposureCount === 0) return 0
  return stat.errorCount / stat.exposureCount
}

/**
 * WPM = (characters typed / 5) / minutes elapsed.
 * The "/ 5" is the standard convention (average word length assumption).
 */
export function calculateWpm(
  charactersTyped: number,
  elapsedMs: number,
): number {
  if (elapsedMs <= 0) return 0
  const minutes = elapsedMs / 1000 / 60
  return charactersTyped / 5 / minutes
}

/**
 * Accuracy as a 0-1 ratio.
 */
export function calculateAccuracy(
  correctChars: number,
  totalChars: number,
): number {
  if (totalChars === 0) return 1
  return correctChars / totalChars
}

/**
 * Compares what the user typed against the target text, word by word
 * (split on spaces), and returns per-word exposure/error counts.
 *
 * A word counts as an error if the substring the user typed for that word
 * doesn't exactly match the target word. This is intentionally simple for
 * v1 — it doesn't try to distinguish "fixed via backspace" from "typed
 * wrong and moved on" (see PRD open question #3). Backspace corrections
 * aren't tracked here at all yet; that needs keystroke-level capture,
 * which is a deliberate v2 scope decision, not an oversight.
 */
export function breakdownWordResults(
  targetText: string,
  typedText: string,
): Array<{ word: string; isError: boolean }> {
  const targetWords = targetText.split(' ')
  const typedWords = typedText.split(' ')

  return targetWords.map((word, i) => ({
    word,
    isError: typedWords[i] !== word,
  }))
}

/**
 * to be picked. Every word still has a small baseline chance (minWeight)
 * so we don't hard-filter out words that are currently "fine" — this is
 * the mechanism that avoids pure repetition drilling (see PRD section on
 * avoiding overfitting/fatigue).
 */
export function pickWeightedWords(
  stats: WordStat[],
  count: number,
  minWeight = 0.1,
): string[] {
  if (stats.length === 0) return []

  const weights = stats.map((s) => calculateErrorRate(s) + minWeight)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  const picked: string[] = []
  for (let i = 0; i < count; i++) {
    let r = Math.random() * totalWeight
    for (let j = 0; j < stats.length; j++) {
      r -= weights[j]
      if (r <= 0) {
        picked.push(stats[j].word)
        break
      }
    }
  }
  return picked
}

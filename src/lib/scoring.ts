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
 * A word counts as an error if EITHER:
 * (a) the final submitted word doesn't match the target word, OR
 * (b) `charHadError` shows the user typed a wrong character somewhere in
 *     that word's range at any point — even if they backspaced and fixed
 *     it before moving on.
 *
 * Resolves PRD open question #3 in favor of counting corrections: v1
 * originally didn't, but real dogfooding showed error_count staying at
 * ~0 for a user who reflexively self-corrects, which defeats the app's
 * whole point of surfacing words that actually trip you up.
 *
 * charHadError defaults to [] so callers/tests that only care about the
 * final-mismatch case keep working unchanged.
 */
export function breakdownWordResults(
  targetText: string,
  typedText: string,
  charHadError: boolean[] = [],
): Array<{ word: string; isError: boolean }> {
  const targetWords = targetText.split(' ')
  const typedWords = typedText.split(' ')

  let charOffset = 0
  return targetWords.map((word, i) => {
    const start = charOffset
    const end = start + word.length
    charOffset = end + 1 // +1 skips the space separator

    const finalMismatch = typedWords[i] !== word
    const wasCorrected = charHadError.slice(start, end).some(Boolean)

    return { word, isError: finalMismatch || wasCorrected }
  })
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

export type CharStatus = 'pending' | 'correct' | 'incorrect'

/**
 * Classifies a single character position in the live typing preview.
 * Extracted out of TestPage's JSX so it's testable as a pure function —
 * the markup around it will likely keep changing during dogfooding, but
 * this classification rule is the stable part.
 */
export function getCharStatus(
  index: number,
  input: string,
  targetText: string,
): CharStatus {
  if (index >= input.length) return 'pending'
  return input[index] === targetText[index] ? 'correct' : 'incorrect'
}

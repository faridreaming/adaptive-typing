import { supabase } from '#lib/supabase'
import { breakdownWordResults } from '#lib/scoring'

interface SaveSessionParams {
  userId: string
  language: 'id' | 'en'
  mode: 'normal' | 'weak_point_drill'
  targetText: string
  typedText: string
  wpm: number
  accuracy: number
  startedAt: number
  charHadError: boolean[]
}

/**
 * Persists a completed typing session:
 * 1. Insert one row into `sessions`.
 * 2. For each word in the test, upsert `word_stats` — incrementing
 *    exposure_count always, and error_count only when that word was
 *    mistyped.
 *
 * This runs once at the end of a session (not per keystroke) — see the
 * PRD note on avoiding excessive writes.
 */
export async function saveSession(params: SaveSessionParams) {
  const {
    userId,
    language,
    mode,
    targetText,
    typedText,
    wpm,
    accuracy,
    startedAt,
    charHadError,
  } = params

  const { error: sessionError } = await supabase.from('sessions').insert({
    user_id: userId,
    mode,
    language,
    wpm,
    accuracy,
    started_at: new Date(startedAt).toISOString(),
    ended_at: new Date().toISOString(),
  })

  if (sessionError) {
    throw new Error(`Failed to save session: ${sessionError.message}`)
  }

  const wordResults = breakdownWordResults(targetText, typedText, charHadError)

  // Aggregate in case the same word appears more than once in one test
  // (e.g. "yang" showing up 3 times in a 20-word passage) — otherwise
  // the upsert below would only keep the last occurrence's result.
  const aggregated = new Map<
    string,
    { exposureCount: number; errorCount: number }
  >()
  for (const { word, isError } of wordResults) {
    const existing = aggregated.get(word) ?? { exposureCount: 0, errorCount: 0 }
    existing.exposureCount += 1
    if (isError) existing.errorCount += 1
    aggregated.set(word, existing)
  }

  // Fetch existing stats for these words so we can increment rather than
  // overwrite (upsert alone can't do "+1", it can only replace values).
  const words = Array.from(aggregated.keys())
  const { data: existingStats, error: fetchError } = await supabase
    .from('word_stats')
    .select('word, exposure_count, error_count')
    .eq('user_id', userId)
    .eq('language', language)
    .in('word', words)

  if (fetchError) {
    throw new Error(
      `Failed to fetch existing word_stats: ${fetchError.message}`,
    )
  }

  const existingByWord = new Map(
    (existingStats ?? []).map((row) => [row.word, row]),
  )

  const rowsToUpsert = words.map((word) => {
    const delta = aggregated.get(word)!
    const existing = existingByWord.get(word)

    return {
      user_id: userId,
      word,
      language,
      exposure_count: (existing?.exposure_count ?? 0) + delta.exposureCount,
      error_count: (existing?.error_count ?? 0) + delta.errorCount,
      last_practiced_at: new Date().toISOString(),
    }
  })

  const { error: upsertError } = await supabase
    .from('word_stats')
    .upsert(rowsToUpsert, { onConflict: 'user_id,word,language' })

  if (upsertError) {
    throw new Error(`Failed to upsert word_stats: ${upsertError.message}`)
  }
}

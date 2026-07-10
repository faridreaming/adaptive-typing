import { supabase } from '#lib/supabase'

interface WordResult {
  word: string
  isError: boolean
}

interface SaveSessionParams {
  userId: string
  language: 'id' | 'en'
  mode: 'normal' | 'weak_point_drill'
  wpm: number
  accuracy: number
  startedAt: number
  wordResults: WordResult[]
}

/**
 * Saves a completed session + updates word_stats. wordResults now comes
 * pre-computed from TestPage's per-word state machine, so there's no
 * reconstruction step (breakdownWordResults) — the data is already
 * correct at the source, we just persist it.
 */
export async function saveSession(params: SaveSessionParams) {
  const { userId, language, mode, wpm, accuracy, startedAt, wordResults } =
    params

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

  // Aggregate repeated words within this session before upserting — a
  // word appearing 3x in one test should add exposure_count += 3, not
  // require 3 separate round trips to the DB.
  const aggregated = new Map<string, { exposure: number; errors: number }>()
  for (const { word, isError } of wordResults) {
    const entry = aggregated.get(word) ?? { exposure: 0, errors: 0 }
    entry.exposure += 1
    entry.errors += isError ? 1 : 0
    aggregated.set(word, entry)
  }

  for (const [word, { exposure, errors }] of aggregated) {
    const { data: existing } = await supabase
      .from('word_stats')
      .select('exposure_count, error_count')
      .eq('user_id', userId)
      .eq('word', word)
      .eq('language', language)
      .maybeSingle()

    const { error: upsertError } = await supabase.from('word_stats').upsert(
      {
        user_id: userId,
        word,
        language,
        exposure_count: (existing?.exposure_count ?? 0) + exposure,
        error_count: (existing?.error_count ?? 0) + errors,
        last_practiced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,word,language' },
    )

    if (upsertError) {
      throw new Error(
        `Failed to update word_stats for "${word}": ${upsertError.message}`,
      )
    }
  }
}

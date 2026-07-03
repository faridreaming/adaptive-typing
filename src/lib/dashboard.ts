import { supabase } from '#lib/supabase'
import { calculateErrorRate } from '#lib/scoring'

type Language = 'id' | 'en'

export interface WeakWord {
  word: string
  errorRate: number
  exposureCount: number
  errorCount: number
}

/**
 * Weakest words for a user+language, sorted by error rate desc. Error
 * rate is computed client-side with the same pure function used for
 * pickWeightedWords, so "weak" here means exactly what drives the drill
 * mode — no separate definition to keep in sync.
 */
export async function fetchWeakestWords({
  userId,
  language,
  limit = 20,
}: {
  userId: string
  language: Language
  limit?: number
}): Promise<WeakWord[]> {
  const { data, error } = await supabase
    .from('word_stats')
    .select('word, exposure_count, error_count')
    .eq('user_id', userId)
    .eq('language', language)

  if (error) throw new Error(`Failed to fetch weakest words: ${error.message}`)

  return (data ?? [])
    .map((row) => ({
      word: row.word,
      errorRate: calculateErrorRate({
        exposureCount: row.exposure_count,
        errorCount: row.error_count,
      }),
      exposureCount: row.exposure_count,
      errorCount: row.error_count,
    }))
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, limit)
}

export interface SessionSummary {
  id: string
  mode: 'normal' | 'weak_point_drill'
  wpm: number
  accuracy: number
  startedAt: string
}

/** Sessions for a user, oldest first (so charts read left-to-right). */
export async function fetchSessionHistory({
  userId,
  language,
}: {
  userId: string
  language: Language
}): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, mode, wpm, accuracy, started_at')
    .eq('user_id', userId)
    .eq('language', language)
    .order('started_at', { ascending: true })

  if (error)
    throw new Error(`Failed to fetch session history: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    mode: row.mode,
    wpm: row.wpm,
    accuracy: row.accuracy,
    startedAt: row.started_at,
  }))
}

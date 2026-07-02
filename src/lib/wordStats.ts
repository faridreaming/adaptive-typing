import { supabase } from '#lib/supabase'
import type { WordStat } from '#lib/scoring'

interface FetchWordStatsParams {
  userId: string
  language: 'id' | 'en'
}

/**
 * Fetches all word_stats rows for a user in a given language, mapped from
 * the DB's snake_case columns to the camelCase WordStat shape that
 * scoring.ts (calculateErrorRate, pickWeightedWords) expects.
 */
export async function fetchWordStats({
  userId,
  language,
}: FetchWordStatsParams): Promise<WordStat[]> {
  const { data, error } = await supabase
    .from('word_stats')
    .select('word, exposure_count, error_count, avg_latency_ms')
    .eq('user_id', userId)
    .eq('language', language)

  if (error) {
    throw new Error(`Failed to fetch word_stats: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    word: row.word,
    exposureCount: row.exposure_count,
    errorCount: row.error_count,
    avgLatencyMs: row.avg_latency_ms ?? 0,
  }))
}

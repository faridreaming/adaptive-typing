type Language = 'id' | 'en'

let corpusIdCache: string[] | null = null
let corpusEnCache: string[] | null = null

/**
 * Lazily loads and caches the word corpus for a language. Corpus data
 * lives in separate JSON files (not inline arrays) so it's code-split
 * from the main bundle — the word lists only get fetched once a test
 * actually needs them, not on initial app load.
 */
export async function getCorpus(language: Language): Promise<string[]> {
  if (language === 'id') {
    if (!corpusIdCache) {
      corpusIdCache = (await import('./corpus-id.json')).default
    }
    return corpusIdCache
  }

  if (!corpusEnCache) {
    corpusEnCache = (await import('./corpus-en.json')).default
  }
  return corpusEnCache
}

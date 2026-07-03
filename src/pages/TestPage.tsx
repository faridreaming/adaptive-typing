import { useState, useMemo, useRef, useEffect } from 'react'
import { getCorpus } from '#data/corpus'
import {
  calculateWpm,
  calculateAccuracy,
  pickWeightedWords,
} from '#lib/scoring'
import { saveSession } from '#lib/sessions'
import { fetchWordStats } from '#lib/wordStats'
import { useAuth } from '#hooks/useAuth'
import { Button } from '#components/ui/button'
import { Card, CardContent } from '#components/ui/card'

type Language = 'id' | 'en'
type Mode = 'normal' | 'weak_point_drill'

async function generateText(
  language: Language,
  wordCount = 20,
): Promise<string> {
  const corpus = await getCorpus(language)
  const words: string[] = []
  for (let i = 0; i < wordCount; i++) {
    words.push(corpus[Math.floor(Math.random() * corpus.length)])
  }
  return words.join(' ')
}

interface Session {
  language: Language
  mode: Mode
  targetText: string
  // True when the user picked Weak-Point Drill but has no word_stats yet
  // for this language — we silently fall back to a normal random text
  // instead of showing a broken/empty test.
  usedFallback: boolean
}

/**
 * Builds a new session. 'normal' mode is a plain random pick. For
 * 'weak_point_drill', we hit Supabase for this user's word_stats in the
 * selected language and feed that into pickWeightedWords. No history yet
 * for this language (cold start — PRD open question #2)? Fall back to a
 * normal random text rather than blocking the user.
 */
async function buildSession(
  language: Language,
  mode: Mode,
  userId: string | undefined,
): Promise<Session> {
  if (mode === 'weak_point_drill' && userId) {
    const stats = await fetchWordStats({ userId, language })
    if (stats.length > 0) {
      const words = pickWeightedWords(stats, 20)
      return {
        language,
        mode,
        targetText: words.join(' '),
        usedFallback: false,
      }
    }
  }

  return {
    language,
    mode,
    targetText: await generateText(language),
    usedFallback: mode === 'weak_point_drill',
  }
}

function createInitialSession(): Session {
  return { language: 'id', mode: 'normal', targetText: '', usedFallback: false }
}

export default function TestPage() {
  const { session: authSession } = useAuth()
  const [session, setSession] = useState<Session>(createInitialSession)
  const [input, setInput] = useState('')
  const [charHadError, setCharHadError] = useState<boolean[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [loadingSession, setLoadingSession] = useState(true)
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  const { language, mode, targetText, usedFallback } = session

  const result = useMemo(() => {
    if (!finished || !startedAt) return null
    const elapsedMs = Date.now() - startedAt
    let correctChars = 0
    for (let i = 0; i < targetText.length; i++) {
      if (input[i] === targetText[i]) correctChars++
    }
    return {
      wpm: Math.round(calculateWpm(input.length, elapsedMs)),
      accuracy: Math.round(
        calculateAccuracy(correctChars, targetText.length) * 100,
      ),
    }
  }, [finished, startedAt, input, targetText])

  useEffect(() => {
    if (!finished || !result || !startedAt || !authSession) return

    setSaveStatus('saving')
    saveSession({
      userId: authSession.user.id,
      language,
      mode,
      targetText,
      typedText: input,
      wpm: result.wpm,
      accuracy: result.accuracy,
      startedAt,
      charHadError,
    })
      .then(() => setSaveStatus('saved'))
      .catch((err) => {
        console.error(err)
        setSaveStatus('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  useEffect(() => {
    restart('id', 'normal')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleChange(value: string) {
    if (startedAt === null) setStartedAt(Date.now())

    // Only diff newly-added characters. We never clear a flag on
    // backspace — the point is remembering the mistake happened, not
    // just whether the final result looks clean.
    if (value.length > input.length) {
      setCharHadError((prev) => {
        const next = [...prev]
        for (let i = input.length; i < value.length; i++) {
          if (value[i] !== targetText[i]) next[i] = true
        }
        return next
      })
    }

    setInput(value)
    if (value.length >= targetText.length) {
      setFinished(true)
    }
  }

  async function restart(
    newLanguage: Language = language,
    newMode: Mode = mode,
  ) {
    setLoadingSession(true)
    const next = await buildSession(newLanguage, newMode, authSession?.user.id)
    setSession(next)
    setInput('')
    setStartedAt(null)
    setFinished(false)
    setSaveStatus('idle')
    setLoadingSession(false)
    setTimeout(() => inputRef.current?.focus(), 0)
    setCharHadError([])
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-4 flex gap-2">
        <Button
          variant={language === 'id' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => restart('id')}
        >
          Indonesia
        </Button>
        <Button
          variant={language === 'en' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => restart('en')}
        >
          English
        </Button>
      </div>

      <div className="mb-8 flex gap-2">
        <Button
          variant={mode === 'normal' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => restart(language, 'normal')}
        >
          Normal
        </Button>
        <Button
          variant={mode === 'weak_point_drill' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => restart(language, 'weak_point_drill')}
        >
          Weak-Point Drill
        </Button>
      </div>

      {usedFallback && (
        <p className="mb-4 text-xs text-muted-foreground">
          Belum ada histori kata lemah untuk bahasa ini — pakai teks acak dulu.
        </p>
      )}

      {loadingSession ? (
        <p className="text-sm text-muted-foreground">Menyiapkan teks...</p>
      ) : !finished ? (
        <div className="space-y-6">
          <p className="font-mono text-xl leading-relaxed tracking-wide">
            {targetText.split('').map((char, i) => {
              let colorClass = 'text-muted-foreground/50'
              if (i < input.length) {
                colorClass =
                  input[i] === char ? 'text-foreground' : 'text-destructive'
              }
              return (
                <span key={i} className={colorClass}>
                  {char}
                </span>
              )
            })}
          </p>
          <input
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 font-mono text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Mulai mengetik di sini..."
          />
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-2">
            <p className="font-mono text-3xl">
              {result?.wpm}{' '}
              <span className="text-base text-muted-foreground">WPM</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {result?.accuracy}% akurasi
            </p>
            <p className="text-xs text-muted-foreground">
              {saveStatus === 'saving' && 'Menyimpan...'}
              {saveStatus === 'saved' && 'Tersimpan.'}
              {saveStatus === 'error' && 'Gagal menyimpan, cek console.'}
            </p>
            <Button onClick={() => restart()}>Tes lagi</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

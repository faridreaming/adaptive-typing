import { useState, useMemo, useRef, useEffect } from 'react'
import { getCorpus } from '#data/corpus'
import {
  calculateWpm,
  calculateAccuracy,
  pickWeightedWords,
  getCharStatus,
} from '#lib/scoring'
import { saveSession } from '#lib/sessions'
import { fetchWordStats } from '#lib/wordStats'
import { useAuth } from '#hooks/useAuth'
import { Button } from '#components/ui/button'
import { Card, CardContent } from '#components/ui/card'

type Language = 'id' | 'en'
type Mode = 'normal' | 'weak_point_drill'

interface CommittedWord {
  word: string
  typed: string
  isError: boolean
  finalMismatch: boolean
  charHadError: boolean[] // baru — dipakai buat restore pas backspace-back
}

interface Session {
  language: Language
  mode: Mode
  targetText: string
  usedFallback: boolean
}

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
  const [loadingSession, setLoadingSession] = useState(true)
  const [finished, setFinished] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')

  // Per-word state machine — replaces the old single-string comparison.
  const [committedWords, setCommittedWords] = useState<CommittedWord[]>([])
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [currentInput, setCurrentInput] = useState('')
  const [currentCharHadError, setCurrentCharHadError] = useState<boolean[]>([])
  const [currentWordHadPriorMismatch, setCurrentWordHadPriorMismatch] =
    useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const { language, mode, targetText, usedFallback } = session
  const targetWords = useMemo(
    () => targetText.split(' ').filter(Boolean),
    [targetText],
  )
  const currentTargetWord = targetWords[currentWordIndex] ?? ''

  const result = useMemo(() => {
    if (!finished || !startedAt) return null
    const elapsedMs = Date.now() - startedAt
    const totalChars = committedWords.reduce(
      (sum, w) => sum + w.typed.length + 1,
      0,
    )

    // Char-level accuracy: for each target word, count positions that were
    // both never mistyped (charHadError[i] === false) AND match the final
    // submitted char. This deliberately doesn't account for
    // currentWordHadPriorMismatch — a word redone correctly after a failed
    // first submission still scores 100% here; that "it went wrong once"
    // signal already lives in word_stats.error_count and the amber color,
    // so it's not double-counted into this precision metric.
    let correctChars = 0
    let totalTargetChars = 0
    for (const w of committedWords) {
      totalTargetChars += w.word.length
      for (let i = 0; i < w.word.length; i++) {
        if (!w.charHadError[i] && w.typed[i] === w.word[i]) correctChars++
      }
    }

    return {
      wpm: Math.round(calculateWpm(totalChars, elapsedMs)),
      accuracy: Math.round(
        calculateAccuracy(correctChars, totalTargetChars) * 100,
      ),
    }
  }, [finished, startedAt, committedWords])

  useEffect(() => {
    if (!finished || !result || !startedAt || !authSession) return
    setSaveStatus('saving')
    saveSession({
      userId: authSession.user.id,
      language,
      mode,
      wpm: result.wpm,
      accuracy: result.accuracy,
      startedAt,
      wordResults: committedWords.map(({ word, isError }) => ({
        word,
        isError,
      })),
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

  function commitWord(typed: string, charHadError: boolean[]) {
    const word = currentTargetWord
    const finalMismatch = typed !== word
    const isError =
      finalMismatch || charHadError.some(Boolean) || currentWordHadPriorMismatch

    setCommittedWords((prev) => [
      ...prev,
      { word, typed, isError, finalMismatch, charHadError },
    ])
    setCurrentInput('')
    setCurrentCharHadError([])
    setCurrentWordHadPriorMismatch(false) // reset — flag ini scope-nya per kata

    const nextIndex = currentWordIndex + 1
    setCurrentWordIndex(nextIndex)
    if (nextIndex >= targetWords.length) setFinished(true)
  }

  function handleChange(value: string) {
    if (startedAt === null) setStartedAt(Date.now())

    let updatedErrors = currentCharHadError
    if (value.length > currentInput.length) {
      updatedErrors = [...currentCharHadError]
      for (let i = currentInput.length; i < value.length; i++) {
        if (value[i] !== currentTargetWord[i]) updatedErrors[i] = true
      }
      setCurrentCharHadError(updatedErrors)
    }

    setCurrentInput(value)

    // Last word has no trailing space to commit on — auto-commit once
    // its length reaches the target.
    const isLastWord = currentWordIndex === targetWords.length - 1
    if (isLastWord && value.length >= currentTargetWord.length) {
      commitWord(value, updatedErrors)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (
      e.key === 'Backspace' &&
      currentInput.length === 0 &&
      committedWords.length > 0
    ) {
      const lastWord = committedWords[committedWords.length - 1]
      if (lastWord.finalMismatch) {
        e.preventDefault()
        uncommitLastWord()
      }
      // kalau lastWord benar, sengaja dibiarin — backspace berhenti di sini
      return
    }

    if (e.key === ' ') {
      e.preventDefault()
      if (currentInput.length === 0) return
      commitWord(currentInput, currentCharHadError)
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      restart()
    }
  }

  function uncommitLastWord() {
    const last = committedWords[committedWords.length - 1]
    setCommittedWords((prev) => prev.slice(0, -1))
    setCurrentWordIndex((i) => i - 1)
    setCurrentInput(last.typed)
    setCurrentCharHadError(last.charHadError)
    setCurrentWordHadPriorMismatch(true) // kata ini pernah gagal submit — jangan lupa walau attempt kedua bener
  }

  async function restart(
    newLanguage: Language = language,
    newMode: Mode = mode,
  ) {
    setLoadingSession(true)
    const next = await buildSession(newLanguage, newMode, authSession?.user.id)
    setSession(next)
    setCommittedWords([])
    setCurrentWordIndex(0)
    setCurrentInput('')
    setCurrentCharHadError([])
    setStartedAt(null)
    setFinished(false)
    setSaveStatus('idle')
    setLoadingSession(false)
    setTimeout(() => inputRef.current?.focus(), 0)
    setCurrentWordHadPriorMismatch(false)
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
            {committedWords.map((w, i) => {
              const colorClass = w.finalMismatch
                ? 'text-destructive'
                : w.isError
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-foreground'
              return (
                <span key={i} className={colorClass}>
                  {w.word}{' '}
                </span>
              )
            })}

            {currentTargetWord &&
              currentTargetWord.split('').map((char, i) => {
                const status = getCharStatus(i, currentInput, currentTargetWord)
                const colorClass =
                  status === 'pending'
                    ? 'text-muted-foreground/50'
                    : status === 'correct'
                      ? 'text-foreground'
                      : 'text-destructive'
                return (
                  <span key={i} className={colorClass}>
                    {char}
                  </span>
                )
              })}
            {currentInput.length > currentTargetWord.length && (
              <span className="text-destructive underline">
                {currentInput.slice(currentTargetWord.length)}
              </span>
            )}
            {currentTargetWord && ' '}

            {targetWords.slice(currentWordIndex + 1).map((word, i) => (
              <span key={i} className="text-muted-foreground/50">
                {word}{' '}
              </span>
            ))}
          </p>
          <input
            ref={inputRef}
            autoFocus
            value={currentInput}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 font-mono text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Mulai mengetik..."
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Tekan Tab untuk reset cepat.
          </p>
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

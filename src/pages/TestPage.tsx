import { useState, useMemo, useRef } from 'react'
import { corpusId, corpusEn } from '#data/corpus'
import { calculateWpm, calculateAccuracy } from '#lib/scoring'
import { Button } from '#components/ui/button'
import { Card, CardContent } from '#components/ui/card'

type Language = 'id' | 'en'

function generateText(language: Language, wordCount = 20): string {
  const corpus = language === 'id' ? corpusId : corpusEn
  const words: string[] = []
  for (let i = 0; i < wordCount; i++) {
    words.push(corpus[Math.floor(Math.random() * corpus.length)])
  }
  return words.join(' ')
}

interface Session {
  language: Language
  targetText: string
}

function createSession(language: Language): Session {
  return { language, targetText: generateText(language) }
}

export default function TestPage() {
  const [session, setSession] = useState<Session>(() => createSession('id'))
  const [input, setInput] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { language, targetText } = session

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

  function handleChange(value: string) {
    if (startedAt === null) setStartedAt(Date.now())
    setInput(value)
    if (value.length >= targetText.length) {
      setFinished(true)
    }
  }

  function restart(newLanguage: Language = language) {
    setSession(createSession(newLanguage))
    setInput('')
    setStartedAt(null)
    setFinished(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-8 flex gap-2">
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

      {!finished ? (
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
            <Button onClick={() => restart()}>Tes lagi</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { useState, useMemo, useRef } from 'react'
import { corpusId, corpusEn } from '../data/corpus'
import { calculateWpm, calculateAccuracy } from '../lib/scoring'

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
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => restart('id')}
          className={`px-3 py-1 rounded ${language === 'id' ? 'bg-white text-black' : 'bg-neutral-800'}`}
        >
          Indonesia
        </button>
        <button
          onClick={() => restart('en')}
          className={`px-3 py-1 rounded ${language === 'en' ? 'bg-white text-black' : 'bg-neutral-800'}`}
        >
          English
        </button>
      </div>

      {!finished ? (
        <>
          <p className="font-mono text-lg mb-4 leading-relaxed">
            {targetText.split('').map((char, i) => {
              let colorClass = 'text-neutral-500'
              if (i < input.length) {
                colorClass =
                  input[i] === char ? 'text-green-400' : 'text-red-400'
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
            className="w-full bg-neutral-900 border border-neutral-700 rounded p-3 font-mono"
            placeholder="Mulai mengetik di sini..."
          />
        </>
      ) : (
        <div>
          <p className="text-2xl mb-2">
            {result?.wpm} WPM · {result?.accuracy}% akurasi
          </p>
          <button
            onClick={() => restart()}
            className="mt-4 px-4 py-2 bg-white text-black rounded"
          >
            Tes lagi
          </button>
        </div>
      )}
    </div>
  )
}

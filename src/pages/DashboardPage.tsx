import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '#hooks/useAuth'
import {
  fetchWeakestWords,
  fetchSessionHistory,
  type WeakWord,
  type SessionSummary,
} from '#lib/dashboard'
import { Button } from '#components/ui/button'

type Language = 'id' | 'en'

export default function DashboardPage() {
  const { session: authSession } = useAuth()
  const [language, setLanguage] = useState<Language>('id')
  const [weakWords, setWeakWords] = useState<WeakWord[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const userId = authSession?.user.id
    if (!userId) return

    setLoading(true)
    setError(null)

    Promise.all([
      fetchWeakestWords({ userId, language }),
      fetchSessionHistory({ userId, language }),
    ])
      .then(([words, history]) => {
        setWeakWords(words)
        setSessions(history)
      })
      .catch((err) => {
        console.error(err)
        setError('Gagal memuat data dashboard.')
      })
      .finally(() => setLoading(false))
  }, [authSession, language])

  const chartData = sessions.map((s, i) => ({
    index: i + 1,
    date: new Date(s.startedAt).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
    }),
    wpmNormal: s.mode === 'normal' ? s.wpm : null,
    wpmDrill: s.mode === 'weak_point_drill' ? s.wpm : null,
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <Button
            variant={language === 'id' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLanguage('id')}
          >
            Indonesia
          </Button>
          <Button
            variant={language === 'en' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLanguage('en')}
          >
            English
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <>
          <section>
            <h2 className="mb-3 text-lg font-medium">
              Trend WPM ({sessions.length} sesi)
            </h2>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada sesi untuk bahasa ini.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="wpmNormal"
                    name="Normal"
                    stroke="#8884d8"
                    connectNulls={false}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wpmDrill"
                    name="Weak-Point Drill"
                    stroke="#f97316"
                    connectNulls={false}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium">Kata terlemah</h2>
            {weakWords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada data kata untuk bahasa ini.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 font-normal">Kata</th>
                    <th className="py-2 font-normal">Error rate</th>
                    <th className="py-2 font-normal">Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {weakWords.map((w) => (
                    <tr key={w.word} className="border-b border-border/50">
                      <td className="py-2 font-mono">{w.word}</td>
                      <td className="py-2">{Math.round(w.errorRate * 100)}%</td>
                      <td className="py-2 text-muted-foreground">
                        {w.exposureCount}x ({w.errorCount} salah)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  )
}
import { useState } from 'react'
import { supabase } from '#lib/supabase'
import { Button } from '#components/ui/button'
import { Card, CardContent } from '#components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }

    setStatus('sent')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm items-center p-8">
      <Card className="w-full">
        <CardContent className="space-y-4 py-2">
          <h1 className="font-mono text-lg">adaptive-typing</h1>

          {status === 'sent' ? (
            <p className="text-sm text-muted-foreground">
              Link login sudah dikirim ke{' '}
              <span className="text-foreground">{email}</span>. Cek inbox (atau
              folder spam) kamu.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@kamu.com"
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button
                type="submit"
                disabled={status === 'sending'}
                className="w-full"
              >
                {status === 'sending' ? 'Mengirim...' : 'Kirim magic link'}
              </Button>
              {status === 'error' && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

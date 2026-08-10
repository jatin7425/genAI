import { useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'

type LoginScreenProps = {
  onLogin: (username: string, password: string) => Promise<void>
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onLogin(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-dvh w-screen flex items-center justify-center bg-background p-gutter">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-surface border border-outline-variant rounded-xl p-stack-md flex flex-col gap-stack-sm shadow-lg"
      >
        <div className="flex flex-col items-center gap-2 mb-stack-sm">
          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center border border-outline-variant">
            <Icon name="lock" filled className="text-primary text-[28px]" />
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Cortex Labs</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Sign in to continue</p>
        </div>

        <div className="space-y-unit">
          <label className="font-label-caps text-label-caps text-on-surface-variant">USERNAME</label>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Username"
            type="text"
            autoComplete="username"
          />
        </div>

        <div className="space-y-unit">
          <label className="font-label-caps text-label-caps text-on-surface-variant">PASSWORD</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Password"
            type="password"
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-error text-sm">{error}</p>}

        <button
          type="submit"
          disabled={!username.trim() || !password || submitting}
          className="mt-unit w-full py-2 bg-primary text-on-primary rounded-lg font-body-md text-body-md font-medium hover:bg-primary-fixed transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

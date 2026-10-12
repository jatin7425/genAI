import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'

export function LoginScreen() {
  const { login } = useAuth()
  const navigate = useNavigate()

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
      await login(username.trim(), password)
      navigate('/chat', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-story">
        <div className="flex items-center gap-3 text-xl font-semibold"><Icon name="graphic_eq" className="text-[30px]" /> Cortex<span className="text-[10px] uppercase tracking-widest ml-2 opacity-60">Your thinking partner</span></div>
        <div className="relative z-10 my-10 max-w-lg">
          <p className="text-xs tracking-[0.16em] uppercase text-[#b8d6b5] mb-6">Space to think. Room to grow.</p>
          <h1 className="font-serif text-4xl md:text-6xl leading-[1.12] tracking-tight">Great things start<br />with a conversation.</h1>
          <p className="mt-6 text-sm md:text-base text-[#b8cdbd] max-w-sm leading-relaxed">Explore ideas, work through questions, and make sense of what’s next. Your workspace for a clearer way forward.</p>
          <div className="mt-8 flex flex-wrap gap-3 text-xs text-[#d5e3d0]">
            <span className="flex gap-2 items-center"><Icon name="travel_explore" className="text-[15px]" /> Explore</span>
            <span className="opacity-40">/</span>
            <span className="flex gap-2 items-center"><Icon name="code" className="text-[15px]" /> Create</span>
            <span className="opacity-40">/</span>
            <span className="flex gap-2 items-center"><Icon name="lightbulb" className="text-[15px]" /> Understand</span>
          </div>
        </div>
        <footer className="text-xs opacity-50">A little clarity. A lot of possibility.</footer>
      </section>
      <section className="login-form-area">
        <form onSubmit={handleSubmit} className="login-form flex flex-col gap-5">
          <div className="mb-3">
            <div className="w-11 h-11 rounded-xl bg-surface-container-high text-primary grid place-items-center mb-6"><Icon name="lock" className="text-[21px]" /></div>
            <h2 className="text-3xl font-semibold tracking-tight">Welcome back.</h2>
            <p className="mt-3 text-sm text-on-surface-variant">Sign in and pick up where your curiosity left off.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="username" className="text-xs font-medium">Username</label>
            <input id="username" autoFocus required value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Enter your username" type="text" autoComplete="username" />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium">Password</label>
            <input id="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Enter your password" type="password" autoComplete="current-password" />
          </div>
          {error && <p role="alert" className="text-error text-sm bg-error/10 rounded-lg p-3">{error}</p>}
          <button type="submit" disabled={!username.trim() || !password || submitting} className="mt-1 w-full py-3.5 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary-fixed transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
            {submitting ? 'Signing in…' : 'Enter your workspace'}<Icon name={submitting ? 'progress_activity' : 'arrow_forward'} className={`text-[17px] ${submitting ? 'animate-spin' : ''}`} />
          </button>
          <p className="mt-3 text-xs text-center text-on-surface-variant leading-relaxed">Your ideas deserve a little room.<br />Let’s give them some.</p>
        </form>
      </section>
    </div>
  )
}

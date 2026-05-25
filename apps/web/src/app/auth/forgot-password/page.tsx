'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast } from '@/components/ui/Toast'

// Per-browser cooldown between reset attempts. Supabase's built-in SMTP enforces
// a global 4-emails-per-hour-per-IP limit, so we throttle the user before they
// hit that wall — otherwise the friendly success message tricks them into
// resending and the next attempts silently fail server-side.
const COOLDOWN_SECONDS = 60
const COOLDOWN_KEY = 'airtrainr_forgot_pw_cooldown_until'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  useEffect(() => {
    const tick = () => {
      const until = Number(localStorage.getItem(COOLDOWN_KEY) || 0)
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      setCooldownRemaining(remaining)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { toast.error('Please enter your email'); return }
    if (cooldownRemaining > 0) {
      toast.error(`Please wait ${cooldownRemaining}s before requesting another link`)
      return
    }
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (resetError) throw resetError
      localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_SECONDS * 1000))
      setSent(true)
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : ''
      // Supabase surfaces rate-limit errors with this exact phrase. Translate
      // it into something the user can act on instead of a copy-paste of the
      // backend string. The IP-level limit resets after roughly an hour.
      if (/rate limit/i.test(raw)) {
        toast.error('Too many reset attempts from this network. Please wait about an hour, or try from a different connection.')
      } else {
        toast.error(raw || 'Failed to send reset email')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <div className="mb-8">
          <Link href="/auth/login" className="text-zinc-400 text-sm hover:text-white flex items-center gap-2 mb-6">
            ← Back to login
          </Link>
          <h1 className="text-white text-2xl font-bold mb-2">Reset Password</h1>
          <p className="text-zinc-400 text-sm">Enter your email and we&apos;ll send you a reset link.</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-green-400 text-sm">
              ✓ If an account exists for that email, a reset link is on its way. The link expires shortly, so use it soon.
            </div>
            <p className="text-zinc-500 text-xs text-center">
              {cooldownRemaining > 0
                ? `You can request another link in ${cooldownRemaining}s.`
                : "Didn't get it? Check spam, then try again."}
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              disabled={cooldownRemaining > 0}
              className="w-full text-zinc-300 text-sm py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldownRemaining > 0 ? `Resend in ${cooldownRemaining}s` : 'Send another link'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-zinc-300 text-sm font-medium mb-2">Email Address</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-white text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || cooldownRemaining > 0}
              className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Sending...'
                : cooldownRemaining > 0
                  ? `Try again in ${cooldownRemaining}s`
                  : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

type Status = 'verifying' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Supabase's recovery link is delivered as `#access_token=...&type=recovery`.
  // The supabase-js client auto-detects it and fires `PASSWORD_RECOVERY` once
  // the session is exchanged. We accept either: an existing session (already
  // exchanged) or the explicit event, before letting the user submit.
  useEffect(() => {
    let cancelled = false

    // If we landed here with no recovery hash AND no existing session, the
    // user opened this page directly — declare invalid up front instead of
    // showing a misleading "verifying" spinner.
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const looksLikeRecovery = /access_token=|type=recovery|error_code=|error=/i.test(hash)

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        setStatus('ready')
        return
      }
      if (!looksLikeRecovery) {
        setStatus('invalid')
      }
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setStatus('ready')
      }
    })

    // Generous grace period for slow networks: only fall through to "invalid"
    // if we actually saw a recovery hash but the exchange never completed.
    const timeout = setTimeout(() => {
      setStatus(prev => (prev === 'verifying' ? 'invalid' : prev))
    }, looksLikeRecovery ? 6000 : 1500)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      // Sign out the recovery session so the user logs in fresh with the new
      // password — this also clears any half-built airtrainr_session in
      // localStorage from the previous account state.
      await supabase.auth.signOut()
      setStatus('done')
      toast.success('Password updated. You can now log in.')
      setTimeout(() => router.replace('/auth/login'), 1500)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <div className="mb-8">
          <Link href="/auth/login" className="text-zinc-400 text-sm hover:text-white flex items-center gap-2 mb-6">
            ← Back to login
          </Link>
          <h1 className="text-white text-2xl font-bold mb-2">Set a New Password</h1>
          <p className="text-zinc-400 text-sm">
            Choose a new password for your AirTrainr account. You&apos;ll be signed in with this password.
          </p>
        </div>

        {status === 'verifying' && (
          <div className="text-zinc-400 text-sm py-6 text-center">Verifying reset link&hellip;</div>
        )}

        {status === 'invalid' && (
          <div className="space-y-4">
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
              This reset link is invalid or has expired. Reset links can only be used once and expire after a short time.
            </div>
            <Link
              href="/auth/forgot-password"
              className="block w-full text-center bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Request a new link
            </Link>
          </div>
        )}

        {status === 'done' && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-green-400 text-sm">
            ✓ Password updated. Redirecting you to login&hellip;
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-zinc-300 text-sm font-medium mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-4 pr-12 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-white text-sm"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 text-sm font-medium mb-2">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-white text-sm"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

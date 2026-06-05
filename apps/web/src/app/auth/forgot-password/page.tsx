'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

// Per-browser cooldown between reset attempts. Supabase's built-in SMTP enforces
// a global 4-emails-per-hour-per-IP cap; throttling the user keeps the friendly
// success message from tricking them into resending past the wall.
const RESEND_COOLDOWN_SECONDS = 30
const COOLDOWN_KEY = 'airtrainr_forgot_pw_cooldown_until'

export default function ForgotPasswordPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const [cooldown, setCooldown] = useState(0)
    const [touched, setTouched] = useState(false)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const emailValid = emailRegex.test(email)

    // Hydrate cooldown from localStorage on mount so closing the tab and
    // reopening doesn't reset the throttle.
    useEffect(() => {
        const until = Number(localStorage.getItem(COOLDOWN_KEY) || 0)
        const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000))
        if (remaining > 0) setCooldown(remaining)
    }, [])

    useEffect(() => {
        if (cooldown <= 0) return
        const t = setTimeout(() => setCooldown(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [cooldown])

    const sendResetEmail = async () => {
        if (!emailValid) {
            toast.error('Please enter a valid email address')
            setTouched(true)
            return
        }
        if (cooldown > 0) {
            toast.error(`Please wait ${cooldown}s before requesting another link`)
            return
        }
        setLoading(true)
        try {
            console.log('[forgot-password] Sending reset email to:', email.trim())
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            })
            if (resetError) {
                console.error('[forgot-password] Supabase error:', {
                    message: resetError.message,
                    status: (resetError as any).status,
                    code: (resetError as any).code,
                    full: resetError,
                })
                throw resetError
            }
            console.log('[forgot-password] Email sent successfully')
            setSent(true)
            setCooldown(RESEND_COOLDOWN_SECONDS)
            localStorage.setItem(COOLDOWN_KEY, String(Date.now() + RESEND_COOLDOWN_SECONDS * 1000))
            toast.success('Reset link sent — check your inbox')
        } catch (err: unknown) {
            const raw = err instanceof Error ? err.message : ''
            console.error('[forgot-password] Caught error:', {
                message: raw,
                type: typeof err,
                full: err,
            })
            if (/rate limit/i.test(raw)) {
                toast.error('Too many reset attempts from this network. Please wait about an hour, or try from a different connection.')
            } else {
                toast.error(raw || 'Failed to send reset email')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        sendResetEmail()
    }

    return (
        <div className="flex flex-col md:grid md:grid-cols-2" style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'white', fontFamily: 'var(--font-sans)' }}>

            {/* Left branding */}
            <div className="hidden md:flex" style={{ position: 'relative' }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: "linear-gradient(to right, rgba(9,9,11,0.2), rgba(9,9,11,0.9)), url('https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1470&auto=format&fit=crop')",
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px'
                }}>
                    <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', background: 'var(--zinc-900)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img src="/logo.jpeg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <span style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>AirTrainr</span>
                    </a>

                    <div>
                        <h1 style={{ fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 900, fontFamily: 'var(--font-display)', textTransform: 'uppercase', lineHeight: 1, marginBottom: '24px' }}>
                            <span style={{ fontStyle: 'italic', color: 'white' }}>FORGOT YOUR</span><br />
                            <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>PASSWORD?</span>
                        </h1>
                        <p style={{ fontSize: '18px', color: 'var(--gray-300)', maxWidth: '400px', lineHeight: 1.6 }}>
                            No worries. Enter your email and we&apos;ll send you a secure link to reset it.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: 'var(--gray-400)' }}>
                        <span>© 2026 Airtrainr</span>
                    </div>
                </div>
            </div>

            {/* Right form */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} className="w-full px-4 sm:px-8 md:px-12">
                <div style={{ width: '100%', maxWidth: '440px' }}>

                    {/* Mobile logo */}
                    <div className="md:hidden" style={{ marginBottom: '40px' }}>
                        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', background: 'var(--zinc-900)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <img src="/logo.jpeg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <span style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>AirTrainr</span>
                        </a>
                    </div>

                    <button
                        onClick={() => router.push('/auth/login')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: '13px', cursor: 'pointer', marginBottom: '24px', padding: 0 }}
                    >
                        <ArrowLeft size={14} /> Back to login
                    </button>

                    {!sent ? (
                        <>
                            <div style={{ marginBottom: '40px' }}>
                                <h2 style={{ fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 900, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Reset Password</h2>
                                <p style={{ color: 'var(--gray-400)', fontSize: '14px' }}>Enter your email address and we&apos;ll send you a link to reset your password.</p>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', color: 'var(--gray-300)' }}>Email Address</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            onBlur={() => setTouched(true)}
                                            placeholder="name@domain.com"
                                            required
                                            autoFocus
                                            style={{
                                                width: '100%', padding: '16px', paddingLeft: '40px',
                                                borderRadius: '12px',
                                                border: `1px solid ${touched && email && !emailValid ? '#ef4444' : 'var(--gray-800)'}`,
                                                background: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '15px', outline: 'none', transition: 'all 0.2s'
                                            }}
                                        />
                                        <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-500)' }} />
                                    </div>
                                    {touched && email && !emailValid && (
                                        <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <AlertCircle size={12} /> Please enter a valid email address
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !emailValid || cooldown > 0}
                                    style={{
                                        width: '100%', padding: '16px', borderRadius: '12px',
                                        background: (loading || !emailValid || cooldown > 0) ? 'var(--gray-700)' : 'var(--primary)',
                                        color: 'var(--color-bg)', border: 'none', fontWeight: 800,
                                        fontSize: '15px', textTransform: 'uppercase', letterSpacing: '1px',
                                        cursor: (loading || !emailValid || cooldown > 0) ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    {loading
                                        ? 'Sending...'
                                        : cooldown > 0
                                            ? `Try again in ${cooldown}s`
                                            : <><Send size={16} /> Send Reset Link</>
                                    }
                                </button>
                            </form>

                            <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '13px', color: 'var(--gray-400)' }}>
                                Remember your password? <a href="/auth/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>Log in</a>
                            </p>
                        </>
                    ) : (
                        <>
                            <div style={{ marginBottom: '32px' }}>
                                <div style={{
                                    width: '64px', height: '64px', borderRadius: '50%',
                                    background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
                                }}>
                                    <CheckCircle2 size={28} style={{ color: '#22c55e' }} />
                                </div>
                                <h2 style={{ fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 900, fontFamily: 'var(--font-display)', marginBottom: '12px' }}>Check Your Inbox</h2>
                                <p style={{ color: 'var(--gray-400)', fontSize: '14px', lineHeight: 1.7 }}>
                                    We sent a password reset link to<br />
                                    <strong style={{ color: 'white' }}>{email}</strong>
                                </p>
                            </div>

                            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gray-800)', borderRadius: '12px', marginBottom: '24px' }}>
                                <p style={{ fontSize: '13px', color: 'var(--gray-300)', lineHeight: 1.6, marginBottom: '12px' }}>
                                    <strong style={{ color: 'white' }}>Didn&apos;t receive the email?</strong>
                                </p>
                                <ul style={{ fontSize: '12px', color: 'var(--gray-400)', lineHeight: 1.7, paddingLeft: '18px', margin: 0 }}>
                                    <li>Check your spam or junk folder</li>
                                    <li>Make sure the email address is correct</li>
                                    <li>Links expire after 1 hour</li>
                                </ul>
                            </div>

                            <button
                                onClick={sendResetEmail}
                                disabled={loading || cooldown > 0}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: '12px',
                                    background: (loading || cooldown > 0) ? 'var(--gray-700)' : 'var(--primary)',
                                    color: 'var(--color-bg)', border: 'none', fontWeight: 800,
                                    fontSize: '15px', textTransform: 'uppercase', letterSpacing: '1px',
                                    cursor: (loading || cooldown > 0) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    marginBottom: '12px'
                                }}
                            >
                                {loading
                                    ? 'Resending...'
                                    : cooldown > 0
                                        ? `Resend in ${cooldown}s`
                                        : <><Send size={16} /> Resend Email</>
                                }
                            </button>

                            <button
                                onClick={() => { setSent(false); setEmail(''); setTouched(false); setCooldown(0); localStorage.removeItem(COOLDOWN_KEY) }}
                                style={{
                                    width: '100%', padding: '14px', borderRadius: '12px',
                                    background: 'transparent', color: 'var(--gray-300)', border: '1px solid var(--gray-800)',
                                    fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                Use a different email
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

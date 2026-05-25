"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, XCircle, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import PasswordStrengthMeter, { isPasswordValid } from "@/components/auth/PasswordStrengthMeter";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [pageState, setPageState] = useState<"loading" | "invalid" | "form" | "success">("loading");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [capsLockOn, setCapsLockOn] = useState(false);

    const passwordValid = isPasswordValid(password);
    const passwordsMatch = password && confirmPassword && password === confirmPassword;

    useEffect(() => {
        const handleReset = async () => {
            try {
                // PKCE flow — code in query params
                const params = new URLSearchParams(window.location.search);
                const code = params.get("code");
                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                    setPageState("form");
                    return;
                }

                // Hash flow — listen for PASSWORD_RECOVERY event
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (event === "PASSWORD_RECOVERY" && session) {
                        setPageState("form");
                    }
                });

                // Fallback: check existing session
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setPageState("form");
                    return () => subscription.unsubscribe();
                }

                // No valid token found after 3s → invalid
                const timeout = setTimeout(() => setPageState("invalid"), 3000);
                return () => {
                    subscription.unsubscribe();
                    clearTimeout(timeout);
                };
            } catch {
                setPageState("invalid");
            }
        };

        handleReset();
    }, []);

    // Countdown after success
    useEffect(() => {
        if (pageState !== "success") return;
        if (countdown === 0) { router.push("/auth/login"); return; }
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [pageState, countdown, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordValid) { toast.error("Password does not meet all requirements"); return; }
        if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }

        setSubmitting(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            await supabase.auth.signOut();
            setPageState("success");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to reset password");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col md:grid md:grid-cols-2" style={{ minHeight: "100vh", background: "var(--color-bg)", color: "white", fontFamily: "var(--font-sans)" }}>

            {/* ── Left Branding Panel ── */}
            <div className="hidden md:flex" style={{ position: "relative" }}>
                <div style={{
                    position: "absolute", inset: 0,
                    backgroundImage: "linear-gradient(to right, rgba(9,9,11,0.2), rgba(9,9,11,0.9)), url('https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1470&auto=format&fit=crop')",
                    backgroundSize: "cover", backgroundPosition: "center",
                    display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px"
                }}>
                    <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", background: "var(--zinc-900)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <img src="/logo.jpeg" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <span style={{ fontSize: "20px", fontWeight: 900, fontFamily: "var(--font-display)", color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>AirTrainr</span>
                    </a>

                    <div>
                        <h1 style={{ fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", lineHeight: 1, marginBottom: "24px" }}>
                            <span style={{ fontStyle: "italic", color: "white" }}>SECURE YOUR</span><br />
                            <span style={{ fontStyle: "italic", color: "var(--primary)" }}>ACCOUNT.</span>
                        </h1>
                        <p style={{ fontSize: "18px", color: "var(--gray-300)", maxWidth: "400px", lineHeight: 1.6 }}>
                            Choose a strong password to keep your training data safe.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: "24px", fontSize: "12px", color: "var(--gray-400)" }}>
                        <span>© 2026 Airtrainr</span>
                        <a href="/legal/privacy" style={{ color: "var(--gray-400)", textDecoration: "none" }}>Privacy Policy</a>
                    </div>
                </div>
            </div>

            {/* ── Right Form Panel ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} className="w-full px-4 sm:px-8 md:px-12">
                <div style={{ width: "100%", maxWidth: "440px" }}>

                    {/* Mobile Logo */}
                    <div className="md:hidden" style={{ marginBottom: "40px" }}>
                        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", background: "var(--zinc-900)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                <img src="/logo.jpeg" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                            <span style={{ fontSize: "20px", fontWeight: 900, fontFamily: "var(--font-display)", color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>AirTrainr</span>
                        </a>
                    </div>

                    {/* ── LOADING ── */}
                    {pageState === "loading" && (
                        <div style={{ textAlign: "center", padding: "48px 0" }}>
                            <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "3px solid var(--gray-800)", borderTop: "3px solid var(--primary)", animation: "spin 0.8s linear infinite", margin: "0 auto 24px" }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            <p style={{ color: "var(--gray-400)", fontSize: "15px" }}>Verifying reset link...</p>
                        </div>
                    )}

                    {/* ── INVALID TOKEN ── */}
                    {pageState === "invalid" && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
                                <XCircle size={32} style={{ color: "#ef4444" }} />
                            </div>
                            <h2 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "12px" }}>Link Expired</h2>
                            <p style={{ color: "var(--gray-400)", fontSize: "14px", marginBottom: "32px", lineHeight: 1.7 }}>
                                This password reset link has expired or is invalid.<br />Reset links are only valid for <strong style={{ color: "white" }}>1 hour</strong>.
                            </p>
                            <a href="/auth/forgot-password" style={{
                                display: "block", textAlign: "center", padding: "16px 24px",
                                background: "var(--primary)", color: "var(--color-bg)",
                                borderRadius: "12px", fontWeight: 800, fontSize: "14px",
                                textDecoration: "none", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px"
                            }}>
                                Request New Link
                            </a>
                            <a href="/auth/login" style={{ display: "block", textAlign: "center", color: "var(--gray-400)", fontSize: "13px", textDecoration: "none" }}>
                                ← Back to Login
                            </a>
                        </div>
                    )}

                    {/* ── FORM ── */}
                    {pageState === "form" && (
                        <>
                            <div style={{ marginBottom: "40px" }}>
                                <h2 style={{ fontSize: "clamp(24px, 6vw, 32px)", fontWeight: 900, fontFamily: "var(--font-display)", marginBottom: "8px" }}>Set New Password</h2>
                                <p style={{ color: "var(--gray-400)", fontSize: "14px" }}>Choose a strong password for your account</p>
                            </div>

                            <form onSubmit={handleSubmit}>

                                {/* New Password */}
                                <div style={{ marginBottom: "20px" }}>
                                    <label style={{ display: "block", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", color: "var(--gray-300)" }}>New Password</label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            onKeyUp={e => setCapsLockOn(e.getModifierState && e.getModifierState("CapsLock"))}
                                            placeholder="Choose a strong password"
                                            required
                                            autoComplete="new-password"
                                            style={{
                                                width: "100%", padding: "16px", paddingRight: "48px",
                                                borderRadius: "12px",
                                                border: `1px solid ${password && !passwordValid ? "#f59e0b" : password && passwordValid ? "#22c55e" : "var(--gray-800)"}`,
                                                background: "rgba(255,255,255,0.03)", color: "white",
                                                fontSize: "15px", outline: "none", transition: "all 0.2s"
                                            }}
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                            style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--gray-500)", cursor: "pointer", display: "flex" }}>
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    {capsLockOn && (
                                        <p style={{ fontSize: "12px", color: "#f59e0b", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                                            <AlertCircle size={12} /> Caps Lock is on
                                        </p>
                                    )}
                                    <PasswordStrengthMeter password={password} />
                                </div>

                                {/* Confirm Password */}
                                <div style={{ marginBottom: "28px" }}>
                                    <label style={{ display: "block", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", color: "var(--gray-300)" }}>Confirm Password</label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type={showConfirm ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            placeholder="Re-enter your password"
                                            required
                                            autoComplete="new-password"
                                            style={{
                                                width: "100%", padding: "16px", paddingRight: "48px",
                                                borderRadius: "12px",
                                                border: `1px solid ${confirmPassword && !passwordsMatch ? "#ef4444" : passwordsMatch ? "#22c55e" : "var(--gray-800)"}`,
                                                background: "rgba(255,255,255,0.03)", color: "white",
                                                fontSize: "15px", outline: "none", transition: "all 0.2s"
                                            }}
                                        />
                                        <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                            aria-label={showConfirm ? "Hide password" : "Show password"}
                                            style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--gray-500)", cursor: "pointer", display: "flex" }}>
                                            {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    {confirmPassword && !passwordsMatch && (
                                        <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                                            <AlertCircle size={12} /> Passwords do not match
                                        </p>
                                    )}
                                    {passwordsMatch && (
                                        <p style={{ fontSize: "12px", color: "#22c55e", marginTop: "6px" }}>✓ Passwords match</p>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submitting || !passwordValid || !passwordsMatch}
                                    style={{
                                        width: "100%", padding: "16px", borderRadius: "12px",
                                        background: (submitting || !passwordValid || !passwordsMatch) ? "var(--gray-700)" : "var(--primary)",
                                        color: "var(--color-bg)", border: "none", fontWeight: 800,
                                        fontSize: "15px", textTransform: "uppercase", letterSpacing: "1px",
                                        cursor: (submitting || !passwordValid || !passwordsMatch) ? "not-allowed" : "pointer",
                                        transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                                    }}
                                >
                                    {submitting
                                        ? "Updating Password..."
                                        : <><span>Reset Password</span><ArrowRight size={16} /></>
                                    }
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── SUCCESS ── */}
                    {pageState === "success" && (
                        <div style={{ textAlign: "center" }}>
                            <div style={{
                                width: "80px", height: "80px", borderRadius: "50%",
                                background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                margin: "0 auto 28px", animation: "popIn 0.4s ease"
                            }}>
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <style>{`
                                @keyframes popIn {
                                    from { transform: scale(0.5); opacity: 0; }
                                    to   { transform: scale(1);   opacity: 1; }
                                }
                            `}</style>
                            <h2 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "12px" }}>Password Updated!</h2>
                            <p style={{ color: "var(--gray-400)", fontSize: "14px", marginBottom: "32px", lineHeight: 1.7 }}>
                                Your password has been successfully reset.<br />
                                Redirecting to login in{" "}
                                <strong style={{ color: "var(--primary)", fontSize: "16px" }}>{countdown}s</strong>...
                            </p>
                            <a href="/auth/login" style={{
                                display: "inline-flex", alignItems: "center", gap: "8px",
                                padding: "14px 32px", background: "var(--primary)", color: "var(--color-bg)",
                                borderRadius: "12px", fontWeight: 800, fontSize: "14px",
                                textDecoration: "none", textTransform: "uppercase", letterSpacing: "1px"
                            }}>
                                Go to Login <ArrowRight size={16} />
                            </a>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

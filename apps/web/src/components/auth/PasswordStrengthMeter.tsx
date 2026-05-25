"use client";

import { CheckCircle2, XCircle } from "lucide-react";

export interface PasswordChecks {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    number: boolean;
    special: boolean;
}

export function evaluatePassword(password: string): { score: number; checks: PasswordChecks } {
    const checks: PasswordChecks = {
        length: password.length >= 12,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    const score = Object.values(checks).filter(Boolean).length;
    return { score, checks };
}

export function isPasswordValid(password: string): boolean {
    const { score } = evaluatePassword(password);
    return score === 5;
}

const STRENGTH_LABELS = ["Too weak", "Very weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["#6b7280", "#ef4444", "#f59e0b", "#eab308", "#3b82f6", "#22c55e"];

interface Props {
    password: string;
    showRequirements?: boolean;
}

export default function PasswordStrengthMeter({ password, showRequirements = true }: Props) {
    const { score, checks } = evaluatePassword(password);

    if (!password) return null;

    const requirements: { label: string; met: boolean }[] = [
        { label: "At least 12 characters", met: checks.length },
        { label: "One lowercase letter (a–z)", met: checks.lowercase },
        { label: "One uppercase letter (A–Z)", met: checks.uppercase },
        { label: "One number (0–9)", met: checks.number },
        { label: "One special character (!@#$...)", met: checks.special },
    ];

    return (
        <div style={{ marginTop: "10px" }}>
            <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            height: "3px",
                            borderRadius: "2px",
                            background: i <= score ? STRENGTH_COLORS[score] : "var(--gray-800)",
                            transition: "all 0.3s",
                        }}
                    />
                ))}
            </div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: STRENGTH_COLORS[score], margin: 0 }}>
                Password strength: {STRENGTH_LABELS[score]}
            </p>

            {showRequirements && (
                <div style={{ marginTop: "12px", padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid var(--gray-800)" }}>
                    {requirements.map((req, i) => (
                        <div key={req.label} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: i < requirements.length - 1 ? "6px" : 0 }}>
                            {req.met
                                ? <CheckCircle2 size={13} style={{ color: "#22c55e", flexShrink: 0 }} />
                                : <XCircle size={13} style={{ color: "var(--gray-700)", flexShrink: 0 }} />
                            }
                            <span style={{ fontSize: "12px", color: req.met ? "#22c55e" : "var(--gray-500)", transition: "color 0.2s" }}>{req.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

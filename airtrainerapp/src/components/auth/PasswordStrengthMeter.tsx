import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '../../theme';

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
    return evaluatePassword(password).score === 5;
}

const STRENGTH_LABELS = ['Too weak', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['#6b7280', '#ef4444', '#f59e0b', '#eab308', '#3b82f6', '#22c55e'];

interface Props {
    password: string;
}

export default function PasswordStrengthMeter({ password }: Props) {
    if (!password) return null;
    const { score, checks } = evaluatePassword(password);
    const color = STRENGTH_COLORS[score];

    const requirements: { label: string; met: boolean }[] = [
        { label: 'At least 12 characters', met: checks.length },
        { label: 'One lowercase letter (a–z)', met: checks.lowercase },
        { label: 'One uppercase letter (A–Z)', met: checks.uppercase },
        { label: 'One number (0–9)', met: checks.number },
        { label: 'One special character (!@#$...)', met: checks.special },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.barsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                    <View
                        key={i}
                        style={[
                            styles.bar,
                            { backgroundColor: i <= score ? color : Colors.border },
                        ]}
                    />
                ))}
            </View>
            <Text style={[styles.label, { color }]}>Password strength: {STRENGTH_LABELS[score]}</Text>

            <View style={styles.requirements}>
                {requirements.map(req => (
                    <View key={req.label} style={styles.reqRow}>
                        <Ionicons
                            name={req.met ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={req.met ? Colors.success : Colors.textTertiary}
                        />
                        <Text style={[styles.reqText, { color: req.met ? Colors.success : Colors.textTertiary }]}>
                            {req.label}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    barsRow: {
        flexDirection: 'row',
        gap: 4,
        marginBottom: Spacing.xs,
    },
    bar: {
        flex: 1,
        height: 3,
        borderRadius: 2,
    },
    label: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        marginBottom: Spacing.sm,
    },
    requirements: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
        gap: 6,
    },
    reqRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    reqText: {
        fontSize: FontSize.xs,
    },
});

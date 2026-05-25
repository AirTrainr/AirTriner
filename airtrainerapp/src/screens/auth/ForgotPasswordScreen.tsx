import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const RESEND_COOLDOWN_SECONDS = 30;

export default function ForgotPasswordScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const handleSendReset = async () => {
        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: 'airtrainr://reset-password',
            });
            if (resetError) throw resetError;
            setSent(true);
            setCooldown(RESEND_COOLDOWN_SECONDS);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to send reset email');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper contentStyle={styles.content}>
            {/* Back Button */}
            <Animated.View entering={FadeInDown.duration(250)}>
                <Pressable
                    style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => navigation.goBack()}
                    accessibilityLabel="Back to login"
                >
                    <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
                    <Text style={styles.backText}>Back to login</Text>
                </Pressable>
            </Animated.View>

            {/* Centered content wrapper */}
            <View style={styles.centerWrapper}>
                {/* Header */}
                <Animated.View entering={FadeInDown.duration(250).delay(30)} style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="lock-open-outline" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>Reset Password</Text>
                    <Text style={styles.subtitle}>
                        Enter your email and we'll send you a link to reset your password.
                    </Text>
                </Animated.View>

                {sent ? (
                    /* Success State with animated checkmark + resend */
                    <Animated.View entering={FadeInDown.duration(250).delay(30)} style={styles.successContainer}>
                        <View style={styles.successIconOuter}>
                            <View style={styles.successIconInner}>
                                <Ionicons name="checkmark" size={36} color={Colors.background} />
                            </View>
                        </View>
                        <Text style={styles.successTitle}>Check your email</Text>
                        <Text style={styles.successMessage}>
                            We've sent a password reset link to{'\n'}
                            <Text style={styles.successEmail}>{email}</Text>
                        </Text>

                        <View style={styles.tipsBox}>
                            <Text style={styles.tipsTitle}>Didn&apos;t receive the email?</Text>
                            <Text style={styles.tipsItem}>• Check your spam or junk folder</Text>
                            <Text style={styles.tipsItem}>• Make sure the email is correct</Text>
                            <Text style={styles.tipsItem}>• Links expire after 1 hour</Text>
                        </View>

                        <View style={styles.successAction}>
                            <Button
                                title={
                                    isLoading
                                        ? 'Resending...'
                                        : cooldown > 0
                                            ? `Resend in ${cooldown}s`
                                            : 'Resend Email'
                                }
                                onPress={handleSendReset}
                                loading={isLoading}
                                disabled={isLoading || cooldown > 0}
                            />
                        </View>
                        <Pressable
                            onPress={() => { setSent(false); setEmail(''); setError(null); setCooldown(0); }}
                            style={({ pressed }) => [styles.linkButton, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={styles.linkButtonText}>Use a different email</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => navigation.goBack()}
                            style={({ pressed }) => [styles.linkButton, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={styles.linkButtonTextSecondary}>Back to Sign In</Text>
                        </Pressable>
                    </Animated.View>
                ) : (
                    /* Form */
                    <Animated.View entering={FadeInDown.duration(250).delay(60)} style={styles.form}>
                        {/* Error */}
                        {error && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <Input
                            label="Email Address"
                            icon="mail-outline"
                            placeholder="name@domain.com"
                            value={email}
                            onChangeText={(t) => { setEmail(t); setError(null); }}
                            error={error ? undefined : undefined}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus
                        />

                        <Button
                            title="Send Reset Link"
                            onPress={handleSendReset}
                            loading={isLoading}
                            disabled={isLoading}
                            size="lg"
                        />
                    </Animated.View>
                )}
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: Spacing.xxl,
        flex: 1,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xxl,
        minHeight: 44,
    },
    backText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },

    // Center content vertically
    centerWrapper: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: Spacing.huge,
    },

    header: {
        alignItems: 'center',
        marginBottom: Spacing.huge,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.primaryGlow,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
        ...Shadows.glow,
    },
    title: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    form: {
        gap: Spacing.lg,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: Colors.errorMuted,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    errorText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.error,
    },

    // Success state with animated checkmark
    successContainer: {
        alignItems: 'center',
        paddingTop: Spacing.xl,
    },
    successIconOuter: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: Colors.successMuted,
        borderWidth: 2,
        borderColor: Colors.success + '44',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    successIconInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.success,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successTitle: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    successMessage: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    successEmail: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },
    successAction: {
        marginTop: Spacing.xl,
        width: '100%',
    },
    tipsBox: {
        width: '100%',
        marginTop: Spacing.xl,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    tipsTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    tipsItem: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
    linkButton: {
        marginTop: Spacing.md,
        paddingVertical: Spacing.sm,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    linkButtonText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },
    linkButtonTextSecondary: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
});

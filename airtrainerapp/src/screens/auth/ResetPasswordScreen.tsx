import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

interface Props {
    route: {
        params: {
            code: string;
            onDone: () => void;
        };
    };
}

export default function ResetPasswordScreen({ route }: Props) {
    const { code, onDone } = route.params;

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleReset = async () => {
        if (!password) {
            setError('Please enter a new password');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Step 1: Exchange PKCE code for session
            const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
            if (sessionError) throw sessionError;

            // Step 2: Update the password
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;

            // Step 3: Sign out so user logs in fresh with new password
            await supabase.auth.signOut();

            setDone(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to reset password';
            if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
                setError('This reset link has expired. Please request a new one.');
            } else {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ScreenWrapper contentStyle={styles.content}>
            <View style={styles.centerWrapper}>

                {/* Header */}
                <Animated.View entering={FadeInDown.duration(250)} style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="lock-closed-outline" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>Set New Password</Text>
                    <Text style={styles.subtitle}>
                        Choose a strong password for your AirTrainr account.
                    </Text>
                </Animated.View>

                {done ? (
                    /* ── Success State ── */
                    <Animated.View entering={FadeInDown.duration(250)} style={styles.successContainer}>
                        <View style={styles.successIconOuter}>
                            <View style={styles.successIconInner}>
                                <Ionicons name="checkmark" size={36} color={Colors.background} />
                            </View>
                        </View>
                        <Text style={styles.successTitle}>Password Updated!</Text>
                        <Text style={styles.successMessage}>
                            Your password has been reset successfully.{'\n'}
                            Sign in with your new password.
                        </Text>
                        <View style={styles.successAction}>
                            <Button
                                title="Sign In"
                                onPress={onDone}
                                size="lg"
                            />
                        </View>
                    </Animated.View>
                ) : (
                    /* ── Form ── */
                    <Animated.View entering={FadeInDown.duration(250).delay(60)} style={styles.form}>
                        {error && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <Input
                            label="New Password"
                            icon="lock-closed-outline"
                            placeholder="Minimum 8 characters"
                            value={password}
                            onChangeText={(t) => { setPassword(t); setError(null); }}
                            secureTextEntry
                            autoFocus
                        />

                        <Input
                            label="Confirm Password"
                            icon="lock-closed-outline"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
                            secureTextEntry
                        />

                        <Button
                            title="Reset Password"
                            onPress={handleReset}
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
    successAction: {
        marginTop: Spacing.xxxl,
        width: '100%',
    },
});

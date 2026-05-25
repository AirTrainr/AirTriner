import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Sign in with Google via Supabase OAuth.
 *
 * Flow:
 * 1. Ask Supabase for the OAuth provider URL (Google).
 * 2. Open it in an in-app browser session that closes itself on the
 *    `airtrainr://auth/callback` deep link.
 * 3. Parse the returned fragment for access_token + refresh_token and
 *    install them via `supabase.auth.setSession()`.
 *
 * Requires Google OAuth provider to be enabled in Supabase Dashboard →
 * Authentication → Providers, with `airtrainr://auth/callback` in the
 * additional redirect URLs list.
 */
export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
    const redirectTo = 'airtrainr://auth/callback';

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            skipBrowserRedirect: true,
        },
    });

    if (error || !data?.url) {
        return { ok: false, error: error?.message || 'Failed to start Google sign-in' };
    }

    if (Platform.OS === 'web') {
        window.location.href = data.url;
        return { ok: true };
    }

    try {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
            showInRecents: true,
        });

        if (result.type !== 'success' || !result.url) {
            return { ok: false, error: result.type === 'cancel' ? 'Sign-in cancelled' : 'Sign-in failed' };
        }

        // Supabase returns the session in the URL fragment for the implicit flow
        // (e.g. airtrainr://auth/callback#access_token=...&refresh_token=...).
        const fragment = result.url.split('#')[1] ?? result.url.split('?')[1] ?? '';
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) {
            const callbackError = params.get('error_description') || params.get('error');
            return { ok: false, error: callbackError || 'No session returned by Google' };
        }

        const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        if (setSessionError) {
            return { ok: false, error: setSessionError.message };
        }

        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Google sign-in failed' };
    }
}

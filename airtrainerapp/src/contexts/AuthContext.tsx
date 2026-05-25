import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, loginUser, registerUser, logoutUser, getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { signInWithGoogle as runGoogleSignIn } from '../lib/googleAuth';

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
    register: (data: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: 'athlete' | 'trainer';
        dateOfBirth: string;
        sports?: string[];
        skillLevel?: string;
        city?: string;
        state?: string;
        country?: string;
        zipCode?: string;
        latitude?: number;
        longitude?: number;
        travelRadius?: number;
    }) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isManualAuthRef = React.useRef(false);

    useEffect(() => {
        // Check for existing session
        checkSession();

        // Listen for auth state changes — skip if login/register is handling it
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_OUT') {
                setUser(null);
            } else if (event === 'TOKEN_REFRESHED') {
                if (!isManualAuthRef.current) {
                    const currentUser = await getCurrentUser();
                    if (currentUser) setUser(currentUser);
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const checkSession = async () => {
        try {
            const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
            const currentUser = await Promise.race([getCurrentUser(), timeout]);
            setUser(currentUser);
        } catch (error) {
            console.error('Session check failed:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        isManualAuthRef.current = true;
        try {
            const authUser = await loginUser(email, password);
            setUser(authUser);
        } finally {
            isManualAuthRef.current = false;
        }
    };

    const signInWithGoogle = async () => {
        isManualAuthRef.current = true;
        try {
            const result = await runGoogleSignIn();
            if (!result.ok) return result;
            const authUser = await getCurrentUser();
            if (authUser) setUser(authUser);
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : 'Google sign-in failed' };
        } finally {
            isManualAuthRef.current = false;
        }
    };

    const register = async (data: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: 'athlete' | 'trainer';
        dateOfBirth: string;
        sports?: string[];
        skillLevel?: string;
        city?: string;
        state?: string;
        country?: string;
        zipCode?: string;
        latitude?: number;
        longitude?: number;
        travelRadius?: number;
    }) => {
        isManualAuthRef.current = true;
        try {
            const authUser = await registerUser(data);
            setUser(authUser);
        } finally {
            isManualAuthRef.current = false;
        }
    };

    const logout = async () => {
        try {
            await logoutUser();
        } catch (e) {
            console.error('[Logout] signOut error:', e);
        } finally {
            setUser(null);
        }
    };

    const refreshUser = async () => {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                signInWithGoogle,
                register,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

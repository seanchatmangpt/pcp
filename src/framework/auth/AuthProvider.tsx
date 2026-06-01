import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { ParticipantBasis } from './types';

export interface AuthState<TUser = any> {
  session: TUser | null;
  participant: ParticipantBasis | null;
  loading: boolean;
  isTransitioning: boolean;
  transitionType: 'signin' | 'signout' | null;
}

export interface AuthContextValue<TUser = any> extends AuthState<TUser> {
  setIsTransitioning: (val: boolean) => void;
  setSession: (session: TUser | null) => void;
}

const AuthContext = createContext<AuthContextValue<any>>({
  session: null,
  participant: null,
  loading: true,
  isTransitioning: false,
  transitionType: null,
  setIsTransitioning: () => {},
  setSession: () => {},
});

export interface AuthProviderProps<TUser = any> {
  children: ReactNode;
  /** Function to retrieve initial session asynchronously */
  getInitialSession?: () => Promise<TUser | null>;
  /** Callback to subscribe to auth changes, returning an unsubscribe function */
  onAuthStateChange?: (callback: (event: string, session: TUser | null) => void) => () => void;
  /** Transition delay to allow animations to finish (ms) */
  transitionDurationMs?: number;
  /** Optional function to resolve a participant basis from the session for RBAC hooks */
  resolveParticipant?: (session: TUser) => ParticipantBasis;
}

export function AuthProvider<TUser = any>({
  children,
  getInitialSession,
  onAuthStateChange,
  transitionDurationMs = 850,
  resolveParticipant,
}: AuthProviderProps<TUser>) {
  const [session, setSessionState] = useState<TUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<'signin' | 'signout' | null>(null);

  const participant = useMemo(() => {
    if (!session || !resolveParticipant) return null;
    return resolveParticipant(session);
  }, [session, resolveParticipant]);

  const setSession = (newSession: TUser | null) => {
    setSessionState((prev) => {
      if (!prev && newSession) {
        setTransitionType('signin');
        setIsTransitioning(true);
      } else if (prev && !newSession) {
        setTransitionType('signout');
        setIsTransitioning(true);
      }
      return newSession;
    });
  };

  useEffect(() => {
    let initialized = false;
    let isMounted = true;

    if (getInitialSession) {
      getInitialSession()
        .then((initialSession) => {
          if (!isMounted) return;
          setSessionState(initialSession);
          setLoading(false);
          setTimeout(() => {
            if (isMounted) initialized = true;
          }, 100);
        })
        .catch(() => {
          if (!isMounted) return;
          setLoading(false);
          initialized = true;
        });
    } else {
      setLoading(false);
      initialized = true;
    }

    let unsubscribe: (() => void) | undefined;
    if (onAuthStateChange) {
      unsubscribe = onAuthStateChange((_event, newSession) => {
        if (!isMounted) return;
        if (initialized) {
          setSession(newSession);
        } else {
          setSessionState(newSession);
          setLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [getInitialSession, onAuthStateChange]);

  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, transitionDurationMs);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, transitionDurationMs]);

  return (
    <AuthContext.Provider
      value={{
        session,
        participant,
        loading,
        isTransitioning,
        transitionType,
        setIsTransitioning,
        setSession,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth<TUser = any>(): AuthContextValue<TUser> {
  return useContext(AuthContext) as AuthContextValue<TUser>;
}

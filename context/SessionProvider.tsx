import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface SessionContextType {
  session: Session | null;
  loading: boolean;
  isTransitioning: boolean;
  transitionType: 'signin' | 'signout' | null;
  setIsTransitioning: (val: boolean) => void;
  setSession: (session: Session | null) => void;
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  loading: true,
  isTransitioning: false,
  transitionType: null,
  setIsTransitioning: () => {},
  setSession: () => {},
});

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<'signin' | 'signout' | null>(null);

  useEffect(() => {
    let initialized = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      setTimeout(() => {
        initialized = true;
      }, 100);
    }).catch(err => {
      console.error('SessionProvider getSession error:', err);
      setLoading(false);
      initialized = true;
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (initialized) {
        setSession((prev) => {
          if (prev?.access_token === 'mock-token' && !newSession) {
            return prev;
          }

          if (!prev && newSession) {
            setTransitionType('signin');
            setIsTransitioning(true);
          } else if (prev && !newSession) {
            setTransitionType('signout');
            setIsTransitioning(true);
          }
          return newSession;
        });
      } else {
        setSession(newSession);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 850);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  return (
    <SessionContext.Provider
      value={{
        session,
        loading,
        isTransitioning,
        transitionType,
        setIsTransitioning,
        setSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  return useContext(SessionContext);
};

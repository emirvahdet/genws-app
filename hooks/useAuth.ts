import { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  mustResetPassword: boolean;
}

interface SignInResult {
  success: boolean;
  mustResetPassword?: boolean;
  error?: string;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
    isAdmin: false,
    mustResetPassword: false,
  });

  const checkAdminStatus = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('is_admin', { user_id: userId });
      if (error) {
        __DEV__ && console.log('Admin check error:', error);
        return false;
      }
      return !!data;
    } catch {
      return false;
    }
  }, []);

  const checkProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('must_reset_password')
        .eq('id', userId)
        .single();
      return { mustResetPassword: !!data?.must_reset_password };
    } catch {
      return { mustResetPassword: false };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initSession = async (session: Session | null) => {
      if (!isMounted) return;

      if (!session) {
        setState({ session: null, user: null, isLoading: false, isAdmin: false, mustResetPassword: false });
        return;
      }

      const [{ mustResetPassword }, isAdmin] = await Promise.all([
        checkProfile(session.user.id),
        checkAdminStatus(session.user.id),
      ]);

      if (!isMounted) return;

      setState({
        session,
        user: session.user,
        isLoading: false,
        isAdmin,
        mustResetPassword,
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setTimeout(() => initSession(session), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      initSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [checkProfile, checkAdminStatus]);

  const signIn = useCallback(async (identifier: string, password: string): Promise<SignInResult> => {
    try {
      const { data: authData, error: authError } = await supabase.functions.invoke('authenticate-user', {
        body: { identifier, password },
      });

      if (authError || !authData?.success) {
        return { success: false, error: 'Invalid batch number or key' };
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: authData.email,
        password,
      });

      if (signInError || !signInData.user) {
        __DEV__ && console.log('Sign-in error:', signInError);
        return { success: false, error: 'Invalid batch number or key' };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('must_reset_password, has_used_initial_key')
        .eq('id', signInData.user.id)
        .single();

      if (profile?.must_reset_password && !profile?.has_used_initial_key) {
        await supabase
          .from('profiles')
          .update({ has_used_initial_key: true })
          .eq('id', signInData.user.id);
      }

      return {
        success: true,
        mustResetPassword: !!profile?.must_reset_password,
      };
    } catch (error: unknown) {
      __DEV__ && console.log('Authentication error:', error);
      return { success: false, error: 'Invalid batch number or key' };
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (error: unknown) {
      __DEV__ && console.log('Sign-out error:', error);
    }
  }, []);

  const resetPassword = useCallback(async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) throw passwordError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_reset_password: false })
          .eq('id', user.id);
        if (profileError) throw profileError;
      }

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      __DEV__ && console.log('Password reset error:', error);
      return { success: false, error: message };
    }
  }, []);

  return {
    ...state,
    signIn,
    signOut,
    resetPassword,
  };
};

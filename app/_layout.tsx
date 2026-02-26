import "../global.css";
import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { useBiometrics } from "../hooks/useBiometrics";
import { useNotifications } from "../hooks/useNotifications";
import { ViewAsProvider, useViewAs } from "../stores/ViewAsContext";
import { ViewAsBanner } from "../components/admin/ViewAsBanner";
import { supabase } from "../lib/supabase";

function AuthGate() {
  const { session, isLoading, mustResetPassword, signIn } = useAuth();
  const { isViewingAs } = useViewAs();
  const { isEnabled, authenticateWithBiometrics } = useBiometrics();
  
  // Initialize push notifications for authenticated users
  useNotifications(session?.user?.id);
  const router = useRouter();
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [biometricAttempted, setBiometricAttempted] = useState(false);
  const biometricAttemptRef = useRef(false);

  useEffect(() => {
    if (isLoading || !session) {
      setOnboardingChecked(false);
      setNeedsOnboarding(false);
      return;
    }
    if (mustResetPassword) {
      setOnboardingChecked(true);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("has_completed_welcome_onboarding")
          .eq("id", session.user.id)
          .single();
        if (active) {
          setNeedsOnboarding(!data?.has_completed_welcome_onboarding);
          setOnboardingChecked(true);
        }
      } catch {
        if (active) setOnboardingChecked(true);
      }
    })();
    return () => { active = false; };
  }, [session, isLoading, mustResetPassword]);

  // Auto-prompt biometric auth on startup if enabled and not logged in
  useEffect(() => {
    if (isLoading || session || !isEnabled || biometricAttemptRef.current) return;

    const attemptBiometricLogin = async () => {
      biometricAttemptRef.current = true;
      setBiometricAttempted(true);

      try {
        const result = await authenticateWithBiometrics();

        if (result.success && result.credentials) {
          const signInResult = await signIn(
            result.credentials.identifier,
            result.credentials.password
          );

          if (signInResult.success) {
            // Auth state will update automatically via useAuth
            // Navigation will be handled by the main navigation effect
            return;
          }
        }
      } catch (error) {
        __DEV__ && console.log('Auto biometric login error:', error);
      }
    };

    attemptBiometricLogin();
  }, [isLoading, session, isEnabled, authenticateWithBiometrics, signIn]);

  useEffect(() => {
    if (isLoading || !onboardingChecked) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    if (!session) {
      // Only navigate to login after biometric attempt is done (or not needed)
      if (!inAuthGroup && (!isEnabled || biometricAttempted)) {
        router.replace("/(auth)/login");
      }
      return;
    }

    if (mustResetPassword) {
      const segs = [...segments] as string[];
      if (segs[0] !== "(auth)" || segs[1] !== "password-reset") {
        router.replace("/(auth)/password-reset");
      }
      return;
    }

    if (needsOnboarding) {
      if (!inOnboarding) router.replace("/onboarding/welcome");
      return;
    }

    if (inAuthGroup || inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [session, isLoading, mustResetPassword, needsOnboarding, onboardingChecked, segments]);

  if (isLoading || (session && !mustResetPassword && !onboardingChecked)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "hsl(210, 17%, 98%)" }}>
        <ActivityIndicator size="large" color="hsl(134, 100%, 14%)" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ViewAsBanner />
      <View style={{ flex: 1, paddingTop: isViewingAs ? 50 : 0 }}>
        <Slot />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ViewAsProvider>
          <AuthGate />
        </ViewAsProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

import "../global.css";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { ViewAsProvider, useViewAs } from "../stores/ViewAsContext";
import { ViewAsBanner } from "../components/admin/ViewAsBanner";
import { supabase } from "../lib/supabase";

function AuthGate() {
  const { session, isLoading, mustResetPassword } = useAuth();
  const { isViewingAs } = useViewAs();
  const router = useRouter();
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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

  useEffect(() => {
    if (isLoading || !onboardingChecked) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    if (!session) {
      if (!inAuthGroup) router.replace("/(auth)/login");
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

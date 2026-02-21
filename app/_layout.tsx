import "../global.css";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuth } from "../hooks/useAuth";
import { ViewAsProvider } from "../stores/ViewAsContext";

function AuthGate() {
  const { session, isLoading, mustResetPassword } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session) {
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
      return;
    }

    if (mustResetPassword) {
      router.replace("/(auth)/password-reset");
      return;
    }

    if (inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, isLoading, mustResetPassword, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "hsl(210, 17%, 98%)" }}>
        <ActivityIndicator size="large" color="hsl(134, 100%, 14%)" />
      </View>
    );
  }

  return <Slot />;
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

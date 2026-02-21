import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ArrowRight, X } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

const PRIMARY = "#00451a";
const BG = "#d0dad0";
const { width: SW, height: SH } = Dimensions.get("window");

// ── Outline button ──────────────────────────────────────────────────────────
function OBtn({
  label,
  onPress,
  icon,
}: {
  label?: string;
  onPress: () => void;
  icon?: "left" | "right";
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        borderWidth: 2,
        borderColor: PRIMARY,
        borderRadius: 10,
        paddingHorizontal: label ? 24 : 14,
        paddingVertical: 12,
        backgroundColor: pressed ? PRIMARY : "transparent",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
      }}
    >
      {icon === "left" && <ArrowLeft size={20} color={pressed ? "white" : PRIMARY} />}
      {label && (
        <Text style={{ color: pressed ? "white" : PRIMARY, fontWeight: "600", fontSize: 15 }}>
          {label}
        </Text>
      )}
      {icon === "right" && <ArrowRight size={20} color={pressed ? "white" : PRIMARY} />}
    </Pressable>
  );
}

// ── Screen content wrapper ──────────────────────────────────────────────────
function ScreenContent({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 24 }}>
      {children}
    </View>
  );
}

export default function WelcomeOnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ canClose?: string }>();
  const canClose = params.canClose === "true";

  const [currentScreen, setCurrentScreen] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const handleComplete = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !canClose) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("must_reset_password, has_completed_welcome_onboarding")
          .eq("id", user.id)
          .single();
        if (profile?.must_reset_password === false && !profile?.has_completed_welcome_onboarding) {
          await supabase
            .from("profiles")
            .update({ has_completed_welcome_onboarding: true })
            .eq("id", user.id);
        }
      }
      if (canClose) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    } catch (e) {
      __DEV__ && console.log("WelcomeOnboarding complete error:", e);
      Alert.alert("Error", "Failed to save onboarding progress");
    }
  };

  const handleNext = () => {
    if (currentScreen === 2 && currentPage === 1) { setCurrentPage(2); return; }
    if (currentScreen === 3 && currentPage === 1) { setCurrentPage(2); return; }
    if (currentScreen === 4 && currentPage === 1) { setCurrentPage(2); return; }
    if (currentScreen === 4 && currentPage === 2) { setCurrentPage(3); return; }
    if (currentScreen === 5 && currentPage === 1) { setCurrentPage(2); return; }
    setCurrentScreen((s) => s + 1);
    setCurrentPage(1);
  };

  const handleBack = () => {
    if (currentScreen === 2 && currentPage === 2) { setCurrentPage(1); return; }
    if (currentScreen === 3 && currentPage === 2) { setCurrentPage(1); return; }
    if (currentScreen === 4 && currentPage === 2) { setCurrentPage(1); return; }
    if (currentScreen === 4 && currentPage === 3) { setCurrentPage(2); return; }
    if (currentScreen === 5 && currentPage === 2) { setCurrentPage(1); return; }
    if (currentPage === 1 && currentScreen > 1) {
      const prev = currentScreen - 1;
      setCurrentScreen(prev);
      if (prev === 2) setCurrentPage(2);
      else if (prev === 3) setCurrentPage(2);
      else if (prev === 4) setCurrentPage(3);
      else setCurrentPage(1);
    }
  };

  // ── Progress dots ──────────────────────────────────────────────────────────
  const totalSlides = 9; // 1 + 2 + 2 + 3 + 2 = 10 pages, but we track screens 1-5
  // Compute a flat index for progress
  const flatIndex = (() => {
    if (currentScreen === 1) return 0;
    if (currentScreen === 2) return currentPage; // 1 or 2
    if (currentScreen === 3) return 2 + currentPage; // 3 or 4
    if (currentScreen === 4) return 4 + currentPage; // 5, 6, or 7
    if (currentScreen === 5) return 7 + currentPage; // 8 or 9
    return 0;
  })();
  const totalDots = 9;

  const renderContent = () => {
    // ── Screen 1 ──────────────────────────────────────────────────────────────
    if (currentScreen === 1) {
      return (
        <View style={{ flex: 1 }}>
          <ScreenContent>
            <Text style={{ fontFamily: "serif", fontSize: 28, fontWeight: "700", color: PRIMARY, textAlign: "center", lineHeight: 36 }}>
              YOU'RE IN, Welcome to The Society!
            </Text>
            <Text style={{ fontFamily: "serif", fontSize: 22, fontWeight: "500", color: PRIMARY, textAlign: "center", lineHeight: 30 }}>
              Before you start exploring, we've prepared a short guide for you.
            </Text>
          </ScreenContent>
          <View style={{ paddingBottom: 40, alignItems: "center" }}>
            <OBtn label="Let's dive in!" onPress={handleNext} />
          </View>
        </View>
      );
    }

    // ── Screen 2 ──────────────────────────────────────────────────────────────
    if (currentScreen === 2) {
      if (currentPage === 1) {
        return (
          <View style={{ flex: 1 }}>
            <ScreenContent>
              <Text style={{ fontFamily: "serif", fontSize: 28, fontWeight: "700", color: PRIMARY, textAlign: "center" }}>
                Vibe
              </Text>
              <Text style={{ fontSize: 16, color: PRIMARY, textAlign: "center", lineHeight: 24 }}>
                <Text style={{ fontWeight: "600" }}>Each of us comes from a different story,</Text>
                {" "}but we carry the same questions:
              </Text>
              <View style={{ gap: 4, alignItems: "center" }}>
                <Text style={{ fontSize: 16, color: "#324750", fontStyle: "italic" }}>Where do I want to go?</Text>
                <Text style={{ fontSize: 16, color: "#324750", fontStyle: "italic" }}>What is good for me?</Text>
                <Text style={{ fontSize: 16, color: "#324750", fontStyle: "italic" }}>How can I get there?</Text>
              </View>
            </ScreenContent>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingBottom: 40, paddingHorizontal: 32 }}>
              <OBtn icon="right" onPress={handleNext} />
            </View>
          </View>
        );
      } else {
        return (
          <View style={{ flex: 1 }}>
            <ScreenContent>
              <Text style={{ fontSize: 15, color: PRIMARY, textAlign: "center", lineHeight: 24 }}>
                <Text style={{ fontWeight: "700" }}>THE TRUTH IS</Text>
                {" - if you're here, it means you've already answered some of these for yourself and carved your own path."}
              </Text>
              <Text style={{ fontSize: 15, color: PRIMARY, textAlign: "center", lineHeight: 24 }}>
                Now, it's time to make the journey richer, sharper, and stronger.
              </Text>
              <Text style={{ fontSize: 15, color: "#324750", fontWeight: "700", fontStyle: "italic", textAlign: "center", lineHeight: 24 }}>
                The Society is here to give you the access and the knowledge to keep moving forward.
              </Text>
            </ScreenContent>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 40, paddingHorizontal: 32 }}>
              <OBtn icon="left" onPress={handleBack} />
              <OBtn icon="right" onPress={handleNext} />
            </View>
          </View>
        );
      }
    }

    // ── Screen 3 ──────────────────────────────────────────────────────────────
    if (currentScreen === 3) {
      if (currentPage === 1) {
        return (
          <View style={{ flex: 1 }}>
            <ScreenContent>
              <Text style={{ fontFamily: "serif", fontSize: 28, fontWeight: "700", color: PRIMARY, textAlign: "center" }}>
                Members
              </Text>
              <Text style={{ fontSize: 15, color: PRIMARY, textAlign: "center", lineHeight: 24 }}>
                Generational Wealth Society is for family members between 21 and 40, born into a legacy, from all around the world.
              </Text>
            </ScreenContent>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 40, paddingHorizontal: 32 }}>
              <OBtn icon="left" onPress={handleBack} />
              <OBtn icon="right" onPress={handleNext} />
            </View>
          </View>
        );
      } else {
        return (
          <View style={{ flex: 1 }}>
            <ScreenContent>
              <Text style={{ fontSize: 15, color: "#324750", fontWeight: "500", textAlign: "center" }}>
                Every individual is here for the mindset:
              </Text>
              <View style={{ gap: 4, alignItems: "center" }}>
                <Text style={{ fontSize: 15, color: "#324750", fontStyle: "italic" }}>Being self-driven to grow</Text>
                <Text style={{ fontSize: 15, color: "#324750", fontStyle: "italic" }}>Understanding wealth comes with responsibility</Text>
                <Text style={{ fontSize: 15, color: PRIMARY, fontStyle: "italic" }}>Willing to contribute.</Text>
              </View>
              <Text style={{ fontSize: 15, color: PRIMARY, fontWeight: "700", textAlign: "center" }}>
                To support one another is what we love to see.
              </Text>
            </ScreenContent>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 40, paddingHorizontal: 32 }}>
              <OBtn icon="left" onPress={handleBack} />
              <OBtn icon="right" onPress={handleNext} />
            </View>
          </View>
        );
      }
    }

    // ── Screen 4 ──────────────────────────────────────────────────────────────
    if (currentScreen === 4) {
      if (currentPage === 1) {
        return (
          <View style={{ flex: 1 }}>
            <ScreenContent>
              <Text style={{ fontFamily: "serif", fontSize: 28, fontWeight: "700", color: PRIMARY, textAlign: "center" }}>
                Privacy
              </Text>
              <Text style={{ fontSize: 15, color: PRIMARY, textAlign: "center", lineHeight: 24 }}>
                <Text style={{ fontWeight: "700" }}>DISCRETION</Text>
                {" is the backbone of this society. Whether it's stories or moments — what's shared here stays here. We expect every member to honor that."}
              </Text>
            </ScreenContent>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 40, paddingHorizontal: 32 }}>
              <OBtn icon="left" onPress={handleBack} />
              <OBtn icon="right" onPress={handleNext} />
            </View>
          </View>
        );
      } else if (currentPage === 2) {
        return (
          <View style={{ flex: 1 }}>
            <ScreenContent>
              <Text style={{ fontSize: 15, color: PRIMARY, textAlign: "center", lineHeight: 24 }}>
                You might believe in the power of social media and enjoy saving your memories, but out of respect for other members' preferences, it's nice to ask before taking any pictures or videos.
              </Text>
            </ScreenContent>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 40, paddingHorizontal: 32 }}>
              <OBtn icon="left" onPress={handleBack} />
              <OBtn icon="right" onPress={handleNext} />
            </View>
          </View>
        );
      } else {
        return (
          <View style={{ flex: 1 }}>
            <ScreenContent>
              <Text style={{ fontSize: 15, color: "#324750", textAlign: "center", lineHeight: 24 }}>
                We don't share member or attendee lists. To expand your circle, you can always join our events.
              </Text>
            </ScreenContent>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 40, paddingHorizontal: 32 }}>
              <OBtn icon="left" onPress={handleBack} />
              <OBtn icon="right" onPress={handleNext} />
            </View>
          </View>
        );
      }
    }

    // ── Screen 5 ──────────────────────────────────────────────────────────────
    if (currentScreen === 5) {
      if (currentPage === 1) {
        return (
          <View style={{ flex: 1 }}>
            <ScreenContent>
              <Text style={{ fontFamily: "serif", fontSize: 28, fontWeight: "700", color: PRIMARY, textAlign: "center" }}>
                Don'ts
              </Text>
              <Text style={{ fontSize: 15, color: "#324750", textAlign: "center", lineHeight: 24 }}>
                <Text style={{ fontWeight: "700" }}>No judgment no drama,</Text>
                {" that's the baseline."}
              </Text>
              <Text style={{ fontSize: 15, color: "#324750", textAlign: "center", lineHeight: 24 }}>
                {"We trust our members to know better, but just to be clear: "}
                <Text style={{ fontWeight: "500" }}>
                  breaking privacy, showing disrespect toward fellow members or the society, or engaging in behaviour that could be considered illegal may result in removal from the society.
                </Text>
              </Text>
            </ScreenContent>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 40, paddingHorizontal: 32 }}>
              <OBtn icon="left" onPress={handleBack} />
              <OBtn icon="right" onPress={handleNext} />
            </View>
          </View>
        );
      } else {
        return (
          <View style={{ flex: 1 }}>
            <ScreenContent>
              <Text style={{ fontSize: 15, color: PRIMARY, textAlign: "center", lineHeight: 24 }}>
                To keep the quality high, we also keep the circle limited. If you choose not to engage for a long time, your spot may eventually be passed on.
              </Text>
            </ScreenContent>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 40, paddingHorizontal: 32 }}>
              <OBtn icon="left" onPress={handleBack} />
              <OBtn label="Got it, thanks!" onPress={handleComplete} />
            </View>
          </View>
        );
      }
    }

    return null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={["top", "bottom"]}>
      {/* Close button (restart mode only) */}
      {canClose && (
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            position: "absolute", top: 56, right: 20, zIndex: 50,
            padding: 8, borderRadius: 8,
            backgroundColor: pressed ? "rgba(0,0,0,0.1)" : "transparent",
          })}
        >
          <X size={22} color="#666" />
        </Pressable>
      )}

      {/* Progress dots */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 16, paddingBottom: 8 }}>
        {Array.from({ length: totalDots }).map((_, i) => (
          <View
            key={i}
            style={{
              width: i === flatIndex ? 20 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === flatIndex ? PRIMARY : PRIMARY + "40",
            }}
          />
        ))}
      </View>

      {/* Screen content */}
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, ArrowRight } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

const INTEREST_CATEGORIES = [
  { id: "A", label: "Angel Investing", description: "Early-stage startup investments" },
  { id: "B", label: "Business Development", description: "Growth and expansion strategies" },
  { id: "C", label: "Cryptocurrency", description: "Digital asset investment" },
  { id: "D", label: "Digital Innovation", description: "Technology and digital transformation" },
  { id: "E", label: "ESG Investing", description: "Environmental and social governance" },
  { id: "F", label: "Family Office", description: "Wealth preservation and management" },
  { id: "G", label: "Global Markets", description: "International investment opportunities" },
  { id: "H", label: "Healthcare Innovation", description: "Medical technology and biotech" },
  { id: "I", label: "Impact Investing", description: "Socially responsible investments" },
  { id: "J", label: "Joint Ventures", description: "Strategic partnerships and collaborations" },
  { id: "K", label: "Knowledge Economy", description: "Education and intellectual property" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selectedInterests.length < 3) {
      Alert.alert("Select Interests", "Please select at least 3 areas of interest to continue.");
      return;
    }
    setLoading(true);
    try {
      Alert.alert("Welcome to the Society", "Your profile has been created successfully.", [
        { text: "OK", onPress: () => router.replace("/(tabs)") },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const canContinue = selectedInterests.length >= 3;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: Colors.foreground, textAlign: "center", marginBottom: 8 }}>
            Complete Your Profile
          </Text>
          <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center" }}>
            Select your areas of interest to connect with like-minded members
          </Text>

          {/* Progress indicator */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24 }}>
            {/* Step 1 — done */}
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Check size={16} color="white" />
            </View>
            <View style={{ width: 48, height: 3, backgroundColor: Colors.primary, borderRadius: 2 }} />
            {/* Step 2 — current */}
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>2</Text>
            </View>
            <View style={{ width: 48, height: 3, backgroundColor: Colors.border, borderRadius: 2 }} />
            {/* Step 3 — pending */}
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "white", borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: Colors.mutedForeground, fontSize: 13 }}>3</Text>
            </View>
          </View>
        </View>

        {/* Card */}
        <View style={{ backgroundColor: "white", borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border }}>
          <Text style={{ fontSize: 19, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>
            Select Your Interests
          </Text>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 20 }}>
            Choose at least 3 categories that align with your investment focus
          </Text>

          {/* Interest grid */}
          <View style={{ gap: 12, marginBottom: 24 }}>
            {INTEREST_CATEGORIES.map((category) => {
              const isSelected = selectedInterests.includes(category.id);
              return (
                <Pressable
                  key={category.id}
                  onPress={() => toggleInterest(category.id)}
                  style={({ pressed }) => ({
                    padding: 16,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: isSelected ? Colors.primary : Colors.border,
                    backgroundColor: isSelected
                      ? Colors.primary + "1A"
                      : pressed
                      ? Colors.muted
                      : "white",
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                    {/* Badge */}
                    <View style={{ borderWidth: 1, borderColor: isSelected ? Colors.primary : Colors.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: isSelected ? Colors.primary : Colors.mutedForeground }}>
                        {category.id}
                      </Text>
                    </View>
                    {/* Check circle */}
                    {isSelected && (
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}>
                        <Check size={12} color="white" />
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground, marginBottom: 2 }}>
                    {category.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
                    {category.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Footer row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                {selectedInterests.length} of {INTEREST_CATEGORIES.length} selected
              </Text>
              {!canContinue && (
                <Text style={{ fontSize: 12, color: Colors.destructive, marginTop: 2 }}>
                  (Minimum 3 required)
                </Text>
              )}
            </View>

            <Pressable
              onPress={handleContinue}
              disabled={!canContinue || loading}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: canContinue ? Colors.primary : Colors.mutedForeground,
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 12,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>
                    Continue to Dashboard
                  </Text>
                  <ArrowRight size={16} color="white" />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

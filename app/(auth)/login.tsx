import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Lock, Key, ArrowRight } from "lucide-react-native";
import { useAuth } from "../../hooks/useAuth";
import { Colors } from "../../constants/Colors";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter your batch number and key.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn(identifier.trim(), password);

      if (!result.success) {
        Alert.alert("Invalid Credentials", result.error || "Invalid batch number or key");
        return;
      }

      if (result.mustResetPassword) {
        router.replace("/(auth)/password-reset");
      } else {
        router.replace("/(tabs)");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "hsl(210, 17%, 98%)" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 384 }}>
            {/* Logo / Header */}
            <View style={{ alignItems: "center", marginBottom: 32 }}>
              <View style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Text style={{ color: "white", fontSize: 30, fontWeight: "bold" }}>G</Text>
              </View>
              <Text style={{ color: Colors.foreground, fontSize: 22, letterSpacing: 4, marginBottom: 2, fontWeight: "900" }}>
                GENERATIONAL
              </Text>
              <Text style={{ color: Colors.foreground, fontSize: 22, letterSpacing: 4, marginBottom: 24, fontWeight: "900" }}>
                WEALTH SOCIETY
              </Text>
              <Text style={{ color: Colors.foreground, fontSize: 20, fontWeight: "600", marginBottom: 4 }}>
                Member Login
              </Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14, textAlign: "center" }}>
                Enter your credentials to access your account
              </Text>
            </View>

            {/* Login Card */}
            <View style={{ backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(176,196,208,0.3)", borderRadius: 16, padding: 24 }}>
              {/* Batch Number */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Lock size={16} color={Colors.foreground} />
                  <Text style={{ color: Colors.foreground, fontWeight: "500" }}>
                    Batch Number
                  </Text>
                </View>
                <TextInput
                  style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: "rgba(176,196,208,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: Colors.foreground, fontSize: 16 }}
                  placeholder="Enter your batch number"
                  placeholderTextColor={Colors.mutedForeground}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!isLoading}
                />
              </View>

              {/* Key */}
              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Key size={16} color={Colors.foreground} />
                  <Text style={{ color: Colors.foreground, fontWeight: "500" }}>
                    Key
                  </Text>
                </View>
                <TextInput
                  style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: "rgba(176,196,208,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: Colors.foreground, fontSize: 16 }}
                  placeholder="Enter your key"
                  placeholderTextColor={Colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  editable={!isLoading}
                />
              </View>

              {/* Submit Button */}
              <Pressable
                onPress={handleSubmit}
                disabled={isLoading}
                style={({ pressed }) => ({
                  backgroundColor: Colors.primary,
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  opacity: pressed || isLoading ? 0.75 : 1,
                })}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                      Enter
                    </Text>
                    <ArrowRight size={16} color="white" />
                  </>
                )}
              </Pressable>

              {/* Forgot Password */}
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                style={{ alignItems: "center", marginTop: 16 }}
                disabled={isLoading}
              >
                <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>
                  Oops, I forgot my key!
                </Text>
              </Pressable>
            </View>

            {/* Footer */}
            <View style={{ alignItems: "center", marginTop: 24, gap: 4 }}>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14, opacity: 0.6 }}>
                Don't have access?
              </Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14, opacity: 0.6, textAlign: "center" }}>
                Contact your administrator or reach out to us at gws@karmanbeyond.com
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

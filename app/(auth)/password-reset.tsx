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
import { Lock, Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

export default function PasswordResetScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords Don't Match", "Please make sure both passwords are identical.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Password Too Short", "Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword(newPassword);

      if (!result.success) {
        Alert.alert("Error", result.error || "Failed to update password");
        return;
      }

      Alert.alert("Password Updated", "Your password has been changed successfully.");

      // Check if user has completed onboarding
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("has_completed_welcome_onboarding")
          .eq("id", user.id)
          .single();

        if (!profile?.has_completed_welcome_onboarding) {
          router.replace("/onboarding/welcome");
        } else {
          router.replace("/(tabs)");
        }
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
          <View style={{ width: "100%", maxWidth: 400 }}>
            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: 32 }}>
              <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Text style={{ color: "white", fontSize: 24, fontWeight: "bold" }}>G</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: "600", color: Colors.foreground, marginBottom: 8 }}>
                Reset Your Password
              </Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14, textAlign: "center" }}>
                Please create a new secure password
              </Text>
            </View>

            {/* Card */}
            <View style={{ backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(176,196,208,0.3)", borderRadius: 16, padding: 24, gap: 20 }}>
              {/* New Password */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Lock size={16} color={Colors.foreground} />
                  <Text style={{ color: Colors.foreground, fontWeight: "500" }}>New Password</Text>
                </View>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: "rgba(176,196,208,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, paddingRight: 48, color: Colors.foreground, fontSize: 16 }}
                    placeholder="Enter new password"
                    placeholderTextColor={Colors.mutedForeground}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                    editable={!isLoading}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={Colors.mutedForeground} />
                    ) : (
                      <Eye size={18} color={Colors.mutedForeground} />
                    )}
                  </Pressable>
                </View>
                <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>
                  Must be at least 8 characters long
                </Text>
              </View>

              {/* Confirm Password */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Lock size={16} color={Colors.foreground} />
                  <Text style={{ color: Colors.foreground, fontWeight: "500" }}>Confirm Password</Text>
                </View>
                <TextInput
                  style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: "rgba(176,196,208,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: Colors.foreground, fontSize: 16 }}
                  placeholder="Confirm new password"
                  placeholderTextColor={Colors.mutedForeground}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  editable={!isLoading}
                />
              </View>

              {/* Submit Button */}
              <Pressable
                onPress={handleSubmit}
                disabled={isLoading}
                style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", opacity: pressed || isLoading ? 0.75 : 1 })}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Update Password</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

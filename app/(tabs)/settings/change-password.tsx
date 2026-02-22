import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Lock, Eye, EyeOff } from "lucide-react-native";
import { supabase } from "../../../lib/supabase";
import { Colors } from "../../../constants/Colors";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      Alert.alert("Success", "Password updated successfully", [
        { text: "OK", onPress: () => router.replace("/(tabs)/profile") }
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <View style={{ 
        flexDirection: "row", 
        alignItems: "center", 
        paddingHorizontal: 20,
        paddingVertical: 16,
      }}>
        <Pressable onPress={() => router.replace("/(tabs)/profile")}>
          <ArrowLeft size={24} color={Colors.foreground} />
        </Pressable>
        <Text style={{ 
          fontSize: 18, 
          fontWeight: "600", 
          color: Colors.foreground, 
          marginLeft: 16 
        }}>
          Change Password
        </Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1, padding: 20 }}>
        <View style={{ 
          backgroundColor: "white", 
          borderRadius: 16, 
          padding: 20, 
          borderWidth: 1, 
          borderColor: Colors.border,
          gap: 16,
        }}>
          {/* New Password */}
          <View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 8 }}>
              New Password
            </Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={{
                  backgroundColor: Colors.input,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  paddingRight: 40,
                  fontSize: 15,
                  color: Colors.foreground,
                }}
                placeholder="Enter new password"
                placeholderTextColor={Colors.mutedForeground}
                value={passwordData.newPassword}
                onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  padding: 4,
                }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={Colors.mutedForeground} />
                ) : (
                  <Eye size={20} color={Colors.mutedForeground} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Confirm Password */}
          <View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 8 }}>
              Confirm New Password
            </Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={{
                  backgroundColor: Colors.input,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  paddingRight: 40,
                  fontSize: 15,
                  color: Colors.foreground,
                }}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.mutedForeground}
                value={passwordData.confirmPassword}
                onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  padding: 4,
                }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={Colors.mutedForeground} />
                ) : (
                  <Eye size={20} color={Colors.mutedForeground} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Requirements */}
          <View style={{ 
            backgroundColor: Colors.muted, 
            borderRadius: 8, 
            padding: 12,
            gap: 4,
          }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground }}>
              Password Requirements:
            </Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
              • At least 6 characters long
            </Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
              • Match both fields
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <Pressable
              onPress={() => router.replace("/(tabs)/profile")}
              style={({ pressed }) => ({
                flex: 1,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: Colors.foreground, fontWeight: "500" }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handlePasswordChange}
              disabled={loading}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: Colors.primary,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
                opacity: pressed || loading ? 0.7 : 1,
              })}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={{ color: "white", fontWeight: "600" }}>Update Password</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

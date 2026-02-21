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
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Hash, Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

type Step = "batch" | "code" | "password";

const maskEmail = (email: string): string => {
  const [username, domain] = email.split("@");
  if (!username || !domain) return email;
  const [domainName, ...extensions] = domain.split(".");
  const maskedUsername = username.slice(0, 3) + "***";
  const maskedDomain = domainName.slice(0, 3) + "***";
  const fullExtension = extensions.join(".");
  return `${maskedUsername}@${maskedDomain}.${fullExtension}`;
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("batch");
  const [batchNumber, setBatchNumber] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async () => {
    if (!batchNumber.trim()) {
      Alert.alert("Missing Field", "Please enter your batch number.");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-reset-code", {
        body: { batchNumber: batchNumber.trim() },
      });

      if (error) throw error;

      setEmail(data.email);
      setStep("code");
      Alert.alert("Code Sent", `A 6-digit code has been sent to ${maskEmail(data.email)}`);
    } catch (error: unknown) {
      __DEV__ && console.log("Error sending code:", error);
      Alert.alert("Error", "Please make sure to enter the correct details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      Alert.alert("Invalid Code", "Please enter the complete 6-digit code.");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-reset-code", {
        body: { batchNumber, code, verifyOnly: true },
      });

      if (error) throw new Error(error.message || "Failed to verify code");
      if (data?.error) throw new Error(data.error);

      setStep("password");
      Alert.alert("Code Verified", "Please enter your new password.");
    } catch (error: unknown) {
      __DEV__ && console.log("Error verifying code:", error);
      const message = error instanceof Error ? error.message : "Invalid or expired code. Please try again.";
      Alert.alert("Verification Failed", message);
      setCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
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
      const response = await supabase.functions.invoke("verify-reset-code", {
        body: { batchNumber, code, newPassword },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to reset password. Please try again.");
      }
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      Alert.alert("Password Reset Successful", "You can now log in with your new password.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (error: unknown) {
      __DEV__ && console.log("Error resetting password:", error);
      const message = error instanceof Error ? error.message : "Failed to reset password. Please try again.";

      let title = "Error";
      if (message.toLowerCase().includes("password")) title = "Invalid Password";
      else if (message.toLowerCase().includes("code") || message.toLowerCase().includes("expired")) title = "Code Error";

      Alert.alert(title, message);

      if (message.toLowerCase().includes("code") || message.toLowerCase().includes("expired")) {
        setStep("code");
        setCode("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-reset-code", {
        body: { batchNumber },
      });
      if (error) throw error;
      Alert.alert("Code Resent", "A new code has been sent to your email.");
    } catch {
      Alert.alert("Error", "Failed to resend code.");
    } finally {
      setIsLoading(false);
    }
  };

  const subtitleMap: Record<Step, string> = {
    batch: "Enter your batch number to get started",
    code: "Enter the 6-digit code sent to your email",
    password: "Create a new secure password",
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
                Forgot Password
              </Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14, textAlign: "center" }}>
                {subtitleMap[step]}
              </Text>
            </View>

            {/* Card */}
            <View style={{ backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(176,196,208,0.3)", borderRadius: 16, padding: 24 }}>

              {/* Step: Batch */}
              {step === "batch" && (
                <View style={{ gap: 24 }}>
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Hash size={16} color={Colors.foreground} />
                      <Text style={{ color: Colors.foreground, fontWeight: "500" }}>Batch Number</Text>
                    </View>
                    <TextInput
                      style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: "rgba(176,196,208,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: Colors.foreground, fontSize: 16 }}
                      placeholder="Enter your batch number"
                      placeholderTextColor={Colors.mutedForeground}
                      value={batchNumber}
                      onChangeText={setBatchNumber}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSendCode}
                      editable={!isLoading}
                    />
                  </View>

                  <Pressable
                    onPress={handleSendCode}
                    disabled={isLoading}
                    style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", opacity: pressed || isLoading ? 0.75 : 1 })}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Send Reset Code</Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => router.back()}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 }}
                  >
                    <ArrowLeft size={16} color={Colors.mutedForeground} />
                    <Text style={{ color: Colors.mutedForeground }}>Back to Login</Text>
                  </Pressable>
                </View>
              )}

              {/* Step: Code */}
              {step === "code" && (
                <View style={{ gap: 24 }}>
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Mail size={16} color={Colors.foreground} />
                      <Text style={{ color: Colors.foreground, fontWeight: "500" }}>Verification Code</Text>
                    </View>
                    <Text style={{ color: Colors.mutedForeground, fontSize: 13 }}>
                      Code sent to {maskEmail(email)}
                    </Text>
                    <TextInput
                      style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: "rgba(176,196,208,0.5)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: Colors.foreground, fontSize: 24, letterSpacing: 8, textAlign: "center" }}
                      placeholder="000000"
                      placeholderTextColor={Colors.mutedForeground}
                      value={code}
                      onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyCode}
                      editable={!isLoading}
                    />
                    <Text style={{ color: Colors.mutedForeground, fontSize: 12, textAlign: "center" }}>
                      Code expires in 15 minutes
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleVerifyCode}
                    disabled={code.length !== 6 || isLoading}
                    style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", opacity: (pressed || code.length !== 6 || isLoading) ? 0.75 : 1 })}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Verify Code</Text>
                    )}
                  </Pressable>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={handleResendCode}
                      disabled={isLoading}
                      style={({ pressed }) => ({ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", opacity: pressed || isLoading ? 0.75 : 1 })}
                    >
                      <Text style={{ color: Colors.foreground, fontWeight: "500" }}>Resend Code</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => Linking.openURL("mailto:gws@karmanbeyond.com")}
                      style={({ pressed }) => ({ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.75 : 1 })}
                    >
                      <Text style={{ color: Colors.foreground, fontWeight: "500" }}>Contact Admin</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => setStep("batch")}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 }}
                  >
                    <ArrowLeft size={16} color={Colors.mutedForeground} />
                    <Text style={{ color: Colors.mutedForeground }}>Back</Text>
                  </Pressable>
                </View>
              )}

              {/* Step: Password */}
              {step === "password" && (
                <View style={{ gap: 24 }}>
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
                      onSubmitEditing={handleResetPassword}
                      editable={!isLoading}
                    />
                  </View>

                  <Pressable
                    onPress={handleResetPassword}
                    disabled={isLoading}
                    style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", opacity: pressed || isLoading ? 0.75 : 1 })}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Reset Password</Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => router.replace("/(auth)/login")}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 }}
                  >
                    <ArrowLeft size={16} color={Colors.mutedForeground} />
                    <Text style={{ color: Colors.mutedForeground }}>Back to Login</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

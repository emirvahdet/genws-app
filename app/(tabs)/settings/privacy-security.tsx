import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Shield, MapPin, Eye, EyeOff, Fingerprint } from "lucide-react-native";
import { supabase } from "../../../lib/supabase";
import { useBiometrics } from "../../../hooks/useBiometrics";
import { Colors } from "../../../constants/Colors";

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const {
    isSupported,
    isEnrolled,
    isEnabled,
    biometricType,
    enableBiometricLogin,
    disableBiometricLogin,
    authenticateWithBiometrics,
  } = useBiometrics();
  const [showLocation, setShowLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("profiles")
          .select("show_location")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        if (data) setShowLocation(data.show_location ?? false);
      } catch (e) {
        __DEV__ && console.log("PrivacySecurity fetch error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ show_location: showLocation })
        .eq("id", user.id);
      if (error) throw error;
      Alert.alert("Settings Saved", "Your privacy settings have been updated");
    } catch {
      Alert.alert("Error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Enabling biometric login - need to authenticate and save credentials
      Alert.alert(
        `Enable ${biometricType || 'Biometric'} Login`,
        'To enable biometric login, please enter your credentials.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              Alert.prompt(
                'Batch Number',
                'Enter your batch number',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Next',
                    onPress: (identifier?: string) => {
                      if (!identifier?.trim()) {
                        Alert.alert('Error', 'Batch number is required');
                        return;
                      }
                      Alert.prompt(
                        'Key',
                        'Enter your key',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Enable',
                            onPress: async (password?: string) => {
                              if (!password?.trim()) {
                                Alert.alert('Error', 'Key is required');
                                return;
                              }
                              setBiometricLoading(true);
                              try {
                                const result = await enableBiometricLogin(identifier.trim(), password);
                                if (result.success) {
                                  Alert.alert(
                                    'Success',
                                    `${biometricType || 'Biometric'} login has been enabled.`
                                  );
                                } else {
                                  Alert.alert('Error', result.error || 'Failed to enable biometric login');
                                }
                              } finally {
                                setBiometricLoading(false);
                              }
                            },
                          },
                        ],
                        'secure-text'
                      );
                    },
                  },
                ],
                'plain-text'
              );
            },
          },
        ]
      );
    } else {
      // Disabling biometric login
      Alert.alert(
        `Disable ${biometricType || 'Biometric'} Login`,
        'Are you sure you want to disable biometric login? You will need to enter your credentials manually next time.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              setBiometricLoading(true);
              try {
                const result = await disableBiometricLogin();
                if (result.success) {
                  Alert.alert('Success', 'Biometric login has been disabled.');
                } else {
                  Alert.alert('Error', result.error || 'Failed to disable biometric login');
                }
              } finally {
                setBiometricLoading(false);
              }
            },
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Pressable
            onPress={() => router.replace("/(tabs)/profile" as any)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>
              Privacy & Security
            </Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>
              Manage your privacy and security settings
            </Text>
          </View>
        </View>

        {/* Biometric Authentication Card */}
        {isSupported && isEnrolled && (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 }}>            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
              {/* Fingerprint icon */}
              <View style={{ padding: 12, borderRadius: 12, backgroundColor: Colors.primary + "1A" }}>
                <Fingerprint size={24} color={Colors.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: Colors.foreground, marginBottom: 6 }}>
                  {biometricType || 'Biometric'} Login
                </Text>
                <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 18, marginBottom: 20 }}>
                  Use {biometricType?.toLowerCase() || 'biometric authentication'} to quickly and securely login to your account without entering your credentials.
                </Text>

                {/* Toggle row */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.muted, borderRadius: 12, padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <Fingerprint size={20} color={isEnabled ? Colors.primary : Colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground }}>
                        {biometricType || 'Biometric'} Login
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                        {isEnabled
                          ? `Login quickly with ${biometricType?.toLowerCase() || 'biometrics'}`
                          : "Disabled"
                        }
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={handleBiometricToggle}
                    disabled={biometricLoading}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor="white"
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Location Visibility Card */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
            {/* Shield icon */}
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: Colors.primary + "1A" }}>
              <Shield size={24} color={Colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "600", color: Colors.foreground, marginBottom: 6 }}>
                Location Visibility
              </Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 18, marginBottom: 20 }}>
                Control whether other members can see your city and country information on your profile and in the member directory.
              </Text>

              {/* Toggle row */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.muted, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  {showLocation
                    ? <Eye size={20} color={Colors.primary} />
                    : <EyeOff size={20} color={Colors.mutedForeground} />
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground }}>
                      Show my location
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                      {showLocation
                        ? "Your city and country are visible to other members"
                        : "Your location is hidden from other members"
                      }
                    </Text>
                  </View>
                </View>
                <Switch
                  value={showLocation}
                  onValueChange={setShowLocation}
                  disabled={loading}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor="white"
                />
              </View>

              {/* Warning when hidden */}
              {!showLocation && (
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#fef3c7", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#fbbf24" + "33" }}>
                  <MapPin size={18} color="#d97706" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground, marginBottom: 2 }}>
                      Location Hidden
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground, lineHeight: 16 }}>
                      Your location will not appear on the member map or in search results. You can change this setting at any time.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={saving || loading}
          style={({ pressed }) => ({
            backgroundColor: saving || loading ? Colors.mutedForeground : Colors.primary,
            borderRadius: 14, paddingVertical: 16,
            alignItems: "center", marginBottom: 16,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {saving
            ? <ActivityIndicator size="small" color="white" />
            : <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>Save Settings</Text>
          }
        </Pressable>

        <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center", lineHeight: 18 }}>
          Your privacy is important to us. These settings help you control what information is visible to other members.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

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
import { ArrowLeft, Shield, MapPin, Eye, EyeOff } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const [showLocation, setShowLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

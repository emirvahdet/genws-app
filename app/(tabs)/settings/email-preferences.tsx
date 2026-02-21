import { useState } from "react";
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
import { ArrowLeft } from "lucide-react-native";
import { Colors } from "../../../constants/Colors";

export default function EmailPreferencesScreen() {
  const router = useRouter();
  const [newsletters, setNewsletters] = useState(false);
  const [seasonalEvents, setSeasonalEvents] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      Alert.alert("Preferences Saved", "Your email preferences have been updated");
    } catch {
      Alert.alert("Error", "Failed to save preferences");
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
              Email Preferences
            </Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>
              Manage your email communication preferences
            </Text>
          </View>
        </View>

        {/* Toggles Card */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 }}>
          {/* Newsletters */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground, flex: 1, marginRight: 16 }}>
              Subscribe to newsletters
            </Text>
            <Switch
              value={newsletters}
              onValueChange={setNewsletters}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="white"
            />
          </View>

          <View style={{ height: 1, backgroundColor: Colors.border }} />

          {/* Seasonal Events */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground, flex: 1, marginRight: 16 }}>
              Receive seasonal event emails
            </Text>
            <Switch
              value={seasonalEvents}
              onValueChange={setSeasonalEvents}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => ({
            backgroundColor: saving ? Colors.mutedForeground : Colors.primary,
            borderRadius: 14, paddingVertical: 16,
            alignItems: "center", marginBottom: 16,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {saving
            ? <ActivityIndicator size="small" color="white" />
            : <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>Save Preferences</Text>
          }
        </Pressable>

        <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center", lineHeight: 18 }}>
          You can update these preferences at any time. We respect your privacy and will never share your email with third parties.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

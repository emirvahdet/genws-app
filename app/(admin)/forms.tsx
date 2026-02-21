import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, MessageSquare } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface HelpForm {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_name: string;
  user_email: string;
}

export default function AdminFormsScreen() {
  const router = useRouter();
  const [forms, setForms] = useState<HelpForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchForms(); }, []);

  const fetchForms = async () => {
    try {
      const { data: formsData, error: formsError } = await supabase
        .from("help_forms")
        .select("*")
        .order("created_at", { ascending: false });
      if (formsError) throw formsError;

      if (!formsData || formsData.length === 0) { setForms([]); return; }

      const userIds = [...new Set(formsData.map((f: any) => f.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      const merged = formsData.map((form: any) => {
        const profile = profileMap.get(form.user_id);
        return { ...form, user_name: profile?.full_name || "Unknown User", user_email: profile?.email || "No email" };
      });
      setForms(merged);
    } catch (e) {
      __DEV__ && console.log("Error fetching forms:", e);
      Alert.alert("Error", "Failed to load submitted forms");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable onPress={() => router.replace("/(tabs)/profile" as any)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Admin Forms</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>Member submissions and requests</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ paddingVertical: 48 }} />
        ) : forms.length === 0 ? (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 32, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <MessageSquare size={48} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>No forms submitted yet</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {forms.map((form) => (
              <View key={form.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>{form.user_name}</Text>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{form.user_email}</Text>
                  </View>
                  <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{new Date(form.created_at).toLocaleDateString()}</Text>
                  </View>
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: Colors.border + "4D", paddingTop: 10, marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, color: Colors.foreground, lineHeight: 20 }}>{form.message}</Text>
                </View>
                <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>Submitted on {new Date(form.created_at).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

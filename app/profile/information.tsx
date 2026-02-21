import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, User, MapPin, Target, Sparkles, Activity, Phone, Send } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface ProfileData {
  city: string;
  country: string;
  priorities: string[];
  interests: string[];
  preferred_activities: string[];
  preferred_telephone: string;
  preferred_email: string;
  share_assistant_info: boolean;
  assistant_name: string;
  assistant_telephone: string;
  assistant_email: string;
}

const SectionCard = ({ children }: { children: React.ReactNode }) => (
  <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
    {children}
  </View>
);

const SectionHeader = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <Icon size={16} color={Colors.primary} />
    <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.primary }}>{label}</Text>
  </View>
);

const FieldLabel = ({ label }: { label: string }) => (
  <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, letterSpacing: 0.5, marginBottom: 4 }}>
    {label}
  </Text>
);

const Badge = ({ label }: { label: string }) => (
  <View style={{ borderWidth: 1, borderColor: Colors.primary + "4D", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.primary + "0D" }}>
    <Text style={{ fontSize: 12, color: Colors.primary }}>{label}</Text>
  </View>
);

export default function ProfileInformationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showUpdateRequest, setShowUpdateRequest] = useState(false);
  const [updateRequestMessage, setUpdateRequestMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<ProfileData>({
    city: "", country: "",
    priorities: [], interests: [], preferred_activities: [],
    preferred_telephone: "", preferred_email: "",
    share_assistant_info: false,
    assistant_name: "", assistant_telephone: "", assistant_email: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("city, country, priorities, interests, preferred_activities, preferred_telephone, preferred_email, share_assistant_info, assistant_name, assistant_telephone, assistant_email")
          .eq("id", user.id)
          .single();
        if (profile) {
          setData({
            city: profile.city || "",
            country: profile.country || "",
            priorities: profile.priorities || [],
            interests: profile.interests || [],
            preferred_activities: profile.preferred_activities || [],
            preferred_telephone: profile.preferred_telephone || "",
            preferred_email: profile.preferred_email || "",
            share_assistant_info: profile.share_assistant_info || false,
            assistant_name: profile.assistant_name || "",
            assistant_telephone: profile.assistant_telephone || "",
            assistant_email: profile.assistant_email || "",
          });
        }
      } catch (e) {
        __DEV__ && console.log("ProfileInformation fetch error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmitUpdateRequest = async () => {
    if (!updateRequestMessage.trim()) {
      Alert.alert("Message Required", "Please describe what changes you'd like to make");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("profile_update_requests").insert([{
        user_id: user.id,
        requested_changes: data as any,
        message: updateRequestMessage,
        status: "pending",
      }]);
      if (error) throw error;
      Alert.alert("Request Submitted", "Your profile update request has been sent to administrators");
      setShowUpdateRequest(false);
      setUpdateRequestMessage("");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to submit update request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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
          <User size={20} color={Colors.primary} />
          <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Your Information</Text>
        </View>

        {/* Location */}
        <SectionCard>
          <SectionHeader icon={MapPin} label="Location" />
          <View style={{ flexDirection: "row", gap: 24 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="CITY" />
              <Text style={{ fontSize: 15, color: Colors.foreground }}>{data.city || "Not set"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="COUNTRY" />
              <Text style={{ fontSize: 15, color: Colors.foreground }}>{data.country || "Not set"}</Text>
            </View>
          </View>
        </SectionCard>

        {/* Priorities */}
        <SectionCard>
          <SectionHeader icon={Target} label="Priorities" />
          {data.priorities.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {data.priorities.map((p, i) => <Badge key={i} label={p} />)}
            </View>
          ) : (
            <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>No priorities added yet</Text>
          )}
        </SectionCard>

        {/* Areas of Interest */}
        <SectionCard>
          <SectionHeader icon={Sparkles} label="Areas of Interest" />
          {data.interests.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {data.interests.map((i, idx) => <Badge key={idx} label={i} />)}
            </View>
          ) : (
            <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>No interests added yet</Text>
          )}
        </SectionCard>

        {/* Preferred Activities */}
        <SectionCard>
          <SectionHeader icon={Activity} label="Preferred Activities" />
          {data.preferred_activities.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {data.preferred_activities.map((a, i) => <Badge key={i} label={a} />)}
            </View>
          ) : (
            <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>No preferred activities added yet</Text>
          )}
        </SectionCard>

        {/* Contact Information */}
        <SectionCard>
          <SectionHeader icon={Phone} label="Contact Information" />
          <View style={{ gap: 12 }}>
            <View>
              <FieldLabel label="PREFERRED TELEPHONE" />
              <Text style={{ fontSize: 15, color: Colors.foreground }}>{data.preferred_telephone || "Not set"}</Text>
            </View>
            <View>
              <FieldLabel label="PREFERRED EMAIL" />
              <Text style={{ fontSize: 15, color: Colors.foreground }}>{data.preferred_email || "Not set"}</Text>
            </View>

            {data.share_assistant_info && (data.assistant_name || data.assistant_telephone || data.assistant_email) && (
              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, gap: 10 }}>
                <FieldLabel label="ASSISTANT INFORMATION" />
                {data.assistant_name ? (
                  <View>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>Name</Text>
                    <Text style={{ fontSize: 15, color: Colors.foreground }}>{data.assistant_name}</Text>
                  </View>
                ) : null}
                {data.assistant_telephone ? (
                  <View>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>Telephone</Text>
                    <Text style={{ fontSize: 15, color: Colors.foreground }}>{data.assistant_telephone}</Text>
                  </View>
                ) : null}
                {data.assistant_email ? (
                  <View>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>Email</Text>
                    <Text style={{ fontSize: 15, color: Colors.foreground }}>{data.assistant_email}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </SectionCard>

        {/* Request Update Button */}
        <Pressable
          onPress={() => setShowUpdateRequest(true)}
          style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
            paddingVertical: 16, backgroundColor: "white",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Send size={16} color={Colors.foreground} />
          <Text style={{ fontSize: 15, fontWeight: "500", color: Colors.foreground }}>
            Request to update your profile
          </Text>
        </Pressable>
      </ScrollView>

      {/* Update Request Modal */}
      <Modal
        visible={showUpdateRequest}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUpdateRequest(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 6 }}>
              Request Profile Update
            </Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, marginBottom: 16, lineHeight: 20 }}>
              Describe what changes you'd like to make to your profile. An administrator will review your request.
            </Text>
            <Text style={{ fontSize: 13, color: Colors.foreground, marginBottom: 6 }}>
              What would you like to update?
            </Text>
            <TextInput
              style={{
                backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border,
                borderRadius: 12, padding: 12, color: Colors.foreground, fontSize: 15,
                minHeight: 120, textAlignVertical: "top", marginBottom: 16,
              }}
              placeholder="Please describe the changes you'd like to make to your profile..."
              placeholderTextColor={Colors.mutedForeground}
              value={updateRequestMessage}
              onChangeText={setUpdateRequestMessage}
              multiline
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => { setShowUpdateRequest(false); setUpdateRequestMessage(""); }}
                style={({ pressed }) => ({
                  flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
                  paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontWeight: "500", color: Colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitUpdateRequest}
                disabled={submitting}
                style={({ pressed }) => ({
                  flex: 1, backgroundColor: Colors.primary, borderRadius: 12,
                  paddingVertical: 12, alignItems: "center", flexDirection: "row",
                  justifyContent: "center", gap: 8,
                  opacity: pressed || submitting ? 0.7 : 1,
                })}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="white" />
                  : <>
                      <Send size={14} color="white" />
                      <Text style={{ color: "white", fontWeight: "600" }}>Submit Request</Text>
                    </>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

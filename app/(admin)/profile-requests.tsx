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
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle, XCircle, Clock, User } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface ProfileUpdateRequest {
  id: string;
  user_id: string;
  requested_changes: any;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email: string;
    batch_number: string | null;
  } | null;
}

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; border: string; icon: any; label: string }> = {
    pending: { bg: "#fef3c7", text: "#d97706", border: "#fbbf2433", icon: Clock, label: "Pending" },
    approved: { bg: "#dcfce7", text: "#16a34a", border: "#16a34a33", icon: CheckCircle, label: "Approved" },
    rejected: { bg: "#fee2e2", text: "#dc2626", border: "#dc262633", icon: XCircle, label: "Rejected" },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Icon size={12} color={c.text} />
      <Text style={{ fontSize: 11, color: c.text, fontWeight: "500" }}>{c.label}</Text>
    </View>
  );
};

export default function AdminProfileRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<ProfileUpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ProfileUpdateRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [editedData, setEditedData] = useState<any>({});

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("profile_update_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request: any) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, batch_number")
            .eq("id", request.user_id)
            .single();
          return { ...request, profiles: profile };
        })
      );

      setRequests(requestsWithProfiles);
    } catch (e) {
      __DEV__ && console.log("Error fetching requests:", e);
      Alert.alert("Error", "Failed to load profile update requests");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewRequest = (request: ProfileUpdateRequest) => {
    setSelectedRequest(request);
    setEditedData(request.requested_changes || {});
    setShowApproveModal(true);
  };

  const handleApproveRequest = async () => {
    if (!selectedRequest) return;
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: editedData.full_name,
          generation_number: editedData.generation_number,
          company: editedData.company,
          city: editedData.city,
          country: editedData.country,
          priorities: editedData.priorities,
          interests: editedData.interests,
          preferred_activities: editedData.preferred_activities,
          preferred_telephone: editedData.preferred_telephone,
          preferred_email: editedData.preferred_email,
          share_assistant_info: editedData.share_assistant_info,
          assistant_name: editedData.assistant_name,
          assistant_telephone: editedData.assistant_telephone,
          assistant_email: editedData.assistant_email,
        })
        .eq("id", selectedRequest.user_id);
      if (updateError) throw updateError;

      const { error: statusError } = await supabase
        .from("profile_update_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", selectedRequest.id);
      if (statusError) throw statusError;

      Alert.alert("Request Approved", "Profile has been updated successfully");
      setShowApproveModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (e) {
      __DEV__ && console.log("Error approving request:", e);
      Alert.alert("Error", "Failed to approve request");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    Alert.alert("Reject Request", "Are you sure you want to reject this request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("profile_update_requests")
              .update({
                status: "rejected",
                reviewed_at: new Date().toISOString(),
                reviewed_by: (await supabase.auth.getUser()).data.user?.id,
              })
              .eq("id", requestId);
            if (error) throw error;
            Alert.alert("Request Rejected", "Profile update request has been rejected");
            fetchRequests();
          } catch (e) {
            Alert.alert("Error", "Failed to reject request");
          }
        },
      },
    ]);
  };

  const Field = ({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: any }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.foreground }}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );

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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, opacity: pressed ? 0.6 : 1 })}
        >
          <ArrowLeft size={18} color={Colors.foreground} />
          <Text style={{ fontSize: 13, color: Colors.foreground }}>Back to Admin</Text>
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>
          Profile Update Requests
        </Text>
        <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 20 }}>
          Review and approve member profile change requests
        </Text>

        {requests.length === 0 ? (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 32, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <User size={40} color={Colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>No profile update requests</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {requests.map((request) => (
              <View key={request.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>{request.profiles?.full_name}</Text>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{request.profiles?.email}</Text>
                    {request.profiles?.batch_number && (
                      <Text style={{ fontSize: 11, color: Colors.primary, fontFamily: "monospace" }}>Batch: {request.profiles.batch_number}</Text>
                    )}
                  </View>
                  <StatusBadge status={request.status} />
                </View>

                <View style={{ backgroundColor: Colors.muted, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>User Message:</Text>
                  <Text style={{ fontSize: 13, color: Colors.foreground, lineHeight: 18 }}>{request.message}</Text>
                </View>

                <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 10 }}>
                  Requested: {new Date(request.created_at).toLocaleString()}
                </Text>

                {request.status === "pending" && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => handleReviewRequest(request)}
                      style={({ pressed }) => ({
                        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
                        backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 8,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <CheckCircle size={14} color="white" />
                      <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>Review & Approve</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRejectRequest(request.id)}
                      style={({ pressed }) => ({
                        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
                        backgroundColor: Colors.destructive, borderRadius: 10, paddingVertical: 8,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <XCircle size={14} color="white" />
                      <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>Reject</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Review & Approve Modal */}
      <Modal visible={showApproveModal} transparent animationType="slide" onRequestClose={() => setShowApproveModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>Review Profile Update</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 16 }}>Review and edit the requested changes before approving</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <Field label="Full Name" value={editedData.full_name || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, full_name: t }))} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Company" value={editedData.company || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, company: t }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Generation #" value={editedData.generation_number?.toString() || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, generation_number: t ? parseInt(t) : null }))} keyboardType="numeric" />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="City" value={editedData.city || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, city: t }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Country" value={editedData.country || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, country: t }))} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Preferred Telephone" value={editedData.preferred_telephone || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, preferred_telephone: t }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Preferred Email" value={editedData.preferred_email || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, preferred_email: t }))} />
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: Colors.foreground }}>Share assistant information</Text>
                <Switch
                  value={editedData.share_assistant_info || false}
                  onValueChange={(v) => setEditedData((p: any) => ({ ...p, share_assistant_info: v }))}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor="white"
                />
              </View>

              {editedData.share_assistant_info && (
                <View style={{ paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: Colors.primary + "33" }}>
                  <Field label="Assistant's Name" value={editedData.assistant_name || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, assistant_name: t }))} />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Field label="Assistant's Telephone" value={editedData.assistant_telephone || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, assistant_telephone: t }))} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="Assistant's Email" value={editedData.assistant_email || ""} onChangeText={(t) => setEditedData((p: any) => ({ ...p, assistant_email: t }))} />
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => { setShowApproveModal(false); setSelectedRequest(null); }}
                style={({ pressed }) => ({ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontWeight: "500", color: Colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleApproveRequest}
                style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, opacity: pressed ? 0.85 : 1 })}
              >
                <CheckCircle size={16} color="white" />
                <Text style={{ color: "white", fontWeight: "600" }}>Approve Changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

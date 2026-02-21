import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  MapPin, Lock, Eye, EyeOff, ChevronRight, Mail, Shield,
  HelpCircle, LogOut, Bell, Users, Calendar as CalendarIcon,
  Newspaper, LayoutDashboard, Send, Award, BarChart3, User,
  BookOpen,
} from "lucide-react-native";
import { supabase } from "../../../lib/supabase";
import { useViewAs } from "../../../stores/ViewAsContext";
import { CommitmentSection } from "../../../components/profile/CommitmentSection";
import { Colors } from "../../../constants/Colors";

interface ProfileData {
  full_name: string;
  email: string;
  batch_number: string | null;
  generation_number: number | null;
  company: string;
  city: string;
  country: string;
  priorities: string[];
  interests: string[];
  preferred_activities: string[];
  avatar_url?: string;
}

const getOrdinalSuffix = (n: number) => {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
};

const getInitials = (name: string) => {
  const parts = name.split(" ").filter((n) => n.length > 0);
  if (parts.length >= 3) return (parts[0][0] + parts[1][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts.map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
};

export default function ProfileScreen() {
  const router = useRouter();
  const { isViewingAs, viewAsUser, getEffectiveUserId } = useViewAs();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState<ProfileData>({
    full_name: "", email: "", batch_number: null, generation_number: null,
    company: "", city: "", country: "", priorities: [], interests: [], preferred_activities: [],
  });

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: "", confirmPassword: "" });

  // Update request state
  const [showUpdateRequest, setShowUpdateRequest] = useState(false);
  const [updateRequestMessage, setUpdateRequestMessage] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const effectiveId = getEffectiveUserId(user.id);
      setUserId(effectiveId);
      const { data, error } = await supabase.from("profiles").select("*").eq("id", effectiveId).single();
      if (error) throw error;
      if (data) {
        setFormData({
          ...data,
          priorities: data.priorities || [],
          interests: data.interests || [],
          preferred_activities: data.preferred_activities || [],
        });
      }
    } catch (e) {
      __DEV__ && console.log("Error fetching profile:", e);
    } finally {
      setLoading(false);
    }
  }, [getEffectiveUserId]);

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");
    setIsAdmin(roles != null && roles.length > 0);
  }, []);

  useEffect(() => {
    fetchProfile();
    checkAdmin();
  }, [fetchProfile, checkAdmin]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert("Passwords Don't Match", "Please make sure both passwords are identical.");
      return;
    }
    if (passwordData.newPassword.length < 8) {
      Alert.alert("Password Too Short", "Password must be at least 8 characters long.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      Alert.alert("Password Updated", "Your password has been changed successfully.");
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setShowPasswordChange(false);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to change password");
    }
  };

  const handleSubmitUpdateRequest = async () => {
    if (!updateRequestMessage.trim()) {
      Alert.alert("Message Required", "Please describe what changes you'd like to make.");
      return;
    }
    setSubmittingRequest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("profile_update_requests").insert([{
        user_id: user.id,
        requested_changes: formData as any,
        message: updateRequestMessage,
        status: "pending",
      }]);
      if (error) throw error;
      Alert.alert("Request Submitted", "Your profile update request has been sent to administrators.");
      setShowUpdateRequest(false);
      setUpdateRequestMessage("");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to submit update request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  // Settings sections
  const accountItems = [
    { icon: Mail, label: "Email Preferences", action: () => router.push("/settings/email-preferences" as any) },
    { icon: Lock, label: "Privacy & Security", action: () => router.push("/settings/privacy-security" as any) },
  ];

  if (isAdmin) {
    accountItems.push(
      { icon: CalendarIcon, label: "Admin-Events", action: () => router.push("/(admin)/events" as any) },
      { icon: Users, label: "Admin-Members", action: () => router.push("/(admin)/members" as any) },
      { icon: Users, label: "Admin Groups", action: () => router.push("/(admin)/groups" as any) },
      { icon: Newspaper, label: "Admin-News", action: () => router.push("/(admin)/news" as any) },
      { icon: Bell, label: "Admin-Updates", action: () => router.push("/(admin)/updates" as any) },
      { icon: Mail, label: "Admin-Forms", action: () => router.push("/(admin)/forms" as any) },
      { icon: Award, label: "Admin-Commitments", action: () => router.push("/(admin)/commitments" as any) },
      { icon: BarChart3, label: "Admin Statistics", action: () => router.push("/(admin)/statistics" as any) },
      { icon: LayoutDashboard, label: "Admin Dashboard", action: () => router.push("/(admin)/" as any) },
      { icon: Send, label: "Admin Emails", action: () => router.push("/(admin)/emails" as any) },
    );
  }

  const SETTINGS_SECTIONS = [
    {
      title: "ACCOUNT SETTINGS",
      items: accountItems,
    },
    {
      title: "SUPPORT",
      items: [
        { icon: BookOpen, label: "Society Guidebook", action: () => router.push("/guidebook" as any) },
        { icon: HelpCircle, label: "Help & Support", action: () => router.push("/settings/help-support" as any) },
        { icon: Shield, label: "Terms & Privacy", action: () => router.push("/settings/terms-privacy" as any) },
      ],
    },
  ];

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
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: "600", color: Colors.foreground }}>My Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
            {/* Avatar */}
            <View style={{ alignItems: "center", gap: 6 }}>
              <View style={{ width: 80, height: 80, borderRadius: 16, borderWidth: 1, borderColor: Colors.border + "4D", backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "600", color: Colors.primary }}>
                  {getInitials(formData.full_name)}
                </Text>
              </View>
              {formData.generation_number != null && (
                <View style={{ borderWidth: 1, borderColor: Colors.primary + "4D", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "white" }}>
                  <Text style={{ fontSize: 11, color: Colors.primary }}>
                    {formData.generation_number}{getOrdinalSuffix(formData.generation_number)} Gen
                  </Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 20, fontWeight: "600", color: Colors.foreground }} numberOfLines={1}>
                {formData.full_name}
              </Text>
              {formData.company ? (
                <Text style={{ fontSize: 14, color: Colors.mutedForeground, marginTop: 4 }} numberOfLines={1}>
                  {formData.company}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {formData.batch_number && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: Colors.primary + "4D", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "white" }}>
                    <Lock size={10} color={Colors.primary} />
                    <Text style={{ fontSize: 11, color: Colors.primary }}>Batch: {formData.batch_number}</Text>
                  </View>
                )}
              </View>
              {(formData.city || formData.country) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <MapPin size={12} color={Colors.mutedForeground} />
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground }} numberOfLines={1}>
                    {[formData.city, formData.country].filter(Boolean).join(", ")}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Commitment Section */}
        <View style={{ marginBottom: 12 }}>
          <CommitmentSection />
        </View>

        {/* Your Circle */}
        {userId && (
          <Pressable
            onPress={() => router.push("/connections" as any)}
            style={({ pressed }) => ({
              backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border,
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              marginBottom: 12, opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Users size={20} color={Colors.primary} />
              <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.primary }}>Your Circle</Text>
            </View>
            <ChevronRight size={20} color={Colors.mutedForeground} />
          </Pressable>
        )}

        {/* Personal Information */}
        <Pressable
          onPress={() => router.push("/profile/information" as any)}
          style={({ pressed }) => ({
            backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12, opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <User size={20} color={Colors.primary} />
            <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.primary }}>Personal Information</Text>
          </View>
          <ChevronRight size={20} color={Colors.mutedForeground} />
        </Pressable>

        {/* Password */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Lock size={20} color={Colors.primary} />
            <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.primary }}>Password</Text>
          </View>

          {!showPasswordChange ? (
            <Pressable
              onPress={() => setShowPasswordChange(true)}
              style={({ pressed }) => ({
                borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
                paddingVertical: 10, alignItems: "center", opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontWeight: "500", color: Colors.foreground }}>Change Password</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, color: Colors.foreground }}>New Password</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, paddingRight: 44, color: Colors.foreground, fontSize: 15 }}
                    placeholder="Enter new password"
                    placeholderTextColor={Colors.mutedForeground}
                    secureTextEntry={!showPassword}
                    value={passwordData.newPassword}
                    onChangeText={(t) => setPasswordData((p) => ({ ...p, newPassword: t }))}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}
                  >
                    {showPassword ? <EyeOff size={18} color={Colors.mutedForeground} /> : <Eye size={18} color={Colors.mutedForeground} />}
                  </Pressable>
                </View>
                <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>Must be at least 8 characters</Text>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, color: Colors.foreground }}>Confirm Password</Text>
                <TextInput
                  style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: Colors.foreground, fontSize: 15 }}
                  placeholder="Confirm new password"
                  placeholderTextColor={Colors.mutedForeground}
                  secureTextEntry={!showPassword}
                  value={passwordData.confirmPassword}
                  onChangeText={(t) => setPasswordData((p) => ({ ...p, confirmPassword: t }))}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={handlePasswordChange}
                  style={({ pressed }) => ({ flex: 1, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: "center", opacity: pressed ? 0.8 : 1 })}
                >
                  <Text style={{ color: "white", fontWeight: "600" }}>Update Password</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setShowPasswordChange(false); setPasswordData({ newPassword: "", confirmPassword: "" }); }}
                  style={({ pressed }) => ({ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 10, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ color: Colors.foreground, fontWeight: "500" }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Settings Sections */}
        <View style={{ marginTop: 16, gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: "600", color: Colors.foreground }}>Settings</Text>

          {SETTINGS_SECTIONS.map((section, idx) => (
            <View key={idx} style={{ backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" }}>
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.primary, letterSpacing: 0.5 }}>
                  {section.title}
                </Text>
              </View>
              {section.items.map((item, itemIdx) => (
                <View key={itemIdx}>
                  {itemIdx > 0 && <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: 20 }} />}
                  <Pressable
                    onPress={item.action}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      paddingHorizontal: 20, paddingVertical: 14,
                      backgroundColor: pressed ? Colors.muted : "transparent",
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <item.icon size={20} color={Colors.mutedForeground} />
                      <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.mutedForeground }}>{item.label}</Text>
                    </View>
                    <ChevronRight size={16} color={Colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
              <View style={{ height: 8 }} />
            </View>
          ))}

          {/* Logout */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <LogOut size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Log Out</Text>
          </Pressable>

          {/* App version */}
          <Text style={{ textAlign: "center", fontSize: 12, color: Colors.mutedForeground, marginTop: 4 }}>
            GWS v2.1.12
          </Text>
        </View>
      </ScrollView>

      {/* Update Request Modal */}
      <Modal visible={showUpdateRequest} transparent animationType="slide" onRequestClose={() => setShowUpdateRequest(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 8 }}>Request Profile Update</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, marginBottom: 16, lineHeight: 20 }}>
              Describe what changes you'd like to make to your profile. An administrator will review your request.
            </Text>
            <TextInput
              style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, color: Colors.foreground, fontSize: 15, minHeight: 120, textAlignVertical: "top", marginBottom: 16 }}
              placeholder="Please describe the changes you'd like to make to your profile..."
              placeholderTextColor={Colors.mutedForeground}
              value={updateRequestMessage}
              onChangeText={setUpdateRequestMessage}
              multiline
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => { setShowUpdateRequest(false); setUpdateRequestMessage(""); }}
                style={({ pressed }) => ({ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontWeight: "500", color: Colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitUpdateRequest}
                disabled={submittingRequest}
                style={({ pressed }) => ({ flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: pressed || submittingRequest ? 0.7 : 1 })}
              >
                {submittingRequest
                  ? <ActivityIndicator size="small" color="white" />
                  : <>
                      <Send size={16} color="white" />
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

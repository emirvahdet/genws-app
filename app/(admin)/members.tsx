import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Mail,
  Search,
  CheckCircle,
  Eye,
  ChevronDown,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { useViewAs } from "../../stores/ViewAsContext";

const countries = [
  "Türkiye","United Kingdom","United States","UAE","Germany","France","Italy","Spain",
  "Netherlands","Belgium","Switzerland","Austria","Sweden","Norway","Denmark","Finland",
  "Greece","Portugal","Poland","Czech Republic","Hungary","Romania","Bulgaria","Croatia",
  "Serbia","Russia","Saudi Arabia","Qatar","Kuwait","Bahrain","Oman","Jordan","Lebanon",
  "Egypt","Morocco","South Africa","Nigeria","Kenya","Ghana","China","Japan","South Korea",
  "Singapore","Malaysia","Thailand","Indonesia","Philippines","Vietnam","India","Pakistan",
  "Bangladesh","Australia","New Zealand","Canada","Mexico","Brazil","Argentina","Chile",
  "Colombia","Peru",
];

const countryPhoneCodes: Record<string, string> = {
  Turkey:"90",Turkiye:"90","Türkiye":"90","United Kingdom":"44","United States":"01",UAE:"971",
  Dubai:"971","United Arab Emirates":"971",Germany:"49",France:"33",Italy:"39",Spain:"34",
  Netherlands:"31",Belgium:"32",Switzerland:"41",Austria:"43",Sweden:"46",Norway:"47",
  Denmark:"45",Finland:"358",Greece:"30",Portugal:"351",Poland:"48","Czech Republic":"420",
  Hungary:"36",Romania:"40",Bulgaria:"359",Croatia:"385",Serbia:"381",Russia:"07",
  "Saudi Arabia":"966",Qatar:"974",Kuwait:"965",Bahrain:"973",Oman:"968",Jordan:"962",
  Lebanon:"961",Egypt:"20",Morocco:"212","South Africa":"27",Nigeria:"234",Kenya:"254",
  Ghana:"233",China:"86",Japan:"81","South Korea":"82",Singapore:"65",Malaysia:"60",
  Thailand:"66",Indonesia:"62",Philippines:"63",Vietnam:"84",India:"91",Pakistan:"92",
  Bangladesh:"880",Australia:"61","New Zealand":"64",Canada:"01",Mexico:"52",Brazil:"55",
  Argentina:"54",Chile:"56",Colombia:"57",Peru:"51",
};

interface Member {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  batch_number: string | null;
  company: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  generation_number: number | null;
  interests: string[] | null;
  priorities: string[] | null;
  preferred_activities: string[] | null;
  preferred_telephone: string | null;
  preferred_email: string | null;
  assistant_name: string | null;
  assistant_telephone: string | null;
  assistant_email: string | null;
  share_assistant_info: boolean | null;
  must_reset_password: boolean | null;
  initiation_email_sent: boolean | null;
  has_used_initial_key: boolean | null;
  has_completed_welcome_onboarding: boolean | null;
  has_viewed_events: boolean | null;
  has_joined_event: boolean | null;
}

const getMemberStages = (m: Member) => {
  const s1 = m.has_used_initial_key === true && m.must_reset_password === true;
  const s2 = m.has_used_initial_key === true && m.must_reset_password === false;
  const s3 = s2 && m.has_completed_welcome_onboarding === true;
  const s4 = s3 && m.has_viewed_events === true;
  const s5 = s4 && m.has_joined_event === true;
  return { s1, s2, s3, s4, s5 };
};

const getCurrentStage = (m: Member): { stage: string; name: string } | null => {
  const s = getMemberStages(m);
  if (s.s5) return { stage: "S5", name: "Event Joined" };
  if (s.s4) return { stage: "S4", name: "Events Viewed" };
  if (s.s3) return { stage: "S3", name: "Onboarding" };
  if (s.s2) return { stage: "S2", name: "Password" };
  if (s.s1) return { stage: "S1", name: "Initiated" };
  return null;
};

export default function AdminMembersScreen() {
  const router = useRouter();
  const { startViewAs } = useViewAs();
  const [members, setMembers] = useState<Member[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [showStageFilter, setShowStageFilter] = useState(false);

  // Create member
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", fullName: "", country: "", city: "", password: "" });
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Edit member
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "", email: "", batchNumber: "", company: "", bio: "", city: "", country: "",
    generationNumber: "", interests: "", priorities: "", preferredActivities: "",
    preferredTelephone: "", preferredEmail: "", assistantName: "", assistantTelephone: "", assistantEmail: "",
  });
  const [editPassword, setEditPassword] = useState("");

  // Action states
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);
  const [generatingBatchFor, setGeneratingBatchFor] = useState<string | null>(null);

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at, batch_number, company, bio, city, country, generation_number, interests, priorities, preferred_activities, preferred_telephone, preferred_email, assistant_name, assistant_telephone, assistant_email, share_assistant_info, must_reset_password, initiation_email_sent, has_used_initial_key, has_completed_welcome_onboarding, has_viewed_events, has_joined_event")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMembers(data || []);

      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (adminRoles) setAdminIds(new Set(adminRoles.map((r: any) => r.user_id)));
    } catch (e) {
      __DEV__ && console.log("Error fetching members:", e);
      Alert.alert("Error", "Failed to load members");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); fetchMembers(); }, []);

  // ── Create member ──────────────────────────────────────────────────────────
  const handleCreateMember = async () => {
    const { email, fullName, country, city, password } = createForm;
    if (!fullName.trim() || !email.trim() || !country || !city.trim() || !password.trim()) {
      Alert.alert("Validation Error", "All fields are required");
      return;
    }
    if (password.length < 6) { Alert.alert("Validation Error", "Password must be at least 6 characters"); return; }

    setIsCreating(true);
    try {
      const { error } = await supabase.functions.invoke("create-user", {
        body: { email, fullName, country, city, password },
      });
      if (error) throw error;
      Alert.alert("Member Created", `${fullName} has been added successfully.`);
      setCreateForm({ email: "", fullName: "", country: "", city: "", password: "" });
      setShowCreateModal(false);
      fetchMembers();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create member");
    } finally {
      setIsCreating(false);
    }
  };

  // ── Generate batch number ──────────────────────────────────────────────────
  const handleGenerateBatchNumber = async (member: Member) => {
    if (!member.country) { Alert.alert("Validation Error", "Country field cannot be empty."); return; }
    setGeneratingBatchFor(member.id);
    try {
      const countryName = member.country.includes(",") ? member.country.split(",").pop()?.trim() || member.country : member.country;
      const countryCode = countryPhoneCodes[countryName];
      if (!countryCode) throw new Error(`Country "${countryName}" not supported.`);
      const yearTwoDigit = new Date().getFullYear().toString().slice(-2);
      const { data: batchNumber, error } = await supabase.rpc("generate_batch_number", { country_code: countryCode, year_two_digit: yearTwoDigit });
      if (error) throw error;
      const { error: updateError } = await supabase.from("profiles").update({ batch_number: batchNumber }).eq("id", member.id);
      if (updateError) throw updateError;
      Alert.alert("Success", `Batch number ${batchNumber} generated`);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, batch_number: batchNumber } : m)));
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to generate batch number");
    } finally {
      setGeneratingBatchFor(null);
    }
  };

  // ── Send initiation email ─────────────────────────────────────────────────
  const handleSendInitiationEmail = async (member: Member) => {
    setSendingEmailFor(member.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      const { error } = await supabase.functions.invoke("send-initiation-email", { body: { userId: member.id } });
      if (error) throw error;
      Alert.alert("Success", "Initiation email sent successfully");
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, initiation_email_sent: true } : m)));
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send initiation email");
    } finally {
      setSendingEmailFor(null);
    }
  };

  // ── Delete member ─────────────────────────────────────────────────────────
  const handleDelete = (userId: string) => {
    Alert.alert("Delete Member", "Are you sure? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("profiles").delete().eq("id", userId);
            if (error) throw error;
            Alert.alert("Deleted", "Member has been removed");
            fetchMembers();
          } catch { Alert.alert("Error", "Failed to delete member"); }
        },
      },
    ]);
  };

  // ── Edit member ───────────────────────────────────────────────────────────
  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setEditForm({
      fullName: member.full_name, email: member.email, batchNumber: member.batch_number || "",
      company: member.company || "", bio: member.bio || "", city: member.city || "",
      country: member.country || "", generationNumber: member.generation_number?.toString() || "",
      interests: member.interests?.join(", ") || "", priorities: member.priorities?.join(", ") || "",
      preferredActivities: member.preferred_activities?.join(", ") || "",
      preferredTelephone: member.preferred_telephone || "", preferredEmail: member.preferred_email || "",
      assistantName: member.assistant_name || "", assistantTelephone: member.assistant_telephone || "",
      assistantEmail: member.assistant_email || "",
    });
    setEditPassword("");
    setShowEditModal(true);
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;
    setIsUpdating(true);
    try {
      if (editForm.batchNumber && editForm.batchNumber !== editingMember.batch_number) {
        const { data: existing } = await supabase.from("profiles").select("id").eq("batch_number", editForm.batchNumber).neq("id", editingMember.id).maybeSingle();
        if (existing) { Alert.alert("Validation Error", "This batch number is already assigned"); setIsUpdating(false); return; }
      }
      const parse = (s: string) => s.trim() ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
      const { error } = await supabase.from("profiles").update({
        full_name: editForm.fullName.trim(), email: editForm.email.trim(),
        batch_number: editForm.batchNumber.trim() || null, company: editForm.company.trim() || null,
        bio: editForm.bio.trim() || null, city: editForm.city.trim() || null,
        country: editForm.country.trim() || null,
        generation_number: editForm.generationNumber ? parseInt(editForm.generationNumber) : null,
        interests: parse(editForm.interests).length > 0 ? parse(editForm.interests) : null,
        priorities: parse(editForm.priorities).length > 0 ? parse(editForm.priorities) : null,
        preferred_activities: parse(editForm.preferredActivities).length > 0 ? parse(editForm.preferredActivities) : null,
        preferred_telephone: editForm.preferredTelephone.trim() || null,
        preferred_email: editForm.preferredEmail.trim() || null,
        assistant_name: editForm.assistantName.trim() || null,
        assistant_telephone: editForm.assistantTelephone.trim() || null,
        assistant_email: editForm.assistantEmail.trim() || null,
      }).eq("id", editingMember.id);
      if (error) throw error;

      const pw = editPassword.trim();
      if (pw) {
        if (pw.length < 6) { Alert.alert("Validation Error", "Password must be at least 6 characters"); }
        else {
          const { error: pwError } = await supabase.functions.invoke("admin-change-password", { body: { userId: editingMember.id, newPassword: pw } });
          if (pwError) throw pwError;
        }
      }
      Alert.alert("Member Updated", pw ? "Details and password updated" : "Details updated");
      setShowEditModal(false);
      setEditingMember(null);
      setEditPassword("");
      fetchMembers();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update member");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReactivateInitiation = async () => {
    if (!editingMember) return;
    try {
      const { error } = await supabase.from("profiles").update({ initiation_email_sent: false, has_used_initial_key: false }).eq("id", editingMember.id);
      if (error) throw error;
      Alert.alert("Initiation Reactivated", "The initiation email button has been reactivated");
      fetchMembers();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to reactivate initiation");
    }
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredMembers = members.filter((m) => {
    if (selectedStages.length > 0) {
      const cs = getCurrentStage(m);
      if (!cs || !selectedStages.includes(cs.stage)) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) ||
      m.batch_number?.toLowerCase().includes(q) || m.company?.toLowerCase().includes(q) ||
      m.city?.toLowerCase().includes(q) || m.country?.toLowerCase().includes(q)
    );
  });

  const getStageCount = (stage: string) => members.filter((m) => getCurrentStage(m)?.stage === stage).length;
  const toggleStage = (stage: string) => setSelectedStages((prev) => prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]);

  const EF = ({ label, value, onChangeText, placeholder, multiline, keyboardType, hint }: any) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 9, fontSize: 13, color: Colors.foreground, ...(multiline ? { minHeight: 60, textAlignVertical: "top" as const } : {}) }}
        value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.mutedForeground}
        multiline={multiline} keyboardType={keyboardType}
      />
      {hint && <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>{hint}</Text>}
    </View>
  );

  const renderMemberCard = ({ item: member }: { item: Member }) => {
    const currentStage = getCurrentStage(member);
    const showInitiation = !adminIds.has(member.id) && !member.initiation_email_sent && !member.has_used_initial_key;

    return (
      <View style={{ backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 }}>
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }} numberOfLines={1}>{member.full_name}</Text>
            {currentStage && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                <CheckCircle size={10} color="#16a34a" />
                <Text style={{ fontSize: 10, color: "#16a34a" }}>{currentStage.name}</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{member.email}</Text>
          {member.batch_number && <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>Batch: {member.batch_number}</Text>}
          <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>Joined: {new Date(member.created_at).toLocaleDateString()}</Text>
        </View>

        {/* Initiation actions */}
        {showInitiation && (
          <View style={{ marginBottom: 8 }}>
            {!member.batch_number ? (
              <Pressable
                onPress={() => handleGenerateBatchNumber(member)}
                disabled={generatingBatchFor === member.id}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 8, opacity: pressed || generatingBatchFor === member.id ? 0.7 : 1 })}
              >
                <Mail size={12} color="white" />
                <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{generatingBatchFor === member.id ? "Generating..." : "Generate Batch No"}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => handleSendInitiationEmail(member)}
                disabled={sendingEmailFor === member.id}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 8, opacity: pressed || sendingEmailFor === member.id ? 0.7 : 1 })}
              >
                <Mail size={12} color="white" />
                <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{sendingEmailFor === member.id ? "Sending..." : "Send Initiation Email"}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => {
              startViewAs({ id: member.id, full_name: member.full_name, email: member.email });
              router.push("/(tabs)");
            }}
            style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Eye size={12} color={Colors.foreground} />
            <Text style={{ fontSize: 11, color: Colors.foreground }}>View As</Text>
          </Pressable>
          <Pressable
            onPress={() => openEditModal(member)}
            style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Edit size={12} color={Colors.foreground} />
            <Text style={{ fontSize: 11, color: Colors.foreground }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => handleDelete(member.id)}
            style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: Colors.destructive, borderRadius: 10, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Trash2 size={12} color="white" />
            <Text style={{ fontSize: 11, color: "white" }}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
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
      <View style={{ padding: 16, paddingBottom: 0 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Pressable onPress={() => router.replace("/(tabs)/profile" as any)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Manage Members</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Total members: {members.length}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "white", borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10 }}>
          <Search size={16} color={Colors.mutedForeground} />
          <TextInput
            style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14, color: Colors.foreground }}
            placeholder="Search by name, email, batch..."
            placeholderTextColor={Colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Stage filter */}
        <Pressable
          onPress={() => setShowStageFilter(!showStageFilter)}
          style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            borderWidth: 1, borderColor: selectedStages.length > 0 ? Colors.primary : Colors.border,
            backgroundColor: selectedStages.length > 0 ? Colors.primary + "1A" : "white",
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ fontSize: 13, color: selectedStages.length > 0 ? "white" : Colors.mutedForeground }}>
            {selectedStages.length > 0 ? `${selectedStages.length} Stage${selectedStages.length > 1 ? "s" : ""} Selected` : "Filter by Stage"}
          </Text>
          <ChevronDown size={16} color={selectedStages.length > 0 ? "white" : Colors.mutedForeground} />
        </Pressable>

        {showStageFilter && (
          <View style={{ backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 10 }}>
            {[
              { id: "S1", name: "Initiated" }, { id: "S2", name: "Password" },
              { id: "S3", name: "Onboarding" }, { id: "S4", name: "Events Viewed" },
              { id: "S5", name: "Event Joined" },
            ].map((stage) => (
              <Pressable
                key={stage.id}
                onPress={() => toggleStage(stage.id)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: selectedStages.includes(stage.id) ? Colors.primary : Colors.border, backgroundColor: selectedStages.includes(stage.id) ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                    {selectedStages.includes(stage.id) && <CheckCircle size={14} color="white" />}
                  </View>
                  <Text style={{ fontSize: 13, color: Colors.foreground }}>{stage.id} - {stage.name}</Text>
                </View>
                <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>({getStageCount(stage.id)})</Text>
              </Pressable>
            ))}
            {selectedStages.length > 0 && (
              <Pressable onPress={() => setSelectedStages([])} style={{ marginTop: 8, alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Clear Filter</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Add Member Button */}
        <Pressable
          onPress={() => setShowCreateModal(true)}
          style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginBottom: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Plus size={16} color="white" />
          <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>Add New Member</Text>
        </Pressable>
      </View>

      {/* Member List */}
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id}
        renderItem={renderMemberCard}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 32, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>No members found</Text>
          </View>
        }
      />

      {/* ── Create Member Modal ─────────────────────────────────────────────── */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 16 }}>Create New Member</Text>
            <EF label="Full Name *" value={createForm.fullName} onChangeText={(t: string) => setCreateForm((p) => ({ ...p, fullName: t }))} placeholder="John Doe" />
            <EF label="Email *" value={createForm.email} onChangeText={(t: string) => setCreateForm((p) => ({ ...p, email: t }))} placeholder="john@example.com" keyboardType="email-address" />

            {/* Country picker */}
            <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Country *</Text>
            <Pressable
              onPress={() => setShowCountryPicker(true)}
              style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, marginBottom: 10 }}
            >
              <Text style={{ fontSize: 13, color: createForm.country ? Colors.foreground : Colors.mutedForeground }}>
                {createForm.country || "Select country"}
              </Text>
            </Pressable>

            <EF label="City *" value={createForm.city} onChangeText={(t: string) => setCreateForm((p) => ({ ...p, city: t }))} placeholder="Istanbul" />
            <EF label="Password *" value={createForm.password} onChangeText={(t: string) => setCreateForm((p) => ({ ...p, password: t }))} placeholder="Enter password" />

            <Pressable
              onPress={handleCreateMember}
              disabled={isCreating}
              style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed || isCreating ? 0.7 : 1, marginTop: 8 })}
            >
              {isCreating ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: "white", fontWeight: "600" }}>Create Member</Text>}
            </Pressable>
            <Pressable onPress={() => setShowCreateModal(false)} style={{ marginTop: 10, alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ color: Colors.mutedForeground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "70%" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground, marginBottom: 12 }}>Select Country</Text>
            <FlatList
              data={countries}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setCreateForm((p) => ({ ...p, country: item })); setShowCountryPicker(false); }}
                  style={({ pressed }) => ({ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ fontSize: 14, color: Colors.foreground }}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Edit Member Modal ───────────────────────────────────────────────── */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 16 }}>Edit Member Details</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <EF label="Full Name *" value={editForm.fullName} onChangeText={(t: string) => setEditForm((p) => ({ ...p, fullName: t }))} />
              <EF label="Email *" value={editForm.email} onChangeText={(t: string) => setEditForm((p) => ({ ...p, email: t }))} keyboardType="email-address" />
              <EF label="Batch Number" value={editForm.batchNumber} onChangeText={(t: string) => setEditForm((p) => ({ ...p, batchNumber: t }))} hint="Must be unique" />
              <EF label="Company" value={editForm.company} onChangeText={(t: string) => setEditForm((p) => ({ ...p, company: t }))} />
              <EF label="Generation Number" value={editForm.generationNumber} onChangeText={(t: string) => setEditForm((p) => ({ ...p, generationNumber: t }))} keyboardType="numeric" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><EF label="City" value={editForm.city} onChangeText={(t: string) => setEditForm((p) => ({ ...p, city: t }))} /></View>
                <View style={{ flex: 1 }}><EF label="Country" value={editForm.country} onChangeText={(t: string) => setEditForm((p) => ({ ...p, country: t }))} /></View>
              </View>
              <EF label="Bio" value={editForm.bio} onChangeText={(t: string) => setEditForm((p) => ({ ...p, bio: t }))} multiline />
              <EF label="Areas of Interest" value={editForm.interests} onChangeText={(t: string) => setEditForm((p) => ({ ...p, interests: t }))} multiline hint="Comma-separated" />
              <EF label="Priorities" value={editForm.priorities} onChangeText={(t: string) => setEditForm((p) => ({ ...p, priorities: t }))} multiline hint="Comma-separated" />
              <EF label="Preferred Activities" value={editForm.preferredActivities} onChangeText={(t: string) => setEditForm((p) => ({ ...p, preferredActivities: t }))} multiline hint="Comma-separated" />

              <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground, marginBottom: 8 }}>Contact Information</Text>
                <EF label="Preferred Telephone" value={editForm.preferredTelephone} onChangeText={(t: string) => setEditForm((p) => ({ ...p, preferredTelephone: t }))} keyboardType="phone-pad" />
                <EF label="Preferred Email" value={editForm.preferredEmail} onChangeText={(t: string) => setEditForm((p) => ({ ...p, preferredEmail: t }))} keyboardType="email-address" />
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground, marginBottom: 8 }}>Assistant Information</Text>
                <EF label="Assistant Name" value={editForm.assistantName} onChangeText={(t: string) => setEditForm((p) => ({ ...p, assistantName: t }))} />
                <EF label="Assistant Telephone" value={editForm.assistantTelephone} onChangeText={(t: string) => setEditForm((p) => ({ ...p, assistantTelephone: t }))} keyboardType="phone-pad" />
                <EF label="Assistant Email" value={editForm.assistantEmail} onChangeText={(t: string) => setEditForm((p) => ({ ...p, assistantEmail: t }))} keyboardType="email-address" />
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 8 }}>
                <EF label="New Password (admin only)" value={editPassword} onChangeText={setEditPassword} placeholder="Leave blank to keep current" />
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 8 }}>
                <Pressable
                  onPress={handleReactivateInitiation}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
                >
                  <Mail size={14} color={Colors.foreground} />
                  <Text style={{ fontSize: 13, color: Colors.foreground }}>Reactivate Initiation Email</Text>
                </Pressable>
                <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 6, textAlign: "center" }}>
                  This will reset the initiation status
                </Text>
              </View>
            </ScrollView>

            <Pressable
              onPress={handleUpdateMember}
              disabled={isUpdating}
              style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed || isUpdating ? 0.7 : 1, marginBottom: 8 })}
            >
              {isUpdating ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: "white", fontWeight: "600" }}>Update Member</Text>}
            </Pressable>
            <Pressable onPress={() => { setShowEditModal(false); setEditingMember(null); }} style={{ alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ color: Colors.mutedForeground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

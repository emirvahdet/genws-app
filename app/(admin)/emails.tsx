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
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Plus,
  Send,
  Mail,
  Calendar,
  Users,
  Trash2,
  X,
  Zap,
  Power,
  Check,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface Email {
  id: string;
  subject: string;
  content: string;
  use_header: boolean;
  status: string;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
  email_type: string;
  action_trigger: string | null;
  is_active: boolean;
}

interface Member {
  id: string;
  email: string;
  full_name: string;
}

const ACTION_TRIGGERS = [
  { value: "commitment_completed", label: "When somebody gets committed" },
];

const PERSONALIZATION_FIELDS = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Full Name", value: "{{full_name}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Company", value: "{{company}}" },
  { label: "City", value: "{{city}}" },
  { label: "Country", value: "{{country}}" },
];

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
};

export default function AdminEmailsScreen() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [useHeader, setUseHeader] = useState(true);
  const [emailType, setEmailType] = useState<"newsletter" | "canned">("newsletter");
  const [actionTrigger, setActionTrigger] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Test email
  const [testMemberSearch, setTestMemberSearch] = useState("");
  const [testRecipient, setTestRecipient] = useState<Member | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  // Send flow
  const [sendingEmail, setSendingEmail] = useState<Email | null>(null);
  const [sending, setSending] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"include" | "exclude">("exclude");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  // Canned send
  const [showCannedSendModal, setShowCannedSendModal] = useState(false);
  const [cannedEmail, setCannedEmail] = useState<Email | null>(null);
  const [cannedSendMode, setCannedSendMode] = useState<"all" | "select">("all");
  const [committedMembers, setCommittedMembers] = useState<Member[]>([]);
  const [selectedCommittedMembers, setSelectedCommittedMembers] = useState<string[]>([]);
  const [committedSearch, setCommittedSearch] = useState("");
  const [sendingCanned, setSendingCanned] = useState(false);

  useEffect(() => { fetchEmails(); fetchMembers(); }, []);

  const fetchEmails = async () => {
    try {
      const { data, error } = await supabase.from("newsletters").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setEmails(data || []);
    } catch (e) {
      Alert.alert("Error", "Failed to fetch emails");
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name").order("full_name");
      if (error) throw error;
      setMembers(data || []);
    } catch (e) { __DEV__ && console.log("Error fetching members:", e); }
  };

  // ── Editor ────────────────────────────────────────────────────────────────
  const resetEditor = () => {
    setShowEditor(false);
    setEditingId(null);
    setSubject("");
    setContent("");
    setUseHeader(true);
    setEmailType("newsletter");
    setActionTrigger("");
    setIsActive(true);
    setTestRecipient(null);
    setTestMemberSearch("");
  };

  const handleEdit = (email: Email) => {
    setEditingId(email.id);
    setSubject(email.subject);
    setContent(email.content);
    setUseHeader(email.use_header);
    setEmailType((email.email_type as "newsletter" | "canned") || "newsletter");
    setActionTrigger(email.action_trigger || "");
    setIsActive(email.is_active ?? true);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!subject.trim() || !content.trim()) { Alert.alert("Validation Error", "Subject and content are required"); return; }
    if (emailType === "canned" && !actionTrigger) { Alert.alert("Validation Error", "Please select an action trigger"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (editingId) {
        const { error } = await supabase.from("newsletters").update({ subject, content, use_header: useHeader, email_type: emailType, action_trigger: emailType === "canned" ? actionTrigger : null, is_active: emailType === "canned" ? isActive : true }).eq("id", editingId);
        if (error) throw error;
        Alert.alert("Success", "Email template updated");
      } else {
        const { error } = await supabase.from("newsletters").insert({ subject, content, use_header: useHeader, created_by: user.id, email_type: emailType, action_trigger: emailType === "canned" ? actionTrigger : null, is_active: emailType === "canned" ? isActive : true });
        if (error) throw error;
        Alert.alert("Success", emailType === "canned" ? "Canned email saved" : "Email saved as draft");
      }
      resetEditor();
      fetchEmails();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save email");
    }
  };

  const handleSendTest = async () => {
    if (!testRecipient) { Alert.alert("Error", "Please select a member"); return; }
    if (!subject.trim() || !content.trim()) { Alert.alert("Error", "Subject and content are required"); return; }
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke("send-newsletter", { body: { testEmail: testRecipient.email, testUserId: testRecipient.id, subject, content, useHeader } });
      if (error) throw error;
      Alert.alert("Success", `Test email sent to ${testRecipient.full_name}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete Email", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          setDeleting(id);
          try {
            const { error } = await supabase.from("newsletters").delete().eq("id", id);
            if (error) throw error;
            fetchEmails();
          } catch { Alert.alert("Error", "Failed to delete email"); }
          finally { setDeleting(null); }
        },
      },
    ]);
  };

  // ── Send Flow ─────────────────────────────────────────────────────────────
  const openSendFlow = (email: Email) => {
    setSendingEmail(email);
    setSelectedMembers([]);
    setSelectionMode("exclude");
    setMemberSearch("");
    setShowSendModal(true);
  };

  const getRecipientCount = () => selectionMode === "include" ? selectedMembers.length : members.length - selectedMembers.length;

  const handleSend = async () => {
    if (!sendingEmail) return;
    const count = getRecipientCount();
    Alert.alert("Send Email?", `"${sendingEmail.subject}" will be sent to ${count} ${count === 1 ? "person" : "people"}. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send", style: "destructive",
        onPress: async () => {
          setSending(true);
          try {
            const body: any = { newsletterId: sendingEmail.id };
            if (selectionMode === "include" && selectedMembers.length > 0) body.includedUserIds = selectedMembers;
            else if (selectionMode === "exclude" && selectedMembers.length > 0) body.excludedUserIds = selectedMembers;
            const { data, error } = await supabase.functions.invoke("send-newsletter", { body });
            if (error) throw error;
            Alert.alert("Success", `Email sent to ${data.sentCount} members`);
            setShowSendModal(false);
            setSendingEmail(null);
            fetchEmails();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to send email");
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  const toggleMember = (id: string) => setSelectedMembers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  // ── Canned Send ───────────────────────────────────────────────────────────
  const openCannedSendDialog = async (email: Email) => {
    setCannedEmail(email);
    setCannedSendMode("all");
    setSelectedCommittedMembers([]);
    setCommittedSearch("");
    try {
      const { data: commitments } = await supabase.from("commitments").select("user_id").eq("status", "active");
      const allUserIds: string[] = [];
      if (commitments && commitments.length > 0) {
        const primaryIds = commitments.map((c: any) => c.user_id);
        allUserIds.push(...primaryIds);
        const { data: familyMemberships } = await supabase.from("family_memberships").select("id, primary_member_id").in("primary_member_id", primaryIds).eq("is_active", true);
        if (familyMemberships && familyMemberships.length > 0) {
          const { data: familyMembers } = await supabase.from("family_membership_members").select("member_id").in("family_membership_id", familyMemberships.map((f: any) => f.id));
          (familyMembers || []).forEach((fm: any) => { if (!allUserIds.includes(fm.member_id)) allUserIds.push(fm.member_id); });
        }
      }
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, email, full_name").in("id", allUserIds).order("full_name");
        setCommittedMembers(profiles || []);
      } else {
        setCommittedMembers([]);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to fetch committed members");
    }
    setShowCannedSendModal(true);
  };

  const handleSendCanned = async () => {
    if (!cannedEmail) return;
    const recipientIds = cannedSendMode === "all" ? committedMembers.map((m) => m.id) : selectedCommittedMembers;
    if (recipientIds.length === 0) { Alert.alert("Error", "Please select at least one member"); return; }
    setSendingCanned(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-newsletter", { body: { actionTrigger: cannedEmail.action_trigger, recipientIds } });
      if (error) throw error;
      Alert.alert("Success", `Email sent to ${data.sentCount || recipientIds.length} committed members`);
      setShowCannedSendModal(false);
      setCannedEmail(null);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send email");
    } finally {
      setSendingCanned(false);
    }
  };

  const toggleCommittedMember = (id: string) => setSelectedCommittedMembers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const getActionTriggerLabel = (trigger: string | null) => {
    if (!trigger) return "";
    return ACTION_TRIGGERS.find((t) => t.value === trigger)?.label || trigger;
  };

  const filteredSendMembers = members.filter((m) => m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase()));
  const filteredTestMembers = members.filter((m) => m.full_name.toLowerCase().includes(testMemberSearch.toLowerCase()) || m.email.toLowerCase().includes(testMemberSearch.toLowerCase()));
  const filteredCommittedMembers = committedMembers.filter((m) => m.full_name.toLowerCase().includes(committedSearch.toLowerCase()) || m.email.toLowerCase().includes(committedSearch.toLowerCase()));

  // ── Editor Screen ─────────────────────────────────────────────────────────
  if (showEditor) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <Pressable onPress={resetEditor} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
              <ArrowLeft size={22} color={Colors.foreground} />
            </Pressable>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>{editingId ? "Edit Email" : "New Email"}</Text>
          </View>

          {/* Email Type */}
          {!editingId && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Email Type</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["newsletter", "canned"] as const).map((t) => (
                  <Pressable key={t} onPress={() => setEmailType(t)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: emailType === t ? Colors.primary : Colors.border, backgroundColor: emailType === t ? Colors.primary + "1A" : "white" }}>
                    <Text style={{ fontSize: 12, fontWeight: "500", color: emailType === t ? Colors.primary : Colors.mutedForeground, textTransform: "capitalize" }}>{t === "canned" ? "Canned (Automated)" : "Newsletter"}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 4 }}>{emailType === "newsletter" ? "Newsletters are sent manually" : "Canned emails are sent automatically"}</Text>
            </View>
          )}

          {/* Action Trigger */}
          {emailType === "canned" && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Action Trigger *</Text>
              {ACTION_TRIGGERS.map((t) => (
                <Pressable key={t.value} onPress={() => setActionTrigger(t.value)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderColor: actionTrigger === t.value ? Colors.primary : Colors.border, borderRadius: 10, backgroundColor: actionTrigger === t.value ? Colors.primary + "1A" : "white", marginBottom: 6 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: actionTrigger === t.value ? Colors.primary : Colors.border, backgroundColor: actionTrigger === t.value ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                    {actionTrigger === t.value && <Check size={12} color="white" />}
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.foreground }}>{t.label}</Text>
                </Pressable>
              ))}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, marginTop: 6, backgroundColor: Colors.muted }}>
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Power size={14} color={Colors.foreground} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground }}>Active Status</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>{isActive ? "Will be sent when action occurs" : "Inactive, won't be sent"}</Text>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="white" />
              </View>
            </View>
          )}

          {/* Subject */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Subject *</Text>
            <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.foreground }} value={subject} onChangeText={setSubject} placeholder="Email subject..." placeholderTextColor={Colors.mutedForeground} />
          </View>

          {/* Use Header */}
          <Pressable onPress={() => setUseHeader(!useHeader)} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: useHeader ? Colors.primary : Colors.border, backgroundColor: useHeader ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
              {useHeader && <Check size={14} color="white" />}
            </View>
            <Text style={{ fontSize: 13, color: Colors.foreground }}>Use GWS header template</Text>
          </Pressable>

          {/* Personalization Fields */}
          <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, backgroundColor: Colors.muted, marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>Personalization Fields</Text>
            <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 8 }}>Tap to insert placeholders that get replaced with user data.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {PERSONALIZATION_FIELDS.map((f) => (
                <Pressable key={f.value} onPress={() => setContent((prev) => prev + ` ${f.value}`)} style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "white", opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ fontSize: 11, color: Colors.foreground }}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Content */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Email Content *</Text>
            <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.foreground, minHeight: 160, textAlignVertical: "top" }} value={content} onChangeText={setContent} multiline placeholder="Write your email content here..." placeholderTextColor={Colors.mutedForeground} />
          </View>

          {/* Test Email */}
          <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, backgroundColor: Colors.muted, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground, marginBottom: 8 }}>Send Test Email</Text>
            {testRecipient ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary + "1A", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: Colors.primary }}>{testRecipient.full_name} ({testRecipient.email})</Text>
                <Pressable onPress={() => setTestRecipient(null)}><X size={14} color={Colors.primary} /></Pressable>
              </View>
            ) : (
              <>
                <TextInput style={{ backgroundColor: "white", borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, fontSize: 12, color: Colors.foreground, marginBottom: 6 }} placeholder="Search member..." placeholderTextColor={Colors.mutedForeground} value={testMemberSearch} onChangeText={setTestMemberSearch} />
                {testMemberSearch.length >= 2 && (
                  <View style={{ maxHeight: 120, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, marginBottom: 6 }}>
                    <ScrollView nestedScrollEnabled>
                      {filteredTestMembers.slice(0, 10).map((m) => (
                        <Pressable key={m.id} onPress={() => { setTestRecipient(m); setTestMemberSearch(""); }} style={({ pressed }) => ({ padding: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + "33", opacity: pressed ? 0.7 : 1 })}>
                          <Text style={{ fontSize: 12, fontWeight: "500" }}>{m.full_name}</Text>
                          <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{m.email}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}
            <Pressable onPress={handleSendTest} disabled={sendingTest || !testRecipient} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, backgroundColor: "white", opacity: pressed || sendingTest || !testRecipient ? 0.6 : 1 })}>
              {sendingTest ? <ActivityIndicator size="small" color={Colors.primary} /> : <><Send size={12} color={Colors.foreground} /><Text style={{ fontSize: 12, color: Colors.foreground }}>Send Test</Text></>}
            </Pressable>
          </View>

          {/* Save */}
          <Pressable onPress={handleSave} style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1, marginBottom: 8 })}>
            <Text style={{ color: "white", fontWeight: "600" }}>{emailType === "canned" ? "Save Canned Email" : "Save Draft"}</Text>
          </Pressable>
          <Pressable onPress={resetEditor} style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ fontWeight: "500", color: Colors.foreground }}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Email List ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Email Management</Text>
        </View>

        <Pressable onPress={() => { resetEditor(); setShowEditor(true); }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginBottom: 16, opacity: pressed ? 0.85 : 1 })}>
          <Plus size={16} color="white" /><Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>Create New Email</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ paddingVertical: 48 }} />
        ) : emails.length === 0 ? (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 32, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <Mail size={48} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>No emails yet</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {emails.map((email) => (
              <View key={email.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground, marginBottom: 6 }} numberOfLines={1}>{email.subject}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                  <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 3 }}>
                    {email.email_type === "canned" && <Zap size={10} color={Colors.mutedForeground} />}
                    <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{email.email_type === "canned" ? "Canned" : "Newsletter"}</Text>
                  </View>
                  <View style={{ backgroundColor: email.status === "sent" ? "#dcfce7" : "#f3f4f6", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, color: email.status === "sent" ? "#16a34a" : "#6b7280" }}>{email.status === "sent" ? "Sent" : "Draft"}</Text>
                  </View>
                  {email.use_header && <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 10, color: Colors.mutedForeground }}>With Header</Text></View>}
                  {email.email_type === "canned" && (
                    <View style={{ backgroundColor: email.is_active ? "#dcfce7" : "#f3f4f6", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, color: email.is_active ? "#16a34a" : "#6b7280" }}>{email.is_active ? "Active" : "Inactive"}</Text>
                    </View>
                  )}
                </View>
                {email.email_type === "canned" && email.action_trigger && (
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 4 }}>Trigger: {getActionTriggerLabel(email.action_trigger)}</Text>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Calendar size={12} color={Colors.mutedForeground} />
                    <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{fmtDate(email.created_at)}</Text>
                  </View>
                  {email.sent_at && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Users size={12} color={Colors.mutedForeground} />
                      <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{email.sent_count} sent</Text>
                    </View>
                  )}
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Pressable onPress={() => handleEdit(email)} style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
                    <Text style={{ fontSize: 12, color: Colors.foreground }}>Edit</Text>
                  </Pressable>
                  {email.email_type === "canned" ? (
                    <Pressable onPress={() => openCannedSendDialog(email)} disabled={sendingCanned || !email.is_active} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, opacity: pressed || sendingCanned || !email.is_active ? 0.6 : 1 })}>
                      <Send size={12} color="white" /><Text style={{ fontSize: 12, color: "white", fontWeight: "500" }}>Send to Committed</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => openSendFlow(email)} disabled={sending} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, opacity: pressed || sending ? 0.6 : 1 })}>
                      <Send size={12} color="white" /><Text style={{ fontSize: 12, color: "white", fontWeight: "500" }}>{email.status === "sent" ? "Resend" : "Send"}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => handleDelete(email.id)} disabled={deleting === email.id} style={({ pressed }) => ({ backgroundColor: Colors.destructive, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, opacity: pressed || deleting === email.id ? 0.6 : 1 })}>
                    {deleting === email.id ? <ActivityIndicator size="small" color="white" /> : <Trash2 size={14} color="white" />}
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Send Modal (Newsletter) ──────────────────────────────────────── */}
      <Modal visible={showSendModal} transparent animationType="slide" onRequestClose={() => { setShowSendModal(false); setSendingEmail(null); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "80%" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>Send Email</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 12 }}>{sendingEmail?.subject}</Text>

            {/* Mode toggle */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <Pressable onPress={() => { setSelectionMode("include"); setSelectedMembers([]); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: selectionMode === "include" ? Colors.primary : Colors.border, backgroundColor: selectionMode === "include" ? Colors.primary + "1A" : "white" }}>
                <Text style={{ fontSize: 11, color: selectionMode === "include" ? Colors.primary : Colors.mutedForeground }}>Send only to selected</Text>
              </Pressable>
              <Pressable onPress={() => { setSelectionMode("exclude"); setSelectedMembers([]); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: selectionMode === "exclude" ? Colors.primary : Colors.border, backgroundColor: selectionMode === "exclude" ? Colors.primary + "1A" : "white" }}>
                <Text style={{ fontSize: 11, color: selectionMode === "exclude" ? Colors.primary : Colors.mutedForeground }}>All except selected</Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 8 }}>Recipients: {getRecipientCount()} / {members.length}</Text>

            <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, fontSize: 12, color: Colors.foreground, marginBottom: 8 }} placeholder="Search members..." placeholderTextColor={Colors.mutedForeground} value={memberSearch} onChangeText={setMemberSearch} />

            <View style={{ maxHeight: 200, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, marginBottom: 12 }}>
              <FlatList
                data={filteredSendMembers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable onPress={() => toggleMember(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "33", backgroundColor: selectedMembers.includes(item.id) ? (selectionMode === "include" ? Colors.primary + "0D" : Colors.destructive + "0D") : "transparent" }}>
                    <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: selectedMembers.includes(item.id) ? Colors.primary : Colors.border, backgroundColor: selectedMembers.includes(item.id) ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                      {selectedMembers.includes(item.id) && <Check size={12} color="white" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: "500" }} numberOfLines={1}>{item.full_name}</Text>
                      <Text style={{ fontSize: 10, color: Colors.mutedForeground }} numberOfLines={1}>{item.email}</Text>
                    </View>
                  </Pressable>
                )}
              />
            </View>

            <Pressable onPress={handleSend} disabled={sending || (selectionMode === "include" && selectedMembers.length === 0)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, opacity: pressed || sending || (selectionMode === "include" && selectedMembers.length === 0) ? 0.7 : 1, marginBottom: 8 })}>
              {sending ? <ActivityIndicator size="small" color="white" /> : <><Send size={14} color="white" /><Text style={{ color: "white", fontWeight: "600" }}>Send ({getRecipientCount()} recipients)</Text></>}
            </Pressable>
            <Pressable onPress={() => { setShowSendModal(false); setSendingEmail(null); }} style={{ alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ color: Colors.mutedForeground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Canned Send Modal ────────────────────────────────────────────── */}
      <Modal visible={showCannedSendModal} transparent animationType="slide" onRequestClose={() => setShowCannedSendModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "80%" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>Send to Committed Members</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 12 }}>{cannedEmail?.subject} · {committedMembers.length} committed members</Text>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <Pressable onPress={() => { setCannedSendMode("all"); setSelectedCommittedMembers([]); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: cannedSendMode === "all" ? Colors.primary : Colors.border, backgroundColor: cannedSendMode === "all" ? Colors.primary + "1A" : "white" }}>
                <Text style={{ fontSize: 11, color: cannedSendMode === "all" ? Colors.primary : Colors.mutedForeground }}>All committed ({committedMembers.length})</Text>
              </Pressable>
              <Pressable onPress={() => setCannedSendMode("select")} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: cannedSendMode === "select" ? Colors.primary : Colors.border, backgroundColor: cannedSendMode === "select" ? Colors.primary + "1A" : "white" }}>
                <Text style={{ fontSize: 11, color: cannedSendMode === "select" ? Colors.primary : Colors.mutedForeground }}>Specific members</Text>
              </Pressable>
            </View>

            {cannedSendMode === "select" && (
              <>
                <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, fontSize: 12, color: Colors.foreground, marginBottom: 8 }} placeholder="Search..." placeholderTextColor={Colors.mutedForeground} value={committedSearch} onChangeText={setCommittedSearch} />
                <View style={{ maxHeight: 200, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, marginBottom: 12 }}>
                  <FlatList
                    data={filteredCommittedMembers}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <Pressable onPress={() => toggleCommittedMember(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "33", backgroundColor: selectedCommittedMembers.includes(item.id) ? Colors.primary + "0D" : "transparent" }}>
                        <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: selectedCommittedMembers.includes(item.id) ? Colors.primary : Colors.border, backgroundColor: selectedCommittedMembers.includes(item.id) ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                          {selectedCommittedMembers.includes(item.id) && <Check size={12} color="white" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: "500" }} numberOfLines={1}>{item.full_name}</Text>
                          <Text style={{ fontSize: 10, color: Colors.mutedForeground }} numberOfLines={1}>{item.email}</Text>
                        </View>
                      </Pressable>
                    )}
                    ListEmptyComponent={<Text style={{ textAlign: "center", color: Colors.mutedForeground, paddingVertical: 16, fontSize: 12 }}>No committed members found</Text>}
                  />
                </View>
              </>
            )}

            <Pressable onPress={handleSendCanned} disabled={sendingCanned || (cannedSendMode === "select" && selectedCommittedMembers.length === 0)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, opacity: pressed || sendingCanned || (cannedSendMode === "select" && selectedCommittedMembers.length === 0) ? 0.7 : 1, marginBottom: 8 })}>
              {sendingCanned ? <ActivityIndicator size="small" color="white" /> : <><Send size={14} color="white" /><Text style={{ color: "white", fontWeight: "600" }}>Send ({cannedSendMode === "all" ? committedMembers.length : selectedCommittedMembers.length})</Text></>}
            </Pressable>
            <Pressable onPress={() => setShowCannedSendModal(false)} style={{ alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ color: Colors.mutedForeground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

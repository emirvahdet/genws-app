import { useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Alert, Modal, Switch } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Bell, Send, Users, Calendar, CheckCircle, Plus, Edit, Trash2, Zap, Clock, Newspaper, AlertCircle } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { supabase } from "../../lib/supabase";
import { format } from "date-fns";
import { Picker } from "@react-native-picker/picker";

// ============================================================================
// TYPES
// ============================================================================
interface Group {
  id: string;
  name: string;
}

interface Event {
  id: string;
  title: string;
  start_date: string;
}

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  target_type: string;
  target_id: string | null;
  recipient_count: number;
  created_at: string;
}

interface NotificationRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: "event_created" | "event_full" | "time_before_event" | "news_created" | "custom";
  timing_type: "immediate" | "scheduled";
  hours_before: number | null;
  send_at_hour: number | null;
  send_at_minute: number | null;
  target_type: "all" | "registered" | "not_registered" | "admin";
  title_template: string;
  body_template: string;
  created_at: string;
  updated_at: string;
}

interface NotificationRuleLog {
  id: string;
  rule_id: string;
  trigger_entity_type: string;
  trigger_entity_id: string;
  title: string;
  body: string;
  target_type: string;
  recipient_count: number;
  status: string;
  error_message: string | null;
  sent_at: string;
}

const TRIGGER_TYPES = [
  { value: "event_created", label: "New Event Created", icon: Calendar },
  { value: "event_full", label: "Event Full", icon: AlertCircle },
  { value: "time_before_event", label: "Time Before Event", icon: Clock },
  { value: "news_created", label: "News Created", icon: Newspaper },
] as const;

const TARGET_TYPES = [
  { value: "all", label: "All Members" },
  { value: "registered", label: "Event Registrants" },
  { value: "not_registered", label: "Non-Registrants" },
  { value: "admin", label: "Admins Only" },
] as const;

const TEMPLATE_VARIABLES = [
  { key: "{event_title}", label: "Event Title", forTriggers: ["event_created", "event_full", "time_before_event"] },
  { key: "{event_date}", label: "Event Date", forTriggers: ["event_created", "event_full", "time_before_event"] },
  { key: "{event_location}", label: "Event Location", forTriggers: ["event_created", "event_full", "time_before_event"] },
  { key: "{event_excerpt}", label: "Event Excerpt", forTriggers: ["event_created", "event_full", "time_before_event"] },
  { key: "{news_title}", label: "News Title", forTriggers: ["news_created"] },
];

const HOURS_OPTIONS = [1, 2, 3, 6, 12, 24, 48, 72];

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function NotificationsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"manual" | "automated">("manual");
  
  // Manual tab state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"all" | "group" | "event">("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Automated tab state
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [ruleLogs, setRuleLogs] = useState<NotificationRuleLog[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [activeTemplateField, setActiveTemplateField] = useState<"title" | "body">("title");
  
  // Rule form state
  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    is_active: true,
    trigger_type: "event_created" as NotificationRule["trigger_type"],
    timing_type: "immediate" as NotificationRule["timing_type"],
    hours_before: 24,
    send_at_hour: 10,
    send_at_minute: 0,
    target_type: "all" as NotificationRule["target_type"],
    title_template: "",
    body_template: "",
  });

  useEffect(() => {
    fetchData();
  }, []);
  
  useEffect(() => {
    if (activeTab === "automated") {
      fetchRules();
    }
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, eventsRes, logsRes] = await Promise.all([
        supabase.from("admin_groups").select("id, name").order("name"),
        supabase.from("events").select("id, title, start_date").gte("start_date", new Date().toISOString()).order("start_date").limit(20),
        supabase.from("notifications_log").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      if (groupsRes.data) setGroups(groupsRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
      if (logsRes.data) setNotificationLogs(logsRes.data);
    } catch (error) {
      __DEV__ && console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const [rulesRes, logsRes] = await Promise.all([
        supabase.from("notification_rules").select("*").order("created_at", { ascending: false }),
        supabase.from("notification_rule_logs").select("*").order("sent_at", { ascending: false }).limit(50),
      ]);
      if (rulesRes.data) setRules(rulesRes.data);
      if (logsRes.data) setRuleLogs(logsRes.data);
    } catch (error) {
      __DEV__ && console.log("Error fetching rules:", error);
    } finally {
      setRulesLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Error", "Please enter both title and message");
      return;
    }
    if (targetType === "group" && !selectedGroupId) {
      Alert.alert("Error", "Please select a group");
      return;
    }
    if (targetType === "event" && !selectedEventId) {
      Alert.alert("Error", "Please select an event");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          title: title.trim(),
          body: body.trim(),
          target_type: targetType,
          target_id: targetType === "group" ? selectedGroupId : targetType === "event" ? selectedEventId : null,
        },
      });
      if (error) throw error;
      Alert.alert("Success", `Notification sent to ${data.recipient_count} recipients`);
      setTitle("");
      setBody("");
      setTargetType("all");
      setSelectedGroupId("");
      setSelectedEventId("");
      fetchData();
    } catch (error: any) {
      __DEV__ && console.log("Error sending notification:", error);
      Alert.alert("Error", error.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  const getTargetLabel = (log: NotificationLog) => {
    if (log.target_type === "all") return "All Members";
    if (log.target_type === "group") {
      const group = groups.find((g) => g.id === log.target_id);
      return group ? `Group: ${group.name}` : "Group";
    }
    if (log.target_type === "event") {
      const event = events.find((e) => e.id === log.target_id);
      return event ? `Event: ${event.title}` : "Event";
    }
    return log.target_type;
  };

  // ============================================================================
  // RULE MANAGEMENT FUNCTIONS
  // ============================================================================
  const resetRuleForm = () => {
    setRuleForm({
      name: "",
      description: "",
      is_active: true,
      trigger_type: "event_created",
      timing_type: "immediate",
      hours_before: 24,
      send_at_hour: 10,
      send_at_minute: 0,
      target_type: "all",
      title_template: "",
      body_template: "",
    });
  };

  const openCreateRule = () => {
    setEditingRule(null);
    resetRuleForm();
    setShowRuleModal(true);
  };

  const openEditRule = (rule: NotificationRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      description: rule.description || "",
      is_active: rule.is_active,
      trigger_type: rule.trigger_type,
      timing_type: rule.timing_type,
      hours_before: rule.hours_before || 24,
      send_at_hour: rule.send_at_hour ?? 10,
      send_at_minute: rule.send_at_minute ?? 0,
      target_type: rule.target_type,
      title_template: rule.title_template,
      body_template: rule.body_template,
    });
    setShowRuleModal(true);
  };

  const handleSaveRule = async () => {
    if (!ruleForm.name.trim() || !ruleForm.title_template.trim() || !ruleForm.body_template.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    setSavingRule(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ruleData = {
        name: ruleForm.name.trim(),
        description: ruleForm.description.trim() || null,
        is_active: ruleForm.is_active,
        trigger_type: ruleForm.trigger_type,
        timing_type: ruleForm.timing_type,
        hours_before: ruleForm.trigger_type === "time_before_event" ? ruleForm.hours_before : null,
        send_at_hour: ruleForm.timing_type === "scheduled" || ruleForm.trigger_type === "time_before_event" ? ruleForm.send_at_hour : null,
        send_at_minute: ruleForm.timing_type === "scheduled" || ruleForm.trigger_type === "time_before_event" ? ruleForm.send_at_minute : null,
        target_type: ruleForm.target_type,
        title_template: ruleForm.title_template.trim(),
        body_template: ruleForm.body_template.trim(),
        created_by: editingRule ? undefined : user?.id,
      };

      if (editingRule) {
        const { error } = await supabase.from("notification_rules").update(ruleData).eq("id", editingRule.id);
        if (error) throw error;
        Alert.alert("Success", "Rule updated successfully");
      } else {
        const { error } = await supabase.from("notification_rules").insert([ruleData]);
        if (error) throw error;
        Alert.alert("Success", "Rule created successfully");
      }

      setShowRuleModal(false);
      fetchRules();
    } catch (error: any) {
      __DEV__ && console.log("Error saving rule:", error);
      Alert.alert("Error", error.message || "Failed to save rule");
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = (rule: NotificationRule) => {
    Alert.alert("Delete Rule", `Are you sure you want to delete "${rule.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("notification_rules").delete().eq("id", rule.id);
            if (error) throw error;
            Alert.alert("Success", "Rule deleted");
            fetchRules();
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to delete rule");
          }
        },
      },
    ]);
  };

  const handleToggleRule = async (rule: NotificationRule) => {
    try {
      const { error } = await supabase.from("notification_rules").update({ is_active: !rule.is_active }).eq("id", rule.id);
      if (error) throw error;
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r)));
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to toggle rule");
    }
  };

  const insertVariable = (variable: string) => {
    if (activeTemplateField === "title") {
      setRuleForm((prev) => ({ ...prev, title_template: prev.title_template + variable }));
    } else {
      setRuleForm((prev) => ({ ...prev, body_template: prev.body_template + variable }));
    }
  };

  const getTriggerLabel = (type: string) => TRIGGER_TYPES.find((t) => t.value === type)?.label || type;
  const getTargetTypeLabel = (type: string) => TARGET_TYPES.find((t) => t.value === type)?.label || type;
  const formatHour = (hour: number) => {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h}:00 ${ampm}`;
  };

  const availableVariables = TEMPLATE_VARIABLES.filter((v) => v.forTriggers.includes(ruleForm.trigger_type));

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ============================================================================
  // RENDER: MANUAL TAB
  // ============================================================================
  const renderManualTab = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Bell size={20} color={Colors.primary} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground }}>Send New Notification</Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Title *</Text>
          <TextInput
            style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 9, fontSize: 13, color: Colors.foreground }}
            value={title}
            onChangeText={setTitle}
            placeholder="Notification title"
            placeholderTextColor={Colors.mutedForeground}
          />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Message *</Text>
          <TextInput
            style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 9, fontSize: 13, color: Colors.foreground, minHeight: 80, textAlignVertical: "top" }}
            value={body}
            onChangeText={setBody}
            placeholder="Notification message"
            placeholderTextColor={Colors.mutedForeground}
            multiline
          />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Target Audience *</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["all", "group", "event"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTargetType(t)}
                style={{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                  borderWidth: 1, borderColor: targetType === t ? Colors.primary : Colors.border,
                  backgroundColor: targetType === t ? Colors.primary : "white", borderRadius: 8, paddingVertical: 10,
                }}
              >
                {t === "event" ? <Calendar size={14} color={targetType === t ? "white" : Colors.foreground} /> : <Users size={14} color={targetType === t ? "white" : Colors.foreground} />}
                <Text style={{ fontSize: 12, fontWeight: targetType === t ? "600" : "400", color: targetType === t ? "white" : Colors.foreground }}>
                  {t === "all" ? "All Members" : t === "group" ? "Group" : "Event"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {targetType === "group" && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Select Group *</Text>
            <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.input }}>
              {groups.map((group) => (
                <Pressable key={group.id} onPress={() => setSelectedGroupId(group.id)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border + "33" }}>
                  <Text style={{ fontSize: 13, color: Colors.foreground }}>{group.name}</Text>
                  {selectedGroupId === group.id && <CheckCircle size={16} color={Colors.primary} />}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {targetType === "event" && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Select Event *</Text>
            <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.input, maxHeight: 200 }}>
              <ScrollView nestedScrollEnabled>
                {events.map((event) => (
                  <Pressable key={event.id} onPress={() => setSelectedEventId(event.id)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border + "33" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: Colors.foreground, marginBottom: 2 }}>{event.title}</Text>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{format(new Date(event.start_date), "MMM d, yyyy")}</Text>
                    </View>
                    {selectedEventId === event.id && <CheckCircle size={16} color={Colors.primary} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        <View style={{ backgroundColor: Colors.muted, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>PREVIEW</Text>
          <View style={{ backgroundColor: "white", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>{title || "Notification Title"}</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{body || "Notification message will appear here..."}</Text>
          </View>
        </View>

        <Pressable
          onPress={handleSendNotification}
          disabled={sending || !title.trim() || !body.trim()}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, opacity: pressed || sending || !title.trim() || !body.trim() ? 0.6 : 1 })}
        >
          {sending ? <ActivityIndicator size="small" color="white" /> : <><Send size={16} color="white" /><Text style={{ color: "white", fontSize: 14, fontWeight: "600" }}>Send Notification</Text></>}
        </Pressable>
      </View>

      <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 12 }}>Send History</Text>
        {notificationLogs.length === 0 ? (
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", paddingVertical: 20 }}>No notifications sent yet</Text>
        ) : (
          notificationLogs.map((log) => (
            <View key={log.id} style={{ borderBottomWidth: 1, borderBottomColor: Colors.border + "33", paddingVertical: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground, flex: 1 }}>{log.title}</Text>
                <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{format(new Date(log.created_at), "MMM d, h:mm a")}</Text>
              </View>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 6 }}>{log.body}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Users size={12} color={Colors.mutedForeground} />
                  <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{log.recipient_count} recipients</Text>
                </View>
                <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>•</Text>
                <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{getTargetLabel(log)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  // ============================================================================
  // RENDER: AUTOMATED TAB
  // ============================================================================
  const renderAutomatedTab = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Zap size={20} color={Colors.primary} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground }}>Automation Rules</Text>
        </View>
        <Pressable onPress={openCreateRule} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}>
          <Plus size={16} color="white" />
          <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>Create Rule</Text>
        </Pressable>
      </View>

      {rulesLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : rules.length === 0 ? (
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
          <Zap size={40} color={Colors.mutedForeground} style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>No Automation Rules</Text>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center" }}>Create rules to automatically send notifications when events are created, become full, or at scheduled times.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {rules.map((rule) => {
            const TriggerIcon = TRIGGER_TYPES.find((t) => t.value === rule.trigger_type)?.icon || Bell;
            const ruleLogCount = ruleLogs.filter((l) => l.rule_id === rule.id).length;
            return (
              <View key={rule.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: rule.is_active ? Colors.primary + "1A" : Colors.muted, alignItems: "center", justifyContent: "center" }}>
                      <TriggerIcon size={18} color={rule.is_active ? Colors.primary : Colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>{rule.name}</Text>
                      <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{getTriggerLabel(rule.trigger_type)}</Text>
                    </View>
                  </View>
                  <Switch value={rule.is_active} onValueChange={() => handleToggleRule(rule)} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="white" />
                </View>

                {rule.description && <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 8 }}>{rule.description}</Text>}

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  <View style={{ backgroundColor: Colors.muted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>Target: {getTargetTypeLabel(rule.target_type)}</Text>
                  </View>
                  {rule.trigger_type === "time_before_event" && rule.hours_before && (
                    <View style={{ backgroundColor: Colors.muted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{rule.hours_before}h before</Text>
                    </View>
                  )}
                  {rule.send_at_hour !== null && (
                    <View style={{ backgroundColor: Colors.muted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>At {formatHour(rule.send_at_hour)}</Text>
                    </View>
                  )}
                  <View style={{ backgroundColor: Colors.muted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{ruleLogCount} sent</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => openEditRule(rule)} style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                    <Edit size={14} color={Colors.foreground} />
                    <Text style={{ fontSize: 13, color: Colors.foreground }}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteRule(rule)} style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#ef4444", borderRadius: 8, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                    <Trash2 size={14} color="#ef4444" />
                    <Text style={{ fontSize: 13, color: "#ef4444" }}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {ruleLogs.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 12 }}>Recent Automated Sends</Text>
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
            {ruleLogs.slice(0, 10).map((log) => (
              <View key={log.id} style={{ borderBottomWidth: 1, borderBottomColor: Colors.border + "33", paddingVertical: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.foreground, flex: 1 }}>{log.title}</Text>
                  <View style={{ backgroundColor: log.status === "sent" ? "#22c55e20" : "#ef444420", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, color: log.status === "sent" ? "#22c55e" : "#ef4444", fontWeight: "600" }}>{log.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{log.recipient_count} recipients • {format(new Date(log.sent_at), "MMM d, h:mm a")}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );

  // ============================================================================
  // RENDER: RULE MODAL
  // ============================================================================
  const renderRuleModal = () => (
    <Modal visible={showRuleModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRuleModal(false)}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={{ backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable onPress={() => setShowRuleModal(false)} style={{ padding: 4 }}>
              <Text style={{ fontSize: 16, color: Colors.mutedForeground }}>Cancel</Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: "600", color: Colors.foreground }}>{editingRule ? "Edit Rule" : "Create Rule"}</Text>
            <Pressable onPress={handleSaveRule} disabled={savingRule} style={{ padding: 4 }}>
              {savingRule ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.primary }}>Save</Text>}
            </Pressable>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Rule Name */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Rule Name *</Text>
            <TextInput
              style={{ backgroundColor: "white", borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.foreground }}
              value={ruleForm.name}
              onChangeText={(t) => setRuleForm((p) => ({ ...p, name: t }))}
              placeholder="e.g., New Event Announcement"
              placeholderTextColor={Colors.mutedForeground}
            />
          </View>

          {/* Description */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Description</Text>
            <TextInput
              style={{ backgroundColor: "white", borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.foreground }}
              value={ruleForm.description}
              onChangeText={(t) => setRuleForm((p) => ({ ...p, description: t }))}
              placeholder="Optional description"
              placeholderTextColor={Colors.mutedForeground}
            />
          </View>

          {/* Trigger Type */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 8 }}>Trigger Type *</Text>
            <View style={{ gap: 8 }}>
              {TRIGGER_TYPES.map((trigger) => {
                const Icon = trigger.icon;
                const isSelected = ruleForm.trigger_type === trigger.value;
                return (
                  <Pressable
                    key={trigger.value}
                    onPress={() => setRuleForm((p) => ({ ...p, trigger_type: trigger.value as any }))}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderWidth: 1, borderColor: isSelected ? Colors.primary : Colors.border, borderRadius: 10, padding: 12 }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isSelected ? Colors.primary + "1A" : Colors.muted, alignItems: "center", justifyContent: "center" }}>
                      <Icon size={16} color={isSelected ? Colors.primary : Colors.mutedForeground} />
                    </View>
                    <Text style={{ fontSize: 14, color: Colors.foreground, fontWeight: isSelected ? "600" : "400" }}>{trigger.label}</Text>
                    {isSelected && <CheckCircle size={18} color={Colors.primary} style={{ marginLeft: "auto" }} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Time Before Event Options */}
          {ruleForm.trigger_type === "time_before_event" && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 8 }}>Hours Before Event *</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {HOURS_OPTIONS.map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => setRuleForm((p) => ({ ...p, hours_before: h }))}
                    style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: ruleForm.hours_before === h ? Colors.primary : Colors.border, backgroundColor: ruleForm.hours_before === h ? Colors.primary : "white" }}
                  >
                    <Text style={{ fontSize: 13, color: ruleForm.hours_before === h ? "white" : Colors.foreground, fontWeight: ruleForm.hours_before === h ? "600" : "400" }}>{h}h</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginTop: 16, marginBottom: 8 }}>Send At Time</Text>
              <Pressable onPress={() => setShowHourPicker(true)} style={{ backgroundColor: "white", borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, color: Colors.foreground }}>{formatHour(ruleForm.send_at_hour)}</Text>
                <Clock size={18} color={Colors.mutedForeground} />
              </Pressable>
            </View>
          )}

          {/* Target Audience */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 8 }}>Target Audience *</Text>
            <View style={{ gap: 8 }}>
              {TARGET_TYPES.map((target) => {
                const isSelected = ruleForm.target_type === target.value;
                const isDisabled = (target.value === "registered" || target.value === "not_registered") && ruleForm.trigger_type === "news_created";
                return (
                  <Pressable
                    key={target.value}
                    onPress={() => !isDisabled && setRuleForm((p) => ({ ...p, target_type: target.value as any }))}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderWidth: 1, borderColor: isSelected ? Colors.primary : Colors.border, borderRadius: 10, padding: 12, opacity: isDisabled ? 0.5 : 1 }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: isSelected ? Colors.primary : Colors.border, alignItems: "center", justifyContent: "center" }}>
                      {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }} />}
                    </View>
                    <Text style={{ fontSize: 14, color: Colors.foreground }}>{target.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Message Template */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 8 }}>Message Template *</Text>
            
            <Text style={{ fontSize: 11, fontWeight: "500", color: Colors.mutedForeground, marginBottom: 4 }}>Title</Text>
            <TextInput
              style={{ backgroundColor: "white", borderWidth: 1, borderColor: activeTemplateField === "title" ? Colors.primary : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.foreground, marginBottom: 8 }}
              value={ruleForm.title_template}
              onChangeText={(t) => setRuleForm((p) => ({ ...p, title_template: t }))}
              onFocus={() => setActiveTemplateField("title")}
              placeholder="e.g., New Event: {event_title}"
              placeholderTextColor={Colors.mutedForeground}
            />

            <Text style={{ fontSize: 11, fontWeight: "500", color: Colors.mutedForeground, marginBottom: 4 }}>Body</Text>
            <TextInput
              style={{ backgroundColor: "white", borderWidth: 1, borderColor: activeTemplateField === "body" ? Colors.primary : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.foreground, minHeight: 80, textAlignVertical: "top", marginBottom: 8 }}
              value={ruleForm.body_template}
              onChangeText={(t) => setRuleForm((p) => ({ ...p, body_template: t }))}
              onFocus={() => setActiveTemplateField("body")}
              placeholder="e.g., Join us at {event_location} on {event_date}"
              placeholderTextColor={Colors.mutedForeground}
              multiline
            />

            <Text style={{ fontSize: 11, fontWeight: "500", color: Colors.mutedForeground, marginBottom: 6 }}>Insert Variable (into {activeTemplateField})</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {availableVariables.map((v) => (
                <Pressable key={v.key} onPress={() => insertVariable(v.key)} style={({ pressed }) => ({ backgroundColor: Colors.primary + "1A", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "500" }}>{v.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Active Toggle */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "white", borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, marginBottom: 24 }}>
            <Text style={{ fontSize: 14, color: Colors.foreground }}>Rule Active</Text>
            <Switch value={ruleForm.is_active} onValueChange={(v) => setRuleForm((p) => ({ ...p, is_active: v }))} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="white" />
          </View>
        </ScrollView>
      </View>

      {/* Hour Picker Modal */}
      <Modal visible={showHourPicker} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <Pressable onPress={() => setShowHourPicker(false)}><Text style={{ fontSize: 16, color: Colors.mutedForeground }}>Cancel</Text></Pressable>
              <Pressable onPress={() => setShowHourPicker(false)}><Text style={{ fontSize: 16, fontWeight: "600", color: Colors.primary }}>Done</Text></Pressable>
            </View>
            <Picker selectedValue={ruleForm.send_at_hour} onValueChange={(v) => setRuleForm((p) => ({ ...p, send_at_hour: v }))}>
              {Array.from({ length: 24 }, (_, i) => (
                <Picker.Item key={i} label={formatHour(i)} value={i} />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </Modal>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, paddingTop: 60, paddingBottom: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
            <ArrowLeft size={24} color={Colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Push Notifications</Text>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 0 }}>
          <Pressable onPress={() => setActiveTab("manual")} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === "manual" ? Colors.primary : "transparent" }}>
            <Text style={{ fontSize: 14, fontWeight: activeTab === "manual" ? "600" : "400", color: activeTab === "manual" ? Colors.primary : Colors.mutedForeground }}>Manual</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("automated")} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === "automated" ? Colors.primary : "transparent" }}>
            <Text style={{ fontSize: 14, fontWeight: activeTab === "automated" ? "600" : "400", color: activeTab === "automated" ? Colors.primary : Colors.mutedForeground }}>Automated</Text>
          </Pressable>
        </View>
      </View>

      {/* Tab Content */}
      {activeTab === "manual" ? renderManualTab() : renderAutomatedTab()}

      {/* Rule Modal */}
      {renderRuleModal()}
    </View>
  );
}

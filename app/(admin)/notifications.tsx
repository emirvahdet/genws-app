import { useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Bell, Send, Users, Calendar, CheckCircle } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { supabase } from "../../lib/supabase";
import { format } from "date-fns";

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

export default function NotificationsScreen() {
  const router = useRouter();
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch groups
      const { data: groupsData } = await supabase
        .from("admin_groups")
        .select("id, name")
        .order("name");
      if (groupsData) setGroups(groupsData);

      // Fetch upcoming events
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, title, start_date")
        .gte("start_date", new Date().toISOString())
        .order("start_date")
        .limit(20);
      if (eventsData) setEvents(eventsData);

      // Fetch notification logs
      const { data: logsData } = await supabase
        .from("notifications_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (logsData) setNotificationLogs(logsData);
    } catch (error) {
      __DEV__ && console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
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
      
      // Reset form
      setTitle("");
      setBody("");
      setTargetType("all");
      setSelectedGroupId("");
      setSelectedEventId("");
      
      // Refresh logs
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{ backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
            <ArrowLeft size={24} color={Colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Push Notifications</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Send Notification Form */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Bell size={20} color={Colors.primary} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground }}>Send New Notification</Text>
          </View>

          {/* Title Input */}
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

          {/* Body Input */}
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

          {/* Target Audience Selector */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Target Audience *</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setTargetType("all")}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: targetType === "all" ? Colors.primary : Colors.border,
                  backgroundColor: targetType === "all" ? Colors.primary : "white",
                  borderRadius: 8,
                  paddingVertical: 10,
                }}
              >
                <Users size={14} color={targetType === "all" ? "white" : Colors.foreground} />
                <Text style={{ fontSize: 12, fontWeight: targetType === "all" ? "600" : "400", color: targetType === "all" ? "white" : Colors.foreground }}>All Members</Text>
              </Pressable>
              <Pressable
                onPress={() => setTargetType("group")}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: targetType === "group" ? Colors.primary : Colors.border,
                  backgroundColor: targetType === "group" ? Colors.primary : "white",
                  borderRadius: 8,
                  paddingVertical: 10,
                }}
              >
                <Users size={14} color={targetType === "group" ? "white" : Colors.foreground} />
                <Text style={{ fontSize: 12, fontWeight: targetType === "group" ? "600" : "400", color: targetType === "group" ? "white" : Colors.foreground }}>Group</Text>
              </Pressable>
              <Pressable
                onPress={() => setTargetType("event")}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: targetType === "event" ? Colors.primary : Colors.border,
                  backgroundColor: targetType === "event" ? Colors.primary : "white",
                  borderRadius: 8,
                  paddingVertical: 10,
                }}
              >
                <Calendar size={14} color={targetType === "event" ? "white" : Colors.foreground} />
                <Text style={{ fontSize: 12, fontWeight: targetType === "event" ? "600" : "400", color: targetType === "event" ? "white" : Colors.foreground }}>Event</Text>
              </Pressable>
            </View>
          </View>

          {/* Group Picker */}
          {targetType === "group" && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Select Group *</Text>
              <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.input }}>
                {groups.map((group) => (
                  <Pressable
                    key={group.id}
                    onPress={() => setSelectedGroupId(group.id)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border + "33" }}
                  >
                    <Text style={{ fontSize: 13, color: Colors.foreground }}>{group.name}</Text>
                    {selectedGroupId === group.id && <CheckCircle size={16} color={Colors.primary} />}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Event Picker */}
          {targetType === "event" && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Select Event *</Text>
              <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.input, maxHeight: 200 }}>
                <ScrollView>
                  {events.map((event) => (
                    <Pressable
                      key={event.id}
                      onPress={() => setSelectedEventId(event.id)}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border + "33" }}
                    >
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

          {/* Preview */}
          <View style={{ backgroundColor: Colors.muted, borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 10, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>PREVIEW</Text>
            <View style={{ backgroundColor: "white", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>{title || "Notification Title"}</Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{body || "Notification message will appear here..."}</Text>
            </View>
          </View>

          {/* Send Button */}
          <Pressable
            onPress={handleSendNotification}
            disabled={sending || !title.trim() || !body.trim()}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, opacity: pressed || sending || !title.trim() || !body.trim() ? 0.6 : 1 })}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Send size={16} color="white" />
                <Text style={{ color: "white", fontSize: 14, fontWeight: "600" }}>Send Notification</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Notification History */}
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
    </View>
  );
}

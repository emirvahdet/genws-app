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
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Copy,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { EventAttendees } from "../../components/admin/EventAttendees";
import { RichTextEditor } from "../../components/admin/RichTextEditor";
import { DateTimePickerComponent } from "../../components/admin/DateTimePicker";
import { DatePicker } from "../../components/ui/DatePicker";
import { CountryPicker } from "../../components/ui/CountryPicker";

// EditField component - moved outside to prevent re-renders
const EF = ({ label, value, onChangeText, placeholder, multiline, keyboardType, hint }: any) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>{label}</Text>
    <TextInput
      style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 9, fontSize: 13, color: Colors.foreground, ...(multiline ? { minHeight: 70, textAlignVertical: "top" as const } : {}) }}
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.mutedForeground}
      multiline={multiline} keyboardType={keyboardType}
    />
    {hint && <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>{hint}</Text>}
  </View>
);

const EVENT_STATUS_OPTIONS = [
  "Open to Registration",
  "Pre-Registration",
  "+1 Event",
  "Cost Bearing Event",
  "Invitation Only",
  "Member Hosted Event",
  "Registration Closed",
  "Fully Booked",
  "Waitlist",
  "Test Event",
];

interface Event {
  id: string;
  title: string;
  excerpt?: string;
  description: string;
  location: string;
  city: string;
  country: string;
  coordinates?: string;
  start_date: string;
  end_date?: string;
  image_url?: string;
  status: string[];
  capacity?: number;
  host: string;
  dress_code?: string;
  is_paid?: boolean;
  price?: number;
  currency?: string;
  is_restricted?: boolean;
  rsvp_date?: string;
  open_for_networking?: boolean;
  price_charged_via_app?: boolean;
}

const initialForm = {
  title: "",
  excerpt: "",
  description: "",
  location: "",
  city: "",
  country: "",
  coordinates: "",
  start_date: "",
  end_date: "",
  image_url: "",
  status: ["Open to Registration"] as string[],
  capacity: undefined as number | undefined,
  host: "Karman Beyond",
  dress_code: "",
  is_paid: false,
  price: undefined as number | undefined,
  currency: "TRY",
  is_restricted: false,
  rsvp_date: "",
  open_for_networking: true,
  price_charged_via_app: false,
};

export default function AdminEventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({ ...initialForm });
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  useEffect(() => {
    fetchEvents();
    fetchGroups();
    fetchMembers();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch (e) {
      __DEV__ && console.log("Error fetching events:", e);
      Alert.alert("Error", "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data } = await supabase.from("admin_groups").select("*").order("name");
      setGroups(data || []);
    } catch (e) {
      __DEV__ && console.log("Error fetching groups:", e);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      setMembers(data || []);
    } catch (e) {
      __DEV__ && console.log("Error fetching members:", e);
    }
  };

  const resetForm = () => {
    setFormData({ ...initialForm });
    setSelectedGroups(new Set());
    setSelectedMembers(new Set());
    setMemberSearchQuery("");
    setEditingEvent(null);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) { Alert.alert("Validation Error", "Title is required"); return; }
    if (!formData.location.trim()) { Alert.alert("Validation Error", "Location is required"); return; }
    if (!formData.start_date.trim()) { Alert.alert("Validation Error", "Start date is required"); return; }
    if (!formData.host.trim()) { Alert.alert("Validation Error", "Host is required"); return; }
    if (formData.status.length === 0) { Alert.alert("Validation Error", "At least one status is required"); return; }

    if (formData.status.includes("Cost Bearing Event") && formData.price_charged_via_app) {
      if (!formData.price || formData.price <= 0) { Alert.alert("Validation Error", "Price is required when charging via app"); return; }
    }

    try {
      const sanitizedData = {
        ...formData,
        end_date: formData.end_date || null,
        rsvp_date: formData.rsvp_date || null,
        capacity: formData.capacity || null,
        price: formData.price || null,
        image_url: formData.image_url || null,
        coordinates: formData.coordinates || null,
        excerpt: formData.excerpt || null,
        dress_code: formData.dress_code || null,
      };

      if (editingEvent) {
        const { error } = await supabase.from("events").update(sanitizedData).eq("id", editingEvent.id);
        if (error) throw error;
        await saveRestrictions(editingEvent.id);
        Alert.alert("Success", "Event updated successfully");
      } else {
        const { data: newEvent, error } = await supabase.from("events").insert([sanitizedData]).select().single();
        if (error) throw error;
        await saveRestrictions(newEvent.id);
        Alert.alert("Success", "Event created successfully");
      }
      setShowModal(false);
      resetForm();
      fetchEvents();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save event");
    }
  };

  const saveRestrictions = async (eventId: string) => {
    if (!formData.is_restricted) return;
    try {
      await supabase.from("event_group_restrictions").delete().eq("event_id", eventId);
      await supabase.from("event_member_restrictions").delete().eq("event_id", eventId);
      if (selectedGroups.size > 0) {
        await supabase.from("event_group_restrictions").insert(
          Array.from(selectedGroups).map((gid) => ({ event_id: eventId, group_id: gid }))
        );
      }
      if (selectedMembers.size > 0) {
        await supabase.from("event_member_restrictions").insert(
          Array.from(selectedMembers).map((uid) => ({ event_id: eventId, user_id: uid }))
        );
      }
    } catch (e) {
      __DEV__ && console.log("Error saving restrictions:", e);
      throw e;
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("events").delete().eq("id", id);
            if (error) throw error;
            Alert.alert("Success", "Event deleted");
            fetchEvents();
          } catch { Alert.alert("Error", "Failed to delete event"); }
        },
      },
    ]);
  };

  const handleDuplicate = async (event: Event) => {
    try {
      const { id, ...eventData } = event;
      const { error } = await supabase.from("events").insert({ ...eventData, title: `Copy of ${event.title}` });
      if (error) throw error;
      Alert.alert("Success", "Event duplicated");
      fetchEvents();
    } catch { Alert.alert("Error", "Failed to duplicate event"); }
  };

  const openEditModal = async (event: Event) => {
    setEditingEvent(event);
    const fmtDate = (d: string) => {
      if (!d) return "";
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
    };
    setFormData({
      title: event.title,
      excerpt: event.excerpt || "",
      description: event.description || "",
      location: event.location,
      city: event.city || "",
      country: event.country || "",
      coordinates: event.coordinates || "",
      start_date: fmtDate(event.start_date),
      end_date: event.end_date ? fmtDate(event.end_date) : "",
      image_url: event.image_url || "",
      status: event.status || ["Open to Registration"],
      capacity: event.capacity ?? undefined,
      host: event.host || "Karman Beyond",
      dress_code: event.dress_code || "",
      is_paid: event.is_paid || false,
      price: event.price || undefined,
      currency: event.currency || "TRY",
      is_restricted: event.is_restricted || false,
      rsvp_date: event.rsvp_date ? event.rsvp_date.split("T")[0] : "",
      open_for_networking: event.open_for_networking || false,
      price_charged_via_app: event.price_charged_via_app || false,
    });

    if (event.is_restricted) {
      try {
        const { data: gd } = await supabase.from("event_group_restrictions").select("group_id").eq("event_id", event.id);
        const { data: md } = await supabase.from("event_member_restrictions").select("user_id").eq("event_id", event.id);
        setSelectedGroups(new Set((gd || []).map((r: any) => r.group_id)));
        setSelectedMembers(new Set((md || []).map((r: any) => r.user_id)));
      } catch (e) {
        __DEV__ && console.log("Error loading restrictions:", e);
      }
    } else {
      setSelectedGroups(new Set());
      setSelectedMembers(new Set());
    }
    setShowModal(true);
  };

  const toggleStatus = (status: string) => {
    setFormData((prev) => ({
      ...prev,
      status: prev.status.includes(status) ? prev.status.filter((s) => s !== status) : [...prev.status, status],
    }));
  };

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const filteredFormMembers = members.filter(
    (m: any) =>
      m.full_name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearchQuery.toLowerCase())
  ).sort((a: any, b: any) => {
    const aS = selectedMembers.has(a.id);
    const bS = selectedMembers.has(b.id);
    if (aS && !bS) return -1;
    if (!aS && bS) return 1;
    return 0;
  });

return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable onPress={() => router.replace("/(tabs)/profile" as any)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Manage Events</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>Add, edit, or remove events</Text>
          </View>
        </View>

        {/* Add Button */}
        <Pressable
          onPress={() => { resetForm(); setShowModal(true); }}
          style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginBottom: 16,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Plus size={16} color="white" />
          <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>Add New Event</Text>
        </Pressable>

        {/* Event List */}
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: "center" }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : events.length === 0 ? (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 32, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <Calendar size={48} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>No events yet</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {events.map((event) => (
              <View key={event.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                  {event.image_url ? (
                    <Image source={{ uri: event.image_url }} style={{ width: 72, height: 72, borderRadius: 10 }} contentFit="cover" />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }} numberOfLines={1}>{event.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <Calendar size={12} color={Colors.mutedForeground} />
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{new Date(event.start_date).toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <MapPin size={12} color={Colors.mutedForeground} />
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }} numberOfLines={1}>{event.location}</Text>
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <EventAttendees eventId={event.id} eventTitle={event.title} />
                  <Pressable
                    onPress={() => openEditModal(event)}
                    style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                  >
                    <Edit size={16} color={Colors.foreground} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDuplicate(event)}
                    style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                  >
                    <Copy size={16} color={Colors.foreground} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(event.id)}
                    style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                  >
                    <Trash2 size={16} color="white" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Create/Edit Event Modal ─────────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "92%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 16 }}>
              {editingEvent ? "Edit Event" : "Create New Event"}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <EF label="Title *" value={formData.title} onChangeText={(t: string) => setFormData((p) => ({ ...p, title: t }))} />
              <EF label="Excerpt" value={formData.excerpt} onChangeText={(t: string) => setFormData((p) => ({ ...p, excerpt: t }))} multiline placeholder="Short preview text" />
              <RichTextEditor
                label="Full Description"
                value={formData.description}
                onChange={(html: string) => setFormData((p) => ({ ...p, description: html }))}
                placeholder="Enter detailed event description with formatting..."
              />
              <EF label="Location *" value={formData.location} onChangeText={(t: string) => setFormData((p) => ({ ...p, location: t }))} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><EF label="City" value={formData.city} onChangeText={(t: string) => setFormData((p) => ({ ...p, city: t }))} /></View>
                <View style={{ flex: 1 }}><CountryPicker label="Country" value={formData.country} onChange={(t: string) => setFormData((p) => ({ ...p, country: t }))} /></View>
              </View>
              <EF label="Coordinates" value={formData.coordinates} onChangeText={(t: string) => setFormData((p) => ({ ...p, coordinates: t }))} placeholder="41.066551, 29.018055" hint="Leave empty for approximate location" />
              <DateTimePickerComponent
                label="Start Date"
                value={formData.start_date}
                onChange={(value) => setFormData((p) => ({ ...p, start_date: value }))}
                placeholder="Select start date and time"
                required
              />
              <DateTimePickerComponent
                label="End Date (Optional)"
                value={formData.end_date}
                onChange={(value) => setFormData((p) => ({ ...p, end_date: value }))}
                placeholder="Select end date and time"
              />
              <EF label="Image URL" value={formData.image_url} onChangeText={(t: string) => setFormData((p) => ({ ...p, image_url: t }))} placeholder="https://..." keyboardType="url" />
              <EF label="Host *" value={formData.host} onChangeText={(t: string) => setFormData((p) => ({ ...p, host: t }))} />
              <EF label="Dress Code" value={formData.dress_code} onChangeText={(t: string) => setFormData((p) => ({ ...p, dress_code: t }))} placeholder="Smart Casual, Formal..." />

              {/* Status checkboxes */}
              <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Event Status * (Select multiple)</Text>
              <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                {EVENT_STATUS_OPTIONS.map((status) => (
                  <Pressable
                    key={status}
                    onPress={() => toggleStatus(status)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: formData.status.includes(status) ? Colors.primary : Colors.border, backgroundColor: formData.status.includes(status) ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                      {formData.status.includes(status) && <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 12, color: Colors.foreground }}>{status}</Text>
                  </Pressable>
                ))}
                {/* Circle feature */}
                <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 8 }}>
                  <Pressable
                    onPress={() => setFormData((p) => ({ ...p, open_for_networking: !p.open_for_networking }))}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: formData.open_for_networking ? Colors.primary : Colors.border, backgroundColor: formData.open_for_networking ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                      {formData.open_for_networking && <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                    </View>
                    <View>
                      <Text style={{ fontSize: 12, color: Colors.foreground }}>Circle feature enabled</Text>
                      <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>Internal only</Text>
                    </View>
                  </Pressable>
                </View>
              </View>

              <EF label="Capacity (Optional)" value={formData.capacity?.toString() || ""} onChangeText={(t: string) => setFormData((p) => ({ ...p, capacity: t ? parseInt(t) : undefined }))} keyboardType="numeric" placeholder="Leave empty for unlimited" />

              {/* Restrictions */}
              <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 4 }}>
                <Pressable
                  onPress={() => {
                    setFormData((p) => ({ ...p, is_restricted: !p.is_restricted }));
                    if (formData.is_restricted) { setSelectedGroups(new Set()); setSelectedMembers(new Set()); }
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}
                >
                  <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: formData.is_restricted ? Colors.primary : Colors.border, backgroundColor: formData.is_restricted ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                    {formData.is_restricted && <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground }}>Is this a restricted event?</Text>
                </Pressable>

                {formData.is_restricted && (
                  <View style={{ paddingLeft: 16 }}>
                    {/* Groups */}
                    <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Choose Groups</Text>
                    <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, maxHeight: 120, marginBottom: 10 }}>
                      <ScrollView nestedScrollEnabled>
                        {groups.length === 0 ? (
                          <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center", paddingVertical: 16 }}>No groups available</Text>
                        ) : groups.map((g: any) => (
                          <Pressable key={g.id} onPress={() => toggleGroup(g.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
                            <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: selectedGroups.has(g.id) ? Colors.primary : Colors.border, backgroundColor: selectedGroups.has(g.id) ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                              {selectedGroups.has(g.id) && <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                            </View>
                            <Text style={{ fontSize: 12, color: Colors.foreground }}>{g.name}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                    <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 10 }}>{selectedGroups.size} group{selectedGroups.size !== 1 ? "s" : ""} selected</Text>

                    {/* Members */}
                    <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Choose Individual Members</Text>
                    <TextInput
                      style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, fontSize: 12, color: Colors.foreground, marginBottom: 6 }}
                      placeholder="Search members..."
                      placeholderTextColor={Colors.mutedForeground}
                      value={memberSearchQuery}
                      onChangeText={setMemberSearchQuery}
                    />
                    <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, maxHeight: 180, marginBottom: 10 }}>
                      <ScrollView nestedScrollEnabled>
                        {filteredFormMembers.map((m: any) => (
                          <Pressable key={m.id} onPress={() => toggleMember(m.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
                            <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: selectedMembers.has(m.id) ? Colors.primary : Colors.border, backgroundColor: selectedMembers.has(m.id) ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                              {selectedMembers.has(m.id) && <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12, fontWeight: "500", color: Colors.foreground }}>{m.full_name}</Text>
                              <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{m.email}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                    <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 10 }}>{selectedMembers.size} member{selectedMembers.size !== 1 ? "s" : ""} selected</Text>

                    {/* RSVP Date */}
                    <DatePicker label="RSVP Date" value={formData.rsvp_date} onChange={(t: string) => setFormData((p) => ({ ...p, rsvp_date: t }))} placeholder="Select RSVP deadline" hint="Date by which invited members must respond" />
                  </View>
                )}
              </View>

              {/* Pricing */}
              {formData.status.includes("Cost Bearing Event") && (
                <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground, marginBottom: 10 }}>Pricing Details</Text>
                  <Pressable
                    onPress={() => setFormData((p) => ({ ...p, price_charged_via_app: !p.price_charged_via_app }))}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: formData.price_charged_via_app ? Colors.primary : Colors.border, backgroundColor: formData.price_charged_via_app ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                      {formData.price_charged_via_app && <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 12, color: Colors.foreground }}>Is the price charged via the app?</Text>
                  </Pressable>

                  {formData.price_charged_via_app && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <EF label="Price *" value={formData.price?.toString() || ""} onChangeText={(t: string) => {
                          const price = t ? parseFloat(t) : undefined;
                          setFormData((p) => ({ ...p, price, is_paid: price !== undefined && price > 0 }));
                        }} keyboardType="decimal-pad" placeholder="0.00" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Currency *</Text>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {["TRY", "USD"].map((c) => (
                            <Pressable
                              key={c}
                              onPress={() => setFormData((p) => ({ ...p, currency: c }))}
                              style={{
                                flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center",
                                borderWidth: 1,
                                borderColor: formData.currency === c ? Colors.primary : Colors.border,
                                backgroundColor: formData.currency === c ? Colors.primary + "1A" : "white",
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "500", color: formData.currency === c ? "white" : Colors.mutedForeground }}>{c}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Submit */}
            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1, marginBottom: 8 })}
            >
              <Text style={{ color: "white", fontWeight: "600", fontSize: 15 }}>{editingEvent ? "Update Event" : "Create Event"}</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowModal(false); resetForm(); }}
              style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontWeight: "500", color: Colors.foreground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

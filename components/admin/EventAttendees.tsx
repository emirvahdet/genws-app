import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Users, Trash2, Plus, Search, X, Check, UserX } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface Profile { id: string; full_name: string; }
interface CancelledProfile { id: string; full_name: string; cancelled_by_name: string | null; cancelled_at: string | null; self_cancelled: boolean; }
interface PlusOneGuest { id: string; guest_name: string; guest_email: string; user_id: string; }

interface Props { eventId: string; eventTitle: string; }

export function EventAttendees({ eventId, eventTitle }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [waitlistProfiles, setWaitlistProfiles] = useState<Profile[]>([]);
  const [cancelledProfiles, setCancelledProfiles] = useState<CancelledProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [registeredUserIds, setRegisteredUserIds] = useState<Set<string>>(new Set());
  const [attendeeStatuses, setAttendeeStatuses] = useState<Map<string, boolean>>(new Map());
  const [updatingAttendance, setUpdatingAttendance] = useState<string | null>(null);
  const [plusOneGuests, setPlusOneGuests] = useState<Map<string, PlusOneGuest>>(new Map());

  useEffect(() => { if (isOpen) fetchRegisteredGuests(); }, [isOpen]);
  useEffect(() => {
    if (isAddMode && searchQuery.length >= 2) searchUsers();
    else setSearchResults([]);
  }, [searchQuery, isAddMode]);

  const fetchRegisteredGuests = async () => {
    setLoading(true);
    try {
      const { data: regs, error: regError } = await supabase
        .from("event_registrations")
        .select("user_id, refund_processed, is_waiting_list, cancelled_by, cancelled_at")
        .eq("event_id", eventId);
      if (regError) throw regError;

      const confirmedIds = (regs || []).filter((r: any) => !r.refund_processed && !r.is_waiting_list).map((r: any) => r.user_id);
      const waitlistIds = (regs || []).filter((r: any) => !r.refund_processed && r.is_waiting_list).map((r: any) => r.user_id);
      const activeIds = new Set([...confirmedIds, ...waitlistIds]);
      const cancelledRegs = (regs || []).filter((r: any) => r.refund_processed && !activeIds.has(r.user_id));
      const cancelledIds = cancelledRegs.map((r: any) => r.user_id);

      setRegisteredUserIds(new Set([...confirmedIds, ...waitlistIds]));

      // Fetch profiles
      if (confirmedIds.length > 0) {
        const { data } = await supabase.from("profiles").select("id, full_name").in("id", confirmedIds);
        setProfiles(data || []);
      } else setProfiles([]);

      if (waitlistIds.length > 0) {
        const { data } = await supabase.from("profiles").select("id, full_name").in("id", waitlistIds);
        setWaitlistProfiles(data || []);
      } else setWaitlistProfiles([]);

      // Cancelled
      if (cancelledIds.length > 0) {
        const { data: cancelledProfs } = await supabase.from("profiles").select("id, full_name").in("id", cancelledIds);
        const cancellerIds = cancelledRegs.map((r: any) => r.cancelled_by).filter(Boolean);
        let cancellerNames = new Map<string, string>();
        if (cancellerIds.length > 0) {
          const { data: cp } = await supabase.from("profiles").select("id, full_name").in("id", cancellerIds);
          (cp || []).forEach((p: any) => cancellerNames.set(p.id, p.full_name));
        }
        setCancelledProfiles((cancelledProfs || []).map((prof: any) => {
          const reg = cancelledRegs.find((r: any) => r.user_id === prof.id);
          const cid = reg?.cancelled_by;
          const self = cid === prof.id;
          return { id: prof.id, full_name: prof.full_name, cancelled_by_name: cid ? (self ? null : cancellerNames.get(cid) || "Admin") : null, cancelled_at: reg?.cancelled_at || null, self_cancelled: self };
        }));
      } else setCancelledProfiles([]);

      // Attendance
      if (confirmedIds.length > 0) {
        const { data: att } = await supabase.from("event_attendees").select("user_id, verified_attendance").eq("event_id", eventId).in("user_id", confirmedIds);
        const m = new Map<string, boolean>();
        (att || []).forEach((a: any) => m.set(a.user_id, a.verified_attendance || false));
        setAttendeeStatuses(m);
      } else setAttendeeStatuses(new Map());

      // +1 guests
      if (confirmedIds.length > 0) {
        const { data: po } = await supabase.from("event_plus_one_guests").select("id, guest_name, guest_email, user_id").eq("event_id", eventId);
        const m = new Map<string, PlusOneGuest>();
        (po || []).forEach((p: any) => m.set(p.user_id, p));
        setPlusOneGuests(m);
      } else setPlusOneGuests(new Map());
    } catch (e) {
      __DEV__ && console.log("Error fetching guests:", e);
      Alert.alert("Error", "Failed to load registered guests");
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    setSearchLoading(true);
    try {
      const { data } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${searchQuery}%`).limit(10);
      setSearchResults((data || []).filter((u: any) => !registeredUserIds.has(u.id)));
    } catch (e) {
      __DEV__ && console.log("Error searching:", e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleDeleteGuest = (guest: Profile) => {
    Alert.alert("Remove Guest", `Remove ${guest.full_name} from this event?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");
            const { error } = await supabase.from("event_registrations").update({ refund_processed: true, cancelled_by: user.id, cancelled_at: new Date().toISOString() }).eq("event_id", eventId).eq("user_id", guest.id);
            if (error) throw error;
            fetchRegisteredGuests();
          } catch { Alert.alert("Error", "Failed to remove guest"); }
        },
      },
    ]);
  };

  const handleAddGuest = async (user: Profile) => {
    try {
      const { data: existing } = await supabase.from("event_registrations").select("id").eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
      let error;
      if (existing) {
        const r = await supabase.from("event_registrations").update({ refund_processed: false, cancelled_by: null, cancelled_at: null, payment_status: "completed", terms_accepted: true, cancellation_policy_accepted: true, is_waiting_list: false, refund_requested: false, refund_approved: null }).eq("id", existing.id);
        error = r.error;
      } else {
        const r = await supabase.from("event_registrations").insert({ event_id: eventId, user_id: user.id, payment_status: "completed", terms_accepted: true, cancellation_policy_accepted: true });
        error = r.error;
      }
      if (error) throw error;
      Alert.alert("Guest Added", `${user.full_name} has been added.`);
      setRegisteredUserIds((prev) => new Set([...prev, user.id]));
      setSearchResults((prev) => prev.filter((u) => u.id !== user.id));
      fetchRegisteredGuests();
    } catch { Alert.alert("Error", "Failed to add guest"); }
  };

  const handleManualVerification = async (userId: string, verified: boolean) => {
    setUpdatingAttendance(userId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: existing } = await supabase.from("event_attendees").select("id").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
      if (existing) {
        await supabase.from("event_attendees").update({ verified_attendance: verified, verified_at: verified ? new Date().toISOString() : null, verified_by: verified ? user.id : null }).eq("event_id", eventId).eq("user_id", userId);
      } else {
        await supabase.from("event_attendees").insert({ event_id: eventId, user_id: userId, marked_by: user.id, verified_attendance: verified, verified_at: verified ? new Date().toISOString() : null, verified_by: verified ? user.id : null });
      }
      setAttendeeStatuses((prev) => { const n = new Map(prev); n.set(userId, verified); return n; });
    } catch { Alert.alert("Error", "Failed to update attendance"); }
    finally { setUpdatingAttendance(null); }
  };

  const verifiedCount = Array.from(attendeeStatuses.values()).filter((v) => v).length;

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}
      >
        <Users size={14} color={Colors.foreground} />
        <Text style={{ fontSize: 12, color: Colors.foreground }}>Guests</Text>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => { setIsOpen(false); setIsAddMode(false); setSearchQuery(""); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }} numberOfLines={1}>Guests - {eventTitle}</Text>
              <Pressable onPress={() => { setIsOpen(false); setIsAddMode(false); setSearchQuery(""); }}>
                <X size={20} color={Colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Stats */}
            {(profiles.length > 0 || waitlistProfiles.length > 0) && (
              <View style={{ flexDirection: "row", gap: 16, backgroundColor: Colors.muted, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 18, fontWeight: "700" }}>{profiles.length}</Text>
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>Registered</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#16a34a" }}>{verifiedCount}</Text>
                  <Text style={{ fontSize: 10, color: "#16a34a" }}>Verified</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#ea580c" }}>{profiles.length - verifiedCount}</Text>
                  <Text style={{ fontSize: 10, color: "#ea580c" }}>Unverified</Text>
                </View>
                {waitlistProfiles.length > 0 && (
                  <View style={{ alignItems: "center", borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#2563eb" }}>{waitlistProfiles.length}</Text>
                    <Text style={{ fontSize: 10, color: "#2563eb" }}>Waitlist</Text>
                  </View>
                )}
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ paddingVertical: 32 }} />
              ) : profiles.length === 0 && waitlistProfiles.length === 0 && cancelledProfiles.length === 0 ? (
                <Text style={{ textAlign: "center", color: Colors.mutedForeground, paddingVertical: 32, fontSize: 13 }}>No registered guests</Text>
              ) : (
                <>
                  {/* Confirmed */}
                  {profiles.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 8 }}>Confirmed Guests</Text>
                      {profiles.map((p, i) => {
                        const isVerified = attendeeStatuses.get(p.id) || false;
                        const plusOne = plusOneGuests.get(p.id);
                        return (
                          <View key={p.id} style={{ marginBottom: 6 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: isVerified ? "#16a34a33" : Colors.border, backgroundColor: isVerified ? "#f0fdf4" : "white" }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                                <Pressable
                                  onPress={() => handleManualVerification(p.id, !isVerified)}
                                  disabled={updatingAttendance === p.id}
                                  style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: isVerified ? "#16a34a" : Colors.border, backgroundColor: isVerified ? "#16a34a" : "white", alignItems: "center", justifyContent: "center" }}
                                >
                                  {isVerified && <Check size={14} color="white" />}
                                </Pressable>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: "500" }} numberOfLines={1}>{i + 1}. {p.full_name}</Text>
                                  {isVerified && <Text style={{ fontSize: 10, color: "#16a34a" }}>Verified</Text>}
                                </View>
                              </View>
                              <Pressable onPress={() => handleDeleteGuest(p)} style={{ padding: 6 }}>
                                <Trash2 size={16} color={Colors.destructive} />
                              </Pressable>
                            </View>
                            {plusOne && (
                              <View style={{ marginLeft: 32, marginTop: 4, padding: 8, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border, backgroundColor: Colors.muted, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Users size={12} color={Colors.mutedForeground} />
                                <View>
                                  <Text style={{ fontSize: 11, fontWeight: "500", color: Colors.mutedForeground }}>+1: {plusOne.guest_name}</Text>
                                  <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{plusOne.guest_email}</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 6 }}>Total: {profiles.length} ({verifiedCount} verified)</Text>
                    </View>
                  )}

                  {/* Waitlist */}
                  {waitlistProfiles.length > 0 && (
                    <View style={{ marginBottom: 16, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#2563eb", marginBottom: 8 }}>Waitlist</Text>
                      {waitlistProfiles.map((p, i) => (
                        <View key={p.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", marginBottom: 6 }}>
                          <View>
                            <Text style={{ fontSize: 13, fontWeight: "500" }}>{i + 1}. {p.full_name}</Text>
                            <Text style={{ fontSize: 10, color: "#2563eb" }}>On waitlist</Text>
                          </View>
                          <Pressable onPress={() => handleDeleteGuest(p)} style={{ padding: 6 }}>
                            <Trash2 size={16} color={Colors.destructive} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Cancelled */}
                  {cancelledProfiles.length > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 8, opacity: 0.6 }}>Previously Registered (Cancelled)</Text>
                      {cancelledProfiles.map((p, i) => (
                        <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border + "33", backgroundColor: Colors.muted, marginBottom: 6, opacity: 0.6 }}>
                          <UserX size={16} color={Colors.mutedForeground} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.mutedForeground }}>{i + 1}. {p.full_name}</Text>
                            <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>
                              {p.self_cancelled ? "Cancelled by themselves" : p.cancelled_by_name ? `Removed by ${p.cancelled_by_name}` : "Cancelled"}
                              {p.cancelled_at && ` · ${new Date(p.cancelled_at).toLocaleDateString()}`}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Add Guests */}
            {isAddMode ? (
              <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600" }}>Add Guests</Text>
                  <Pressable onPress={() => { setIsAddMode(false); setSearchQuery(""); setSearchResults([]); }}>
                    <X size={18} color={Colors.mutedForeground} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, marginBottom: 8 }}>
                  <Search size={14} color={Colors.mutedForeground} />
                  <TextInput
                    style={{ flex: 1, paddingVertical: 8, paddingLeft: 8, fontSize: 13, color: Colors.foreground }}
                    placeholder="Search users by name..."
                    placeholderTextColor={Colors.mutedForeground}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                </View>
                {searchLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ paddingVertical: 16 }} />
                ) : searchResults.length > 0 ? (
                  <View style={{ maxHeight: 180 }}>
                    <ScrollView>
                      {searchResults.map((u) => (
                        <View key={u.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: "500" }}>{u.full_name}</Text>
                          <Pressable
                            onPress={() => handleAddGuest(u)}
                            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}
                          >
                            <Plus size={12} color={Colors.foreground} />
                            <Text style={{ fontSize: 11, color: Colors.foreground }}>Add</Text>
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : searchQuery.length >= 2 ? (
                  <Text style={{ textAlign: "center", color: Colors.mutedForeground, fontSize: 12, paddingVertical: 16 }}>No users found</Text>
                ) : (
                  <Text style={{ textAlign: "center", color: Colors.mutedForeground, fontSize: 12, paddingVertical: 16 }}>Type at least 2 characters</Text>
                )}
              </View>
            ) : (
              <Pressable
                onPress={() => setIsAddMode(true)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
              >
                <Plus size={16} color={Colors.foreground} />
                <Text style={{ fontSize: 13, color: Colors.foreground }}>Add Guests</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

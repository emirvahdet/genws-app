import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { X, ScanLine, Check, UserCheck, UserX, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface Profile {
  id: string;
  full_name: string;
}

interface EventAttendeesModalProps {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
}

export function EventAttendeesModal({
  visible,
  onClose,
  eventId,
  eventTitle,
}: EventAttendeesModalProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [waitlistProfiles, setWaitlistProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [attendeeStatuses, setAttendeeStatuses] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (visible) {
      fetchRegisteredGuests();
    }
  }, [visible]);

  const fetchRegisteredGuests = async () => {
    setLoading(true);
    try {
      // Get registered user IDs for this event (exclude refunded)
      const { data: regs, error: regError } = await supabase
        .from("event_registrations")
        .select("user_id, refund_processed, is_waiting_list")
        .eq("event_id", eventId);

      if (regError) throw regError;

      // Separate confirmed and waitlist users
      const confirmedUserIds = (regs || [])
        .filter((r: any) => !r.refund_processed && !r.is_waiting_list)
        .map((r: any) => r.user_id);

      const waitlistUserIds = (regs || [])
        .filter((r: any) => !r.refund_processed && r.is_waiting_list)
        .map((r: any) => r.user_id);

      // Fetch confirmed profiles
      if (confirmedUserIds.length > 0) {
        const { data: profs, error: profsError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", confirmedUserIds);

        if (profsError) throw profsError;
        setProfiles(profs || []);
      } else {
        setProfiles([]);
      }

      // Fetch waitlist profiles
      if (waitlistUserIds.length > 0) {
        const { data: waitlistProfs, error: waitlistProfsError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", waitlistUserIds);

        if (waitlistProfsError) throw waitlistProfsError;
        setWaitlistProfiles(waitlistProfs || []);
      } else {
        setWaitlistProfiles([]);
      }

      // Fetch attendance statuses
      if (confirmedUserIds.length > 0) {
        const { data: attendees } = await supabase
          .from("event_attendees")
          .select("user_id, verified_attendance")
          .eq("event_id", eventId)
          .in("user_id", confirmedUserIds);

        const statusMap = new Map<string, boolean>();
        (attendees || []).forEach((a: any) => {
          statusMap.set(a.user_id, a.verified_attendance || false);
        });
        setAttendeeStatuses(statusMap);
      }
    } catch (error) {
      console.error("Error fetching guests:", error);
      Alert.alert("Error", "Failed to load guest list");
    } finally {
      setLoading(false);
    }
  };

  const verifiedCount = Array.from(attendeeStatuses.values()).filter((v) => v).length;

  const handleScanQRCode = () => {
    onClose();
    router.push(`/(tabs)/event/scanner?eventId=${eventId}` as any);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Registered Guests</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <X size={24} color={Colors.foreground} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Top Section: Event Title */}
            <View style={styles.topSection}>
              <Text style={styles.subtitle}>Manage guests registered for this event</Text>
            </View>

            {/* Stats */}
            {(profiles.length > 0 || waitlistProfiles.length > 0) && (
              <View style={styles.stats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profiles.length}</Text>
                  <Text style={styles.statLabel}>Registered</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: "#16a34a" }]}>
                    {verifiedCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: "#16a34a" }]}>Verified</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: "#ea580c" }]}>
                    {profiles.length - verifiedCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: "#ea580c" }]}>Unverified</Text>
                </View>
                {waitlistProfiles.length > 0 && (
                  <View style={[styles.statItem, styles.statItemBorder]}>
                    <Text style={[styles.statValue, { color: "#2563eb" }]}>
                      {waitlistProfiles.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: "#2563eb" }]}>Waitlist</Text>
                  </View>
                )}
              </View>
            )}

            {/* Scan QR Code Button */}
            <View style={styles.scanButtonContainer}>
              <Pressable
                onPress={handleScanQRCode}
                style={({ pressed }) => [
                  styles.scanButton,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ScanLine size={18} color="white" />
                <Text style={styles.scanButtonText}>Scan QR Code</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading guests...</Text>
              </View>
            ) : profiles.length === 0 && waitlistProfiles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No registered guests found for this event</Text>
              </View>
            ) : (
              <View style={styles.guestList}>
                {/* Confirmed Guests */}
                {profiles.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Confirmed Guests</Text>
                    {profiles.map((profile, index) => {
                      const isVerified = attendeeStatuses.get(profile.id) || false;
                      return (
                        <View key={profile.id} style={styles.guestItem}>
                          <View style={styles.guestInfo}>
                            <Text style={styles.guestName}>
                              {index + 1}. {profile.full_name}
                            </Text>
                            {isVerified ? (
                              <View style={styles.verifiedBadge}>
                                <Check size={12} color="#16a34a" />
                                <Text style={styles.verifiedText}>Verified</Text>
                              </View>
                            ) : (
                              <Text style={styles.unverifiedText}>Not verified</Text>
                            )}
                          </View>
                          {isVerified && (
                            <UserCheck size={20} color="#16a34a" />
                          )}
                        </View>
                      );
                    })}
                    <View style={styles.totalContainer}>
                      <Text style={styles.totalText}>
                        Total: {profiles.length} {profiles.length === 1 ? "guest" : "guests"} (
                        {verifiedCount} verified)
                      </Text>
                    </View>
                  </View>
                )}

                {/* Waitlist Section */}
                {waitlistProfiles.length > 0 && (
                  <View style={[styles.section, styles.sectionBorder]}>
                    <Text style={[styles.sectionTitle, { color: "#2563eb" }]}>Waitlist</Text>
                    {waitlistProfiles.map((profile, index) => (
                      <View key={profile.id} style={styles.waitlistItem}>
                        <View style={styles.guestInfo}>
                          <Text style={styles.guestName}>
                            {index + 1}. {profile.full_name}
                          </Text>
                          <Text style={styles.waitlistText}>On waitlist</Text>
                        </View>
                      </View>
                    ))}
                    <View style={styles.totalContainer}>
                      <Text style={[styles.totalText, { color: "#2563eb" }]}>
                        Waitlist: {waitlistProfiles.length}{" "}
                        {waitlistProfiles.length === 1 ? "person" : "people"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.foreground,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  topSection: {
    padding: 16,
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.mutedForeground,
  },
  scanButtonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  scanButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  stats: {
    flexDirection: "row",
    gap: 16,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: Colors.muted + "80",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.foreground,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.mutedForeground,
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.mutedForeground,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: Colors.mutedForeground,
    textAlign: "center",
  },
  guestList: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.mutedForeground,
    marginBottom: 8,
  },
  guestItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "white",
  },
  guestInfo: {
    flex: 1,
    gap: 4,
  },
  guestName: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.foreground,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: "#16a34a",
  },
  unverifiedText: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  waitlistItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  waitlistText: {
    fontSize: 12,
    color: "#2563eb",
  },
  totalContainer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  totalText: {
    fontSize: 13,
    color: Colors.mutedForeground,
  },
});

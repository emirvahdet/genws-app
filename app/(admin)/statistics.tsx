import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, BarChart3, Users, Search, Check, X } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface EventStats {
  id: string;
  title: string;
  start_date: string;
  registered_count: number;
  verified_count: number;
  unverified_count: number;
}

interface MemberStats {
  id: string;
  full_name: string;
  email: string;
  registered_events: number;
  verified_events: number;
  unverified_events: number;
}

type Tab = "events" | "members";

export default function AdminStatisticsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [eventStats, setEventStats] = useState<EventStats[]>([]);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { fetchStatistics(); }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // Event statistics
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, title, start_date")
        .order("start_date", { ascending: false });
      if (eventsError) throw eventsError;

      const eventStatsData: EventStats[] = [];
      for (const event of events || []) {
        const { count: regCount } = await supabase
          .from("event_registrations")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("refund_processed", false);
        const { count: verifiedCount } = await supabase
          .from("event_attendees")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("verified_attendance", true);
        eventStatsData.push({
          id: event.id,
          title: event.title,
          start_date: event.start_date,
          registered_count: regCount || 0,
          verified_count: verifiedCount || 0,
          unverified_count: (regCount || 0) - (verifiedCount || 0),
        });
      }
      setEventStats(eventStatsData);

      // Member statistics
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (profilesError) throw profilesError;

      const memberStatsData: MemberStats[] = [];
      for (const profile of profiles || []) {
        const { count: regCount } = await supabase
          .from("event_registrations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("refund_processed", false);
        const { count: verifiedCount } = await supabase
          .from("event_attendees")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("verified_attendance", true);
        memberStatsData.push({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          registered_events: regCount || 0,
          verified_events: verifiedCount || 0,
          unverified_events: (regCount || 0) - (verifiedCount || 0),
        });
      }
      setMemberStats(memberStatsData);
    } catch (e) {
      __DEV__ && console.log("Error fetching statistics:", e);
      Alert.alert("Error", "Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = memberStats.filter(
    (m) => m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const StatBox = ({ value, label, color }: { value: number; label: string; color?: string }) => (
    <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: color ? color + "1A" : Colors.muted, alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: color || Colors.foreground }}>{value}</Text>
      <Text style={{ fontSize: 10, color: color || Colors.mutedForeground }}>{label}</Text>
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable onPress={() => router.replace("/(tabs)/profile" as any)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Admin Statistics</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>Attendance verification & analytics</Text>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={{ flexDirection: "row", backgroundColor: Colors.muted, borderRadius: 10, padding: 3, marginBottom: 16 }}>
          {([
            { key: "events" as Tab, label: "Events", icon: BarChart3 },
            { key: "members" as Tab, label: "Members", icon: Users },
          ]).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: activeTab === tab.key ? "white" : "transparent" }}
            >
              <tab.icon size={14} color={activeTab === tab.key ? Colors.foreground : Colors.mutedForeground} />
              <Text style={{ fontSize: 13, fontWeight: activeTab === tab.key ? "600" : "400", color: activeTab === tab.key ? Colors.foreground : Colors.mutedForeground }}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Events Tab */}
        {activeTab === "events" && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>Event Attendance Breakdown</Text>
            {eventStats.length === 0 ? (
              <Text style={{ textAlign: "center", color: Colors.mutedForeground, paddingVertical: 32 }}>No events found</Text>
            ) : (
              eventStats.map((event) => (
                <View key={event.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground, marginBottom: 2 }} numberOfLines={1}>{event.title}</Text>
                  <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 10 }}>{new Date(event.start_date).toLocaleDateString()}</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <StatBox value={event.registered_count} label="Registered" />
                    <StatBox value={event.verified_count} label="Verified" color="#16a34a" />
                    <StatBox value={event.unverified_count} label="Unverified" color="#ea580c" />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>Per-Member Event History</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "white", borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 4 }}>
              <Search size={16} color={Colors.mutedForeground} />
              <TextInput
                style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14, color: Colors.foreground }}
                placeholder="Search members..." placeholderTextColor={Colors.mutedForeground}
                value={searchQuery} onChangeText={setSearchQuery}
              />
            </View>
            {filteredMembers.length === 0 ? (
              <Text style={{ textAlign: "center", color: Colors.mutedForeground, paddingVertical: 32 }}>No members found</Text>
            ) : (
              filteredMembers.map((member) => (
                <View key={member.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + "1A", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.primary }}>
                        {member.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }} numberOfLines={1}>{member.full_name}</Text>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }} numberOfLines={1}>{member.email}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <StatBox value={member.registered_events} label="Registered" />
                    <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: "#16a34a1A", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Check size={14} color="#16a34a" />
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#16a34a" }}>{member.verified_events}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: "#16a34a" }}>Verified</Text>
                    </View>
                    <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: "#ea580c1A", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <X size={14} color="#ea580c" />
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#ea580c" }}>{member.unverified_events}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: "#ea580c" }}>Unverified</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

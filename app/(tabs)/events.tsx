import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ImageBackground,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { useViewAs } from "../../stores/ViewAsContext";
import { MobileLayout } from "../../components/layout/MobileLayout";
import { Colors } from "../../constants/Colors";

interface Event {
  id: string;
  title: string;
  excerpt?: string;
  description: string;
  location: string;
  city: string;
  country: string;
  start_date: string;
  end_date?: string;
  image_url?: string;
  visibility_type: string;
  allowed_interests: string[];
  status: string[];
  capacity?: number;
  host: string;
  dress_code?: string;
  is_restricted?: boolean;
  rsvp_date?: string;
}

interface Registration {
  event_id: string;
  is_waiting_list: boolean;
}

const PAST_PAGE_SIZE = 5;

const formatUTCDate = (dateStr: string, fmt: "date" | "time" | "short") => {
  const d = new Date(dateStr);
  if (fmt === "date") {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  if (fmt === "time") {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

const getStatusBadge = (event: Event, registrationCount: number): string | null => {
  const isFullyBooked = event.status.includes("Fully Booked");
  const isRegistrationClosed = event.status.includes("Registration Closed");
  const hasWaitlist = event.status.includes("Waitlist");

  if (event.is_restricted) {
    if (event.rsvp_date && new Date() > new Date(event.rsvp_date)) return "Registration Closed";
    return "Invitation Only";
  }
  if (isFullyBooked) return "Fully Booked";
  if (isRegistrationClosed) return "Registration Closed";
  if (hasWaitlist) return "Waitlist Open";

  const customStatuses = event.status.filter(
    (s) => !["Open to Registration", "Registration Closed", "Fully Booked", "Waitlist"].includes(s)
  );
  return customStatuses[0] || null;
};

export default function EventsScreen() {
  const router = useRouter();
  const { getEffectiveUserId, isViewingAs } = useViewAs();

  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pastDisplayCount, setPastDisplayCount] = useState(PAST_PAGE_SIZE);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchEvents(), fetchRegistrations(), fetchRegistrationCounts(), checkAdmin(), markEventsViewed()]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc("is_admin", { user_id: user.id });
      if (!error && data) setIsAdmin(true);
    } catch {}
  };

  const markEventsViewed = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("has_completed_welcome_onboarding, has_viewed_events")
        .eq("id", user.id)
        .single();
      if (profile?.has_completed_welcome_onboarding && !profile?.has_viewed_events) {
        await supabase.from("profiles").update({ has_viewed_events: true }).eq("id", user.id);
      }
    } catch {}
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch (e) { __DEV__ && console.log(e); }
  };

  const fetchRegistrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const effectiveId = getEffectiveUserId(user.id);
      const { data, error } = await (supabase.from("event_registrations") as any)
        .select("event_id, is_waiting_list")
        .eq("user_id", effectiveId);
      if (error) throw error;
      setRegistrations(data || []);
    } catch (e) { __DEV__ && console.log(e); }
  };

  const fetchRegistrationCounts = async () => {
    try {
      const { data, error } = await (supabase.from("event_registration_counts") as any)
        .select("event_id, confirmed_count");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((item: any) => { counts[item.event_id] = item.confirmed_count || 0; });
      setRegistrationCounts(counts);
    } catch (e) { __DEV__ && console.log(e); }
  };

  const now = new Date();
  const filteredEvents = isAdmin && !isViewingAs
    ? events
    : events.filter((e) => !e.status.includes("Test Event"));

  const upcomingEvents = filteredEvents
    .filter((e) => new Date(e.start_date) >= now)
    .sort((a, b) => {
      const aC = a.status.includes("Registration Closed");
      const bC = b.status.includes("Registration Closed");
      if (aC && !bC) return 1;
      if (!aC && bC) return -1;
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });

  const pastEvents = filteredEvents
    .filter((e) => new Date(e.start_date) < now)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  const displayedPastEvents = pastEvents.slice(0, pastDisplayCount);

  const renderEventCard = (event: Event) => {
    const regCount = registrationCounts[event.id] || 0;
    const isFullyBooked = event.status.includes("Fully Booked");
    const isRegClosed = event.status.includes("Registration Closed");
    const isAtCapacity = (event.capacity && regCount >= event.capacity) || isRegClosed || isFullyBooked;
    const badge = getStatusBadge(event, regCount);

    const startDate = new Date(event.start_date);
    const endDate = event.end_date ? new Date(event.end_date) : null;
    const isMultiDay = endDate && (
      startDate.getUTCFullYear() !== endDate.getUTCFullYear() ||
      startDate.getUTCMonth() !== endDate.getUTCMonth() ||
      startDate.getUTCDate() !== endDate.getUTCDate()
    );
    const isSameMonth = endDate &&
      startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
      startDate.getUTCMonth() === endDate.getUTCMonth();

    let dateDisplay: string;
    if (isMultiDay && endDate) {
      dateDisplay = isSameMonth
        ? `${startDate.getUTCDate()}-${formatUTCDate(event.end_date!, "date")}`
        : `${formatUTCDate(event.start_date, "short")} - ${formatUTCDate(event.end_date!, "date")}`;
    } else {
      dateDisplay = formatUTCDate(event.start_date, "date");
    }

    const timeDisplay = !isMultiDay
      ? `${formatUTCDate(event.start_date, "time")}${event.end_date ? ` - ${formatUTCDate(event.end_date, "time")}` : ""}`
      : null;

    return (
      <Pressable
        onPress={() => router.push(`/event/${event.id}` as any)}
        style={({ pressed }) => ({
          borderRadius: 12,
          overflow: "hidden",
          minHeight: 160,
          opacity: pressed ? 0.9 : 1,
          marginBottom: 12,
        })}
      >
        <ImageBackground
          source={event.image_url ? { uri: event.image_url } : undefined}
          style={{ minHeight: 160 }}
          imageStyle={{ borderRadius: 12 }}
        >
          {/* Dark overlay */}
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "rgba(50, 71, 80, 0.70)",
              borderRadius: 12,
            }}
          />
          <View style={{ padding: 16, gap: 8 }}>
            {/* Title */}
            <Text style={{ fontSize: 18, fontWeight: "600", color: "white" }} numberOfLines={2}>
              {event.title}
            </Text>

            {/* Excerpt */}
            {(event.excerpt || event.description) && (
              <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }} numberOfLines={2}>
                {event.excerpt || event.description}
              </Text>
            )}

            {/* Host */}
            <Text style={{ fontSize: 12 }}>
              <Text style={{ color: "#ced9cf" }}>Host: </Text>
              <Text style={{ color: "white", fontWeight: "500" }}>{event.host}</Text>
            </Text>

            {/* Date/Location grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Text style={{ fontSize: 12, minWidth: "45%" }}>
                <Text style={{ color: "#ced9cf" }}>Date: </Text>
                <Text style={{ color: "white", fontWeight: "500" }}>{dateDisplay}</Text>
              </Text>
              <Text style={{ fontSize: 12, minWidth: "45%" }} numberOfLines={1}>
                <Text style={{ color: "#ced9cf" }}>Location: </Text>
                <Text style={{ color: "white", fontWeight: "500" }}>{event.city || event.location}</Text>
              </Text>
              {timeDisplay && (
                <Text style={{ fontSize: 12, minWidth: "45%" }}>
                  <Text style={{ color: "#ced9cf" }}>Time: </Text>
                  <Text style={{ color: "white", fontWeight: "500" }}>{timeDisplay}</Text>
                </Text>
              )}
              <Text style={{ fontSize: 12, minWidth: "45%" }}>
                {event.is_restricted && event.rsvp_date ? (
                  <>
                    <Text style={{ color: "#ced9cf" }}>RSVP: </Text>
                    <Text style={{ color: "white", fontWeight: "500" }}>{formatUTCDate(event.rsvp_date, "date")}</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ color: "#ced9cf" }}>Capacity: </Text>
                    <Text style={{ color: isAtCapacity ? "#f87171" : "white", fontWeight: "500" }}>
                      {isFullyBooked && event.capacity
                        ? `${event.capacity}/${event.capacity}`
                        : event.capacity
                        ? `${regCount}/${event.capacity}`
                        : `${regCount} registered`}
                    </Text>
                  </>
                )}
              </Text>
            </View>

            {/* Status badge */}
            {badge && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
                <View style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(255,255,255,0.1)" }}>
                  <Text style={{ fontSize: 11, color: "white" }}>{badge}</Text>
                </View>
              </View>
            )}
          </View>
        </ImageBackground>
      </Pressable>
    );
  };

  const listData = [
    { key: "upcoming", data: upcomingEvents },
    { key: "past", data: displayedPastEvents },
  ];

  if (loading) {
    return (
      <MobileLayout>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <FlatList
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 24, fontWeight: "600", color: Colors.foreground }}>Events</Text>
            <Text style={{ color: Colors.mutedForeground, fontSize: 14, marginTop: 4 }}>
              Exclusive gatherings for society members
            </Text>
          </View>
        }
        data={[]}
        renderItem={null}
        ListEmptyComponent={
          <View>
            {/* Upcoming */}
            {upcomingEvents.length === 0 ? (
              <View style={{ backgroundColor: "white", borderRadius: 12, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
                <Text style={{ color: Colors.mutedForeground }}>No upcoming events</Text>
              </View>
            ) : (
              upcomingEvents.map((e) => <View key={e.id}>{renderEventCard(e)}</View>)
            )}

            {/* Past Events */}
            {pastEvents.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: "600", color: Colors.foreground, marginBottom: 16, paddingTop: 8 }}>
                  Past Events
                </Text>
                {displayedPastEvents.map((e) => <View key={e.id}>{renderEventCard(e)}</View>)}
                {pastEvents.length > pastDisplayCount && (
                  <Pressable
                    onPress={() => setPastDisplayCount((c) => c + PAST_PAGE_SIZE)}
                    style={({ pressed }) => ({
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: "center",
                      marginTop: 4,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: Colors.foreground, fontWeight: "500" }}>Load more past events</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        }
      />
    </MobileLayout>
  );
}


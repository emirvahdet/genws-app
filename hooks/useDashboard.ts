import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { useViewAs } from "../stores/ViewAsContext";

export interface Update {
  id: string;
  title: string;
  content: string;
  created_at: string;
  published: boolean;
  type?: "update" | "news";
  content_type?: string;
  image_url?: string;
  external_url?: string;
}

export interface DashboardEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  city: string;
  country: string;
  start_date: string;
  end_date?: string;
  image_url?: string;
  open_for_networking?: boolean;
}

export interface LiveNetworkingEvent {
  event: DashboardEvent;
  hasVerifiedAttendance: boolean;
}

export const useDashboard = () => {
  const { isViewingAs, viewAsUser, getEffectiveUserId } = useViewAs();

  const [userName, setUserName] = useState("");
  const [updates, setUpdates] = useState<Update[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [registrations, setRegistrations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveNetworkingEvents, setLiveNetworkingEvents] = useState<LiveNetworkingEvent[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async () => {
    try {
      if (isViewingAs && viewAsUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", viewAsUser.id)
          .single();
        if (profile?.full_name) setUserName(profile.full_name);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile?.full_name) setUserName(profile.full_name);
    } catch (error: unknown) {
      __DEV__ && console.log("Error fetching profile:", error);
    }
  }, [isViewingAs, viewAsUser]);

  const fetchUpdates = useCallback(async () => {
    try {
      const [{ data: updatesData, error: updatesError }, { data: newsData, error: newsError }] =
        await Promise.all([
          supabase.from("updates").select("*").eq("published", true).order("created_at", { ascending: false }),
          supabase.from("news").select("*").eq("published", true).order("created_at", { ascending: false }),
        ]);
      if (updatesError) throw updatesError;
      if (newsError) throw newsError;
      const combined = [
        ...(updatesData || []).map((u) => ({ ...u, type: "update" as const })),
        ...(newsData || []).map((n) => ({ ...n, type: "news" as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUpdates(combined);
    } catch (error: unknown) {
      __DEV__ && console.log("Error fetching updates:", error);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch (error: unknown) {
      __DEV__ && console.log("Error fetching events:", error);
    }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const effectiveId = getEffectiveUserId(user.id);
      const { data, error } = await supabase
        .from("event_registrations")
        .select("event_id, refund_processed")
        .eq("user_id", effectiveId);
      if (error) throw error;
      // Only include active registrations (not cancelled/refunded)
      setRegistrations(new Set(data?.filter((r) => !r.refund_processed).map((r) => r.event_id) || []));
    } catch (error: unknown) {
      __DEV__ && console.log("Error fetching registrations:", error);
    }
  }, [getEffectiveUserId]);

  const fetchLiveNetworkingEvents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const effectiveId = getEffectiveUserId(user.id);
      setCurrentUserId(effectiveId);

      const { data: networkingEvents, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("open_for_networking", true);
      if (eventsError) throw eventsError;
      if (!networkingEvents || networkingEvents.length === 0) {
        setLiveNetworkingEvents([]);
        return;
      }

      const eventIds = networkingEvents.map((e) => e.id);
      const [{ data: userRegistrations, error: regError }, { data: attendances, error: attendanceError }] =
        await Promise.all([
          supabase.from("event_registrations").select("event_id, refund_processed").eq("user_id", effectiveId).in("event_id", eventIds),
          supabase.from("event_attendees").select("event_id, verified_attendance").eq("user_id", effectiveId).in("event_id", eventIds),
        ]);
      if (regError) throw regError;
      if (attendanceError) throw attendanceError;

      // Only include active registrations (not cancelled/refunded)
      const registeredEventIds = new Set(
        userRegistrations?.filter((r) => !r.refund_processed).map((r) => r.event_id) || []
      );
      const verifiedMap = new Map(attendances?.map((a) => [a.event_id, a.verified_attendance]) || []);

      const todayStr = new Date().toISOString().split("T")[0];
      const liveEvents: LiveNetworkingEvent[] = networkingEvents
        .filter((event) => {
          const startDay = event.start_date.split("T")[0];
          const endDay = event.end_date ? event.end_date.split("T")[0] : startDay;
          return todayStr >= startDay && todayStr <= endDay && registeredEventIds.has(event.id);
        })
        .map((event) => ({
          event,
          hasVerifiedAttendance: verifiedMap.get(event.id) === true,
        }));
      setLiveNetworkingEvents(liveEvents);
    } catch (error: unknown) {
      __DEV__ && console.log("Error fetching live networking events:", error);
    }
  }, [getEffectiveUserId]);

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchUserProfile(),
      fetchUpdates(),
      fetchEvents(),
      fetchRegistrations(),
      fetchLiveNetworkingEvents(),
    ]);
    setLoading(false);
  }, [fetchUserProfile, fetchUpdates, fetchEvents, fetchRegistrations, fetchLiveNetworkingEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const submitFeedback = useCallback(async (message: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase.from("help_forms") as any).insert({
        user_id: user.id,
        message: message.trim(),
      });
      if (error) throw error;
      Alert.alert("Message sent", "Thank you! Your message has been submitted to the admin team.");
      return true;
    } catch (error: unknown) {
      __DEV__ && console.log("Error submitting form:", error);
      Alert.alert("Error", "Failed to submit your message. Please try again.");
      return false;
    }
  }, []);

  return {
    userName,
    updates,
    events,
    registrations,
    loading,
    refreshing,
    liveNetworkingEvents,
    currentUserId,
    fetchAll,
    onRefresh,
    submitFeedback,
  };
};

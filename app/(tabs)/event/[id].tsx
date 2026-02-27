import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  useWindowDimensions,
  Share,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Check, Share2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import RenderHtml from "react-native-render-html";
import { supabase } from "../../../lib/supabase";
import { Colors } from "../../../constants/Colors";
import { EventRegButton } from "../../../components/events/EventRegButton";
import { MobileLayout } from "../../../components/layout/MobileLayout";
import { QNBPaymentModal } from "../../../components/payment/QNBPaymentModal";

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  city: string;
  country: string;
  start_date: string;
  end_date?: string;
  image_url?: string;
  status: string[];
  capacity?: number;
  host: string;
  dress_code?: string;
  price?: number;
  currency?: string;
  is_restricted?: boolean;
  rsvp_date?: string;
  price_charged_via_app?: boolean;
}

const fmtUTC = (d: string, f: "date" | "time" | "short" | "dt") => {
  const dt = new Date(d);
  if (f === "date")
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  if (f === "short")
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  if (f === "time")
    return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}, ${dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`;
};

function EventDescription({ description }: { description: string }) {
  const { width } = useWindowDimensions();
  
  return (
    <View style={{ backgroundColor: "#f9fafb", paddingHorizontal: 24, paddingBottom: 24 }}>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: Colors.foreground,
          marginBottom: 12,
        }}
      >
        Event Details
      </Text>
      <RenderHtml
        contentWidth={width - 48}
        source={{ html: description }}
        baseStyle={{
          fontSize: 15,
          lineHeight: 24,
          color: "#324750",
        }}
        tagsStyles={{
          p: { marginTop: 0, marginBottom: 12, color: "#324750" },
          strong: { fontWeight: "700", color: "#00451a" },
          em: { fontStyle: "italic" },
          u: { textDecorationLine: "underline" },
          a: { color: "#00451a", textDecorationLine: "underline" },
          h1: { fontSize: 24, fontWeight: "700", color: "#00451a", marginBottom: 12 },
          h2: { fontSize: 22, fontWeight: "700", color: "#00451a", marginBottom: 10 },
          h3: { fontSize: 20, fontWeight: "700", color: "#00451a", marginBottom: 8 },
          h4: { fontSize: 18, fontWeight: "600", color: "#00451a", marginBottom: 8 },
          h5: { fontSize: 16, fontWeight: "600", color: "#00451a", marginBottom: 6 },
          h6: { fontSize: 15, fontWeight: "600", color: "#00451a", marginBottom: 6 },
          ul: { marginBottom: 12, color: "#324750" },
          ol: { marginBottom: 12, color: "#324750" },
          li: { marginBottom: 4, color: "#324750" },
        }}
      />
    </View>
  );
}

const stripHtml = (h: string) => h.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Registration state
  const [isRegistered, setIsRegistered] = useState(false);
  const [isWaitingList, setIsWaitingList] = useState(false);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [registration, setRegistration] = useState<any>(null);
  const [hasVerifiedAttendance, setHasVerifiedAttendance] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  
  // +1 guest state
  const [plusOneGuest, setPlusOneGuest] = useState<{ name: string; email: string } | null>(null);
  const [plusOneName, setPlusOneName] = useState("");
  const [plusOneEmail, setPlusOneEmail] = useState("");
  const [showPlusOneForm, setShowPlusOneForm] = useState(false);
  const [savingPlusOne, setSavingPlusOne] = useState(false);

  
  // ─── Fetchers ─────────────────────────────────────────────────────────────
  const fetchEvent = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error;
      setEvent(data);
    } catch {
      router.replace("/(tabs)/events" as any);
    }
  }, [id]);

  const fetchRegistration = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("event_registrations") as any)
        .select("*")
        .eq("event_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const isActive = data && !data.refund_processed;
      setIsRegistered(!!isActive);
      setIsWaitingList(isActive ? data?.is_waiting_list || false : false);
      setRegistration(isActive ? data : null);
      if (isActive && data?.id) {
        const { data: pg } = await (supabase.from("event_plus_one_guests") as any)
          .select("*").eq("registration_id", data.id).maybeSingle();
        setPlusOneGuest(pg ? { name: pg.guest_name, email: pg.guest_email } : null);
      } else {
        setPlusOneGuest(null);
      }
    } catch (e) {
      __DEV__ && console.log("fetchRegistration error:", e);
    }
  }, [id]);

  const fetchRegistrationCount = useCallback(async () => {
    try {
      const { data } = await (supabase.from("event_registration_counts") as any)
        .select("confirmed_count").eq("event_id", id).maybeSingle();
      setRegistrationCount(data?.confirmed_count || 0);
    } catch {}
  }, [id]);

  const checkAttendance = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // First check if user has an active registration (not cancelled/refunded)
      const { data: regData } = await (supabase.from("event_registrations") as any)
        .select("id, refund_processed")
        .eq("event_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Only check attendance if user has active registration
      if (regData && !regData.refund_processed) {
        const { data } = await supabase
          .from("event_attendees")
          .select("verified_attendance")
          .eq("event_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        setHasVerifiedAttendance(data?.verified_attendance || false);
      } else {
        // User has no active registration, reset attendance
        setHasVerifiedAttendance(false);
      }
    } catch {}
  }, [id]);

  const checkUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    } catch {}
  }, []);

  const checkAdmin = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc("is_admin", { user_id: user.id });
      if (!error && data) setIsAdmin(true);
    } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchEvent(), fetchRegistration(), fetchRegistrationCount(), checkAttendance(), checkAdmin()]);
    setLoading(false);
  }, [fetchEvent, fetchRegistration, fetchRegistrationCount, checkAttendance, checkAdmin]);

  useEffect(() => {
    fetchAll().then(() => setLoading(false));
  }, [fetchAll]);

  // Realtime registration sync
  useEffect(() => {
    let channel: any = null;
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !id) return;
      channel = supabase
        .channel(`ev_reg_${id}_${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "event_registrations", filter: `event_id=eq.${id}` },
          () => {
            if (!active) return;
            fetchRegistration();
            fetchRegistrationCount();
          }
        )
        .subscribe();
    })();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [id]);

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  // ─── Registration actions ─────────────────────────────────────────────────
  const doRegister = async (shouldBeWaitlist: boolean, userId: string) => {
    const { data: existing } = await (supabase.from("event_registrations") as any)
      .select("id").eq("event_id", id).eq("user_id", userId).maybeSingle();
    let err;
    if (existing) {
      const { error } = await (supabase.from("event_registrations") as any)
        .update({
          refund_processed: false, cancelled_by: null, cancelled_at: null,
          is_waiting_list: shouldBeWaitlist, refund_requested: false, refund_approved: null,
        })
        .eq("id", existing.id);
      err = error;
    } else {
      const { error } = await (supabase.from("event_registrations") as any)
        .insert({ event_id: id, user_id: userId, is_waiting_list: shouldBeWaitlist });
      err = error;
    }
    if (err) throw err;
    const { data: profile } = await supabase
      .from("profiles").select("has_viewed_events, has_joined_event").eq("id", userId).maybeSingle();
    if (profile?.has_viewed_events && !profile?.has_joined_event)
      await supabase.from("profiles").update({ has_joined_event: true }).eq("id", userId);
  };

  const handleRegister = async () => {
    if (!event) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRegistering(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert("Error", "Please log in to register"); return; }
      if (event.status.includes("Registration Closed")) {
        Alert.alert("Registration Closed", "This event is no longer accepting registrations"); return;
      }
      if (event.status.includes("Cost Bearing Event") && event.price_charged_via_app) {
        setRegistering(false);
        setShowPaymentDialog(true);
        return;
      }
      const { data: freshCount } = await (supabase.from("event_registration_counts") as any)
        .select("confirmed_count").eq("event_id", id).maybeSingle();
      const currentCount = freshCount?.confirmed_count || 0;
      const isAtCapacity = !event.is_restricted && event.capacity && currentCount >= event.capacity;
      const shouldBeWaitlist = !!(event.status.includes("Waitlist") || isAtCapacity);
      await doRegister(shouldBeWaitlist, user.id);
      setIsRegistered(true);
      setIsWaitingList(shouldBeWaitlist);
      await fetchRegistrationCount();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (event.status.includes("Cost Bearing Event") && !event.price_charged_via_app) {
        Alert.alert(
          "Thanks for registering!",
          "Please complete your payment via WhatsApp or bank transfer. Our team will be in touch shortly to confirm your spot.",
          [{ text: "OK", style: "default" }]
        );
        return;
      }
      if (!shouldBeWaitlist)
        supabase.functions.invoke("send-event-confirmation", { body: { eventId: id, userId: user.id } }).catch(() => {});
      Alert.alert(
        shouldBeWaitlist ? "Added to Waitlist" : "Registration Successful",
        shouldBeWaitlist ? "You've been added to the waitlist." : "You are now registered for this event"
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to register");
    } finally {
      setRegistering(false);
    }
  };

  const handleDeregister = async () => {
    if (!event) return;
    const isPaidViaApp = event.status.includes("Cost Bearing Event") && event.price_charged_via_app;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (isPaidViaApp) {
        const { error } = await supabase.from("event_registrations")
          .update({ refund_requested: true, refund_requested_at: new Date().toISOString() })
          .eq("event_id", id).eq("user_id", user.id);
        if (error) throw error;
        Alert.alert("Cancellation Requested", "Refund will be processed after admin approval");
      } else {
        const { error } = await (supabase.from("event_registrations") as any)
          .update({ refund_processed: true, cancelled_by: user.id, cancelled_at: new Date().toISOString() })
          .eq("event_id", id).eq("user_id", user.id);
        if (error) throw error;
        setIsRegistered(false);
        setIsWaitingList(false);
        await fetchRegistrationCount();
        Alert.alert("Cancelled", "You have been removed from this event");
      }
      await fetchRegistration();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to cancel");
    }
  };

  const handleSavePlusOne = async () => {
    if (!plusOneName.trim() || !plusOneEmail.trim()) {
      Alert.alert("Error", "Please enter both name and email"); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plusOneEmail.trim())) {
      Alert.alert("Error", "Please enter a valid email address"); return;
    }
    setSavingPlusOne(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Get user's registration for this event
      const { data: userReg } = await (supabase.from("event_registrations") as any)
        .select("id")
        .eq("event_id", id)
        .eq("user_id", user.id)
        .eq("refund_processed", false)
        .maybeSingle();
      
      if (!userReg?.id) {
        Alert.alert("Error", "You must be registered for this event first");
        return;
      }
      
      const { error } = await (supabase.from("event_plus_one_guests") as any).insert({
        registration_id: userReg.id, event_id: id, user_id: user.id,
        guest_name: plusOneName.trim(), guest_email: plusOneEmail.trim(),
      });
      if (error) throw error;
      setPlusOneGuest({ name: plusOneName.trim(), email: plusOneEmail.trim() });
      setShowPlusOneForm(false); setPlusOneName(""); setPlusOneEmail("");
      Alert.alert("Success", "+1 guest added");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save +1 guest");
    } finally {
      setSavingPlusOne(false);
    }
  };

  const handleRemovePlusOne = async () => {
    if (!registration?.id) return;
    setSavingPlusOne(true);
    try {
      const { error } = await (supabase.from("event_plus_one_guests") as any)
        .delete().eq("registration_id", registration.id);
      if (error) throw error;
      setPlusOneGuest(null); setShowPlusOneForm(false);
      Alert.alert("Success", "+1 guest removed");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to remove +1 guest");
    } finally {
      setSavingPlusOne(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Refresh registration status after successful payment
    await fetchRegistration();
    await fetchRegistrationCount();
    setIsRegistered(true);
    setIsWaitingList(false);
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      const dateStr = buildDateDisplay();
      const locationStr = `${event.location}, ${event.city}, ${event.country}`;
      const descriptionText = stripHtml(event.description);
      const message = `Check out this event: ${event.title}\n\nDate: ${dateStr}\nLocation: ${locationStr}\n\n${descriptionText.substring(0, 200)}${descriptionText.length > 200 ? '...' : ''}`;
      
      await Share.share({
        title: event.title,
        message: message,
      });
    } catch (error: any) {
      __DEV__ && console.log('Share error:', error);
    }
  };

  // ─── Display helpers ──────────────────────────────────────────────────────
  const buildDateDisplay = () => {
    if (!event) return "";
    const s = new Date(event.start_date);
    const e2 = event.end_date ? new Date(event.end_date) : null;
    const isMulti =
      e2 &&
      (s.getUTCFullYear() !== e2.getUTCFullYear() ||
        s.getUTCMonth() !== e2.getUTCMonth() ||
        s.getUTCDate() !== e2.getUTCDate());
    const isSameMo =
      e2 &&
      s.getUTCFullYear() === e2.getUTCFullYear() &&
      s.getUTCMonth() === e2.getUTCMonth();
    if (isMulti && e2)
      return isSameMo
        ? `${s.getUTCDate()}-${fmtUTC(event.end_date!, "date")}`
        : `${fmtUTC(event.start_date, "short")} - ${fmtUTC(event.end_date!, "date")}`;
    return `${fmtUTC(event.start_date, "dt")}${event.end_date ? ` - ${fmtUTC(event.end_date, "time")}` : ""}`;
  };

  const capDisplay = () => {
    if (!event) return { text: "", red: false };
    const fb = event.status.includes("Fully Booked");
    const rc = event.status.includes("Registration Closed");
    const atCap = (event.capacity && registrationCount >= event.capacity) || rc || fb;
    if (fb && event.capacity) return { text: `${event.capacity}/${event.capacity}`, red: true };
    if (event.capacity) return { text: `${registrationCount}/${event.capacity}`, red: !!atCap };
    return { text: `${registrationCount} registered`, red: false };
  };

  const statusDisplay = () => {
    if (!event) return "";
    if (event.is_restricted && event.rsvp_date && new Date() > new Date(event.rsvp_date))
      return "RSVP date passed";
    if (!Array.isArray(event.status)) return event.status;
    return (
      event.status
        .filter(s => !["Registration Closed", "Open to Registration", "Fully Booked", "Waitlist"].includes(s))
        .join(", ") || "Active"
    );
  };

  // ─── Loading / not found ──────────────────────────────────────────────────
  if (loading) {
    return (
      <MobileLayout>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </MobileLayout>
    );
  }

  if (!event) {
    return (
      <MobileLayout>
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={{ color: Colors.mutedForeground }}>Event not found</Text>
        </View>
      </MobileLayout>
    );
  }

  const cap = capDisplay();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <MobileLayout>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#f9fafb" }}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Hero image or plain back button */}
        {event.image_url ? (
          <View>
            <Image
              source={{ uri: event.image_url }}
              style={{ width: "100%", aspectRatio: 16 / 9 }}
              contentFit="cover"
            />
            {/* Gradient overlay for smooth fade transition */}
            <LinearGradient
              colors={['transparent', 'rgba(249,250,251,0.1)', 'rgba(249,250,251,0.3)', 'rgba(249,250,251,0.6)', '#f9fafb']}
              locations={[0, 0.25, 0.5, 0.75, 1]}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 160,
              }}
            />
            <View style={{ position: "absolute", top: 16, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
              <Pressable
                onPress={() => router.replace("/(tabs)/events" as any)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <ArrowLeft size={14} color="white" />
                <Text style={{ fontSize: 12, color: "white", fontWeight: "500" }}>Back to Events</Text>
              </Pressable>
              {isAdmin && (
                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => ({
                    backgroundColor: "rgba(0,0,0,0.5)",
                    borderRadius: 8,
                    padding: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Share2 size={16} color="white" />
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={{ padding: 16, paddingBottom: 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pressable
                onPress={() => router.replace("/(tabs)/events" as any)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  opacity: pressed ? 0.6 : 1,
                  alignSelf: "flex-start",
                })}
              >
                <ArrowLeft size={16} color={Colors.foreground} />
                <Text style={{ fontSize: 13, color: Colors.foreground }}>Back to Events</Text>
              </Pressable>
              {isAdmin && (
                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => ({
                    padding: 8,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Share2 size={18} color={Colors.foreground} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Summary — grey background */}
        <View style={{ backgroundColor: "#f9fafb", padding: 24, paddingBottom: 16 }}>
          <Text
            style={{ fontSize: 28, fontWeight: "700", color: "#00451a", lineHeight: 34, marginBottom: 20 }}
          >
            {event.title}
          </Text>

          <View style={{ gap: 12 }}>
            {/* Host */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#324750", marginBottom: 2 }}>HOST</Text>
              <Text style={{ fontSize: 12, color: "#000" }}>{event.host}</Text>
            </View>

            {/* Location */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#324750", marginBottom: 2 }}>LOCATION</Text>
              <Text style={{ fontSize: 12, color: "#000" }}>
                {[event.location, event.city && event.country ? `${event.city}, ${event.country}` : null]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            </View>

            {/* Date + RSVP/Capacity */}
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#324750", marginBottom: 2 }}>DATE</Text>
                <Text style={{ fontSize: 12, color: "#000" }}>{buildDateDisplay()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                {event.is_restricted && event.rsvp_date ? (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#324750", marginBottom: 2 }}>RSVP</Text>
                    <Text style={{ fontSize: 12, color: "#000" }}>{fmtUTC(event.rsvp_date, "date")}</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#324750", marginBottom: 2 }}>CAPACITY</Text>
                    <Text style={{ fontSize: 12, color: cap.red ? "#dc2626" : "#000" }}>{cap.text}</Text>
                  </>
                )}
              </View>
            </View>

            {/* Dress code + Status */}
            <View style={{ flexDirection: "row", gap: 24 }}>
              {event.dress_code && (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#324750", marginBottom: 2 }}>DRESS CODE</Text>
                  <Text style={{ fontSize: 12, color: "#000" }}>{event.dress_code}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#324750", marginBottom: 2 }}>STATUS</Text>
                <Text style={{ fontSize: 12, color: "#000" }}>{statusDisplay()}</Text>
              </View>
            </View>

            {/* Price */}
            {event.status.includes("Cost Bearing Event") &&
              event.price_charged_via_app &&
              event.price &&
              event.price > 0 && (
                <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#324750", marginBottom: 4 }}>PRICE</Text>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: "#00451a" }}>
                    {event.currency === "USD" ? "$" : "₺"}
                    {event.price.toFixed(2)} {event.currency}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    Payment required to confirm registration
                  </Text>
                </View>
              )}
          </View>
        </View>

        {/* Registration section — off-white background */}
        <View style={{ backgroundColor: "#f9fafb", paddingHorizontal: 24, paddingVertical: 20 }}>
          {/* Attendance confirmed badge */}
          {currentUserId && isRegistered && !isWaitingList && hasVerifiedAttendance && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.primary }}>
                Attendance Confirmed
              </Text>
              <Check size={16} color={Colors.primary} />
            </View>
          )}

          
          <EventRegButton
            event={event}
            isRegistered={isRegistered}
            isWaitingList={isWaitingList}
            hasVerifiedAttendance={hasVerifiedAttendance}
            registering={registering}
            registration={registration}
            plusOneGuest={plusOneGuest}
            plusOneName={plusOneName}
            plusOneEmail={plusOneEmail}
            showPlusOneForm={showPlusOneForm}
            savingPlusOne={savingPlusOne}
            onRegister={handleRegister}
            onCancelPress={() => {
              Alert.alert(
                isWaitingList ? "Leave Waitlist?" : "Are you sure you want to cancel?",
                isWaitingList
                  ? "Are you sure you want to leave the waitlist for this event?"
                  : "Your seat will be transferred to another member.",
                [
                  { text: "Keep my registration", style: "cancel", onPress: () => {} },
                  { 
                    text: isWaitingList ? "Leave Waitlist" : "Cancel my registration", 
                    style: "destructive",
                    onPress: handleDeregister 
                  }
                ]
              );
            }}
            onSavePlusOne={handleSavePlusOne}
            onRemovePlusOne={handleRemovePlusOne}
            onShowPlusOneForm={setShowPlusOneForm}
            onPlusOneNameChange={setPlusOneName}
            onPlusOneEmailChange={setPlusOneEmail}
          />
        </View>

        {/* Event description */}
        {event.description && (
          <EventDescription description={event.description} />
        )}
      </ScrollView>

      {/* QNB Payment Modal for Cost-Bearing Events */}
      {event && event.price && event.currency && (
        <QNBPaymentModal
          open={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          eventId={event.id}
          eventTitle={event.title}
          amount={event.price}
          currency={event.currency}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

          </MobileLayout>
  );
}

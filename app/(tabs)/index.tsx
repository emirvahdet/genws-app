import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { isSameDay } from "date-fns";
import { Users, QrCode, Send, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { MobileLayout } from "../../components/layout/MobileLayout";
import { AttendanceBarcodeModal } from "../../components/dashboard/AttendanceBarcodeModal";
import NetworkingModal from "../../components/dashboard/NetworkingModal";
import { useDashboard } from "../../hooks/useDashboard";
import { Colors } from "../../constants/Colors";

const ITEMS_PER_PAGE = 5;

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function DashboardScreen() {
  const router = useRouter();
  const {
    userName, updates, events, registrations,
    loading, refreshing, liveNetworkingEvents, currentUserId,
    fetchAll, onRefresh, submitFeedback,
  } = useDashboard();

  const [selectedUpdate, setSelectedUpdate] = useState<typeof updates[0] | null>(null);
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showNetworkingModal, setShowNetworkingModal] = useState(false);
  const [selectedNetworkingEventId, setSelectedNetworkingEventId] = useState<string | null>(null);
  const [showAttendanceQR, setShowAttendanceQR] = useState(false);
  const [selectedAttendanceEventId, setSelectedAttendanceEventId] = useState<string | null>(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSubmitFeedback = async () => {
    setSubmitting(true);
    const ok = await submitFeedback(message);
    if (ok) setMessage("");
    setSubmitting(false);
  };

  // Calendar helpers
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => {
    const d = new Date(y, m, 1).getDay();
    return d === 0 ? 6 : d - 1;
  };
  const eventDatesSet = new Set(events.map((e) => new Date(e.start_date).toDateString()));
  const registeredDatesSet = new Set(
    events.filter((e) => registrations.has(e.id)).map((e) => new Date(e.start_date).toDateString())
  );

  const handleDatePress = (date: Date) => {
    setSelectedDate(date);
    const eventsOnDate = events.filter((e) => isSameDay(new Date(e.start_date), date));
    if (eventsOnDate.length === 1) router.push(`/event/${eventsOnDate[0].id}` as any);
  };

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear((y) => y - 1); }
    else setCalendarMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear((y) => y + 1); }
    else setCalendarMonth((m) => m + 1);
  };

  const displayedUpdates = showAllUpdates
    ? updates.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    : updates.slice(0, 3);
  const totalPages = Math.ceil(updates.length / ITEMS_PER_PAGE);

  if (loading) {
    return (
      <MobileLayout>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </MobileLayout>
    );
  }

  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
  const firstDay = getFirstDay(calendarYear, calendarMonth);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const calRows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) calRows.push(cells.slice(i, i + 7));

  return (
    <MobileLayout>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Header */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 28, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>
            {getGreeting()}, {userName.split(" ")[0]}
          </Text>
          <Text style={{ color: Colors.mutedForeground, fontSize: 15 }}>
            Welcome back to The Society
          </Text>
        </View>

        {/* Live Now */}
        {liveNetworkingEvents.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.foreground, marginBottom: 16 }}>
              Live Now
            </Text>
            <View style={{ gap: 12 }}>
              {liveNetworkingEvents.map(({ event, hasVerifiedAttendance }) => (
                <View key={event.id}>
                  {!hasVerifiedAttendance ? (
                    <View style={{ backgroundColor: "white", borderWidth: 1, borderColor: Colors.primary + "33", borderRadius: 12, padding: 16, alignItems: "center", gap: 12 }}>
                      <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center" }}>
                        Please verify your attendance to connect with members.
                      </Text>
                      <Pressable
                        onPress={() => { setSelectedAttendanceEventId(event.id); setShowAttendanceQR(true); }}
                        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", borderWidth: 2, borderColor: Colors.primary, borderRadius: 12, paddingVertical: 12, opacity: pressed ? 0.75 : 1 })}
                      >
                        <QrCode size={16} color={Colors.primary} />
                        <Text style={{ color: Colors.primary, fontWeight: "600" }}>Show Attendance QR</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => { setSelectedNetworkingEventId(event.id); setShowNetworkingModal(true); }}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.copper, borderRadius: 12, paddingVertical: 16, opacity: pressed ? 0.85 : 1 })}
                    >
                      <Users size={16} color={Colors.secondary} />
                      <Text style={{ color: Colors.secondary, fontWeight: "600", fontSize: 16 }}>Connect with a member</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Updates */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.foreground }}>
              {showAllUpdates ? "All Updates" : "Updates"}
            </Text>
            {showAllUpdates && (
              <Pressable onPress={() => { setShowAllUpdates(false); setCurrentPage(1); }}>
                <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>Back</Text>
              </Pressable>
            )}
          </View>

          {displayedUpdates.length === 0 ? (
            <View style={{ backgroundColor: "white", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>No updates available</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {displayedUpdates.map((update) => (
                <Pressable
                  key={update.id}
                  onPress={() => setSelectedUpdate(update)}
                  style={({ pressed }) => ({ backgroundColor: "#f1f5f2", borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, padding: 12, opacity: pressed ? 0.8 : 1 })}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Text style={{ fontWeight: "600", color: Colors.foreground, fontSize: 14, flex: 1 }} numberOfLines={1}>
                          {update.title}
                        </Text>
                        {update.type === "news" && (
                          <View style={{ backgroundColor: "rgba(254, 215, 170, 0.3)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, color: "#d97706", fontWeight: "500" }}>News</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 14, color: "#324750" }} numberOfLines={1}>
                        {stripHtml(update.content)}
                      </Text>
                      {update.external_url && (
                        <Pressable onPress={(e) => { Linking.openURL(update.external_url!); }} style={{ marginTop: 4 }}>
                          <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "500" }}>Read more →</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Pressable>
              ))}

              {showAllUpdates && totalPages > 1 && (
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 16 }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Pressable
                      key={page}
                      onPress={() => setCurrentPage(page)}
                      style={{ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: currentPage === page ? Colors.primary : "transparent", borderWidth: 1, borderColor: currentPage === page ? Colors.primary : Colors.border }}
                    >
                      <Text style={{ fontSize: 14, color: currentPage === page ? "white" : Colors.foreground }}>{page}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {!showAllUpdates && updates.length > 3 && (
                <View style={{ alignItems: "flex-end", marginTop: 8 }}>
                  <Pressable onPress={() => setShowAllUpdates(true)}>
                    <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>All Updates</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Calendar */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.foreground, marginBottom: 16 }}>Calendar</Text>
          <View style={{ backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12 }}>
            {/* Month nav */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Pressable onPress={prevMonth} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}>
                <ChevronLeft size={20} color={Colors.foreground} />
              </Pressable>
              <Text style={{ fontWeight: "600", color: Colors.foreground, fontSize: 16 }}>
                {MONTH_NAMES[calendarMonth]} {calendarYear}
              </Text>
              <Pressable onPress={nextMonth} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}>
                <ChevronRight size={20} color={Colors.foreground} />
              </Pressable>
            </View>

            {/* Day labels */}
            <View style={{ flexDirection: "row", marginBottom: 4 }}>
              {DAY_LABELS.map((d) => (
                <View key={d} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground, fontWeight: "500" }}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Days */}
            {calRows.map((row, ri) => (
              <View key={ri} style={{ flexDirection: "row" }}>
                {row.map((day, ci) => {
                  if (!day) return <View key={ci} style={{ flex: 1, aspectRatio: 1 }} />;
                  const date = new Date(calendarYear, calendarMonth, day);
                  const ds = date.toDateString();
                  const isEvent = eventDatesSet.has(ds);
                  const isRegistered = registeredDatesSet.has(ds);
                  const isSelected = isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, new Date());
                  return (
                    <View key={ci} style={{ flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
                      {isEvent ? (
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}>
                          <Pressable onPress={() => handleDatePress(date)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                            <Text style={{ fontSize: 14, fontWeight: isToday ? "700" : "400", color: Colors.primaryForeground }}>
                              {day}
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => handleDatePress(date)}
                          style={({ pressed }) => ({
                            flex: 1, width: "100%", alignItems: "center", justifyContent: "center",
                            borderRadius: 999,
                            backgroundColor: isSelected ? Colors.muted : "transparent",
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Text style={{ fontSize: 14, fontWeight: isToday ? "700" : "400", color: isToday ? Colors.primary : Colors.foreground }}>
                            {day}
                          </Text>
                          {isRegistered && !isEvent && (
                            <View style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.copper, borderWidth: 1, borderColor: Colors.background }} />
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Legend */}
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.copper }} />
                <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>Events I Registered</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Feedback Form */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontSize: 20, fontWeight: "600", color: Colors.foreground, marginBottom: 16 }}>
              Let us know what you think of The Society
            </Text>
            <TextInput
              style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, color: Colors.foreground, fontSize: 15, minHeight: 120, textAlignVertical: "top", marginBottom: 4 }}
              placeholder="Share your thoughts, suggestions, or requests..."
              placeholderTextColor={Colors.mutedForeground}
              value={message}
              onChangeText={(t) => setMessage(t.slice(0, 300))}
              multiline
              maxLength={300}
            />
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "right", marginBottom: 16 }}>
              {message.length}/300 characters
            </Text>
            <Pressable
              onPress={handleSubmitFeedback}
              disabled={submitting || !message.trim()}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, opacity: pressed || submitting || !message.trim() ? 0.6 : 1 })}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Send size={16} color="white" />
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Submit</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Update Detail Modal */}
      <Modal visible={!!selectedUpdate} transparent animationType="slide" onRequestClose={() => setSelectedUpdate(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", paddingTop: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 24, marginBottom: 16, gap: 12 }}>
              <Text style={{ flex: 1, fontSize: 18, fontWeight: "600", color: Colors.foreground }}>
                {selectedUpdate?.title}
              </Text>
              <Pressable onPress={() => setSelectedUpdate(null)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <X size={22} color={Colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 14, color: Colors.foreground, lineHeight: 22, marginBottom: 16 }}>
                {stripHtml(selectedUpdate?.content || "")}
              </Text>
              {selectedUpdate?.external_url && (
                <Pressable onPress={() => Linking.openURL(selectedUpdate.external_url!)} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: Colors.primary }}>Read more →</Text>
                </Pressable>
              )}
              <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16, marginBottom: 32 }}>
                <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>
                  {selectedUpdate ? new Date(selectedUpdate.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Attendance QR Modal */}
      {selectedAttendanceEventId && currentUserId && (
        <AttendanceBarcodeModal
          open={showAttendanceQR}
          onOpenChange={(open) => {
            setShowAttendanceQR(open);
            if (!open) {
              setSelectedAttendanceEventId(null);
              fetchAll();
            }
          }}
          eventId={selectedAttendanceEventId}
          userId={currentUserId}
          userName={userName}
        />
      )}

      {/* Networking Modal */}
      {selectedNetworkingEventId && currentUserId && (
        <NetworkingModal
          open={showNetworkingModal}
          onOpenChange={(open) => {
            setShowNetworkingModal(open);
            if (!open) setSelectedNetworkingEventId(null);
          }}
          eventId={selectedNetworkingEventId}
          userId={currentUserId}
        />
      )}
    </MobileLayout>
  );
}

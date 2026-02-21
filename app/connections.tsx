import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Search, MapPin, MoreVertical, UserMinus } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { Colors } from "../constants/Colors";

interface NetworkConnection {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  company: string | null;
  generationNumber: number | null;
}

const getInitials = (name: string) => {
  const parts = name.split(" ").filter((n) => n.length > 0);
  if (parts.length >= 3) return (parts[0][0] + parts[1][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts.map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

const getOrdinalSuffix = (n: number) => {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
};

export default function ConnectionsScreen() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [filteredConnections, setFilteredConnections] = useState<NetworkConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuConnection, setMenuConnection] = useState<NetworkConnection | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<NetworkConnection | null>(null);

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      } else {
        router.replace("/(auth)/login");
      }
    };
    initUser();
  }, []);

  const fetchConnections = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { data: connectionData, error: connectionError } = await supabase
        .from("network_connections")
        .select("user1_id, user2_id")
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

      if (connectionError) throw connectionError;
      if (!connectionData || connectionData.length === 0) {
        setConnections([]);
        setFilteredConnections([]);
        return;
      }

      const connectedUserIds = [
        ...new Set(
          connectionData.map((c) => (c.user1_id === currentUserId ? c.user2_id : c.user1_id))
        ),
      ];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, city, country, company, generation_number")
        .in("id", connectedUserIds);

      if (profilesError) throw profilesError;

      const networkConnections: NetworkConnection[] = (profiles || []).map((p) => ({
        userId: p.id!,
        fullName: p.full_name || "Unknown",
        avatarUrl: p.avatar_url,
        city: p.city,
        country: p.country,
        company: p.company,
        generationNumber: p.generation_number,
      }));

      networkConnections.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setConnections(networkConnections);
      setFilteredConnections(networkConnections);
    } catch (e) {
      __DEV__ && console.log("Error fetching connections:", e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) fetchConnections();
  }, [currentUserId, fetchConnections]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredConnections(connections);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredConnections(
        connections.filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.company?.toLowerCase().includes(q) ||
            c.city?.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, connections]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConnections();
    setRefreshing(false);
  };

  const handleRemoveConnection = async (connection: NetworkConnection) => {
    if (!currentUserId) return;
    try {
      const { error } = await supabase
        .from("network_connections")
        .delete()
        .or(
          `and(user1_id.eq.${currentUserId},user2_id.eq.${connection.userId}),and(user1_id.eq.${connection.userId},user2_id.eq.${currentUserId})`
        );
      if (error) throw error;
      setConnections((prev) => prev.filter((c) => c.userId !== connection.userId));
      Alert.alert("Removed", `${connection.fullName} has been removed from your circle.`);
    } catch (e) {
      __DEV__ && console.log("Error removing connection:", e);
      Alert.alert("Error", "Failed to remove from circle");
    } finally {
      setConfirmRemove(null);
    }
  };

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
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          backgroundColor: Colors.background + "F2",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
        >
          <ArrowLeft size={22} color={Colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: "700", color: Colors.foreground }}>Your Circle</Text>
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          connections.length > 0 ? (
            <View style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
                <Search size={16} color={Colors.mutedForeground} />
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: Colors.foreground }}
                  placeholder="Search by name, company, or city..."
                  placeholderTextColor={Colors.mutedForeground}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>
          ) : null
        }
        data={filteredConnections}
        keyExtractor={(item) => item.userId}
        ListEmptyComponent={
          <View style={{ paddingTop: 48, alignItems: "center" }}>
            {connections.length === 0 ? (
              <Text style={{ color: Colors.mutedForeground }}>No member is in your circle yet.</Text>
            ) : (
              <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>
                No members found matching "{searchQuery}"
              </Text>
            )}
          </View>
        }
        renderItem={({ item: connection }) => (
          <Pressable
            onPress={() => router.push(`/member/${connection.userId}` as any)}
            style={({ pressed }) => ({
              backgroundColor: "white",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: Colors.border,
              flexDirection: "row",
              alignItems: "stretch",
              gap: 16,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {/* Avatar */}
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: Colors.border + "4D",
                  backgroundColor: Colors.primary + "1A",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: "600", color: Colors.primary }}>
                  {getInitials(connection.fullName)}
                </Text>
              </View>
            </View>

            {/* Info */}
            <View style={{ flex: 1, minWidth: 0, paddingVertical: 4 }}>
              <Text style={{ fontSize: 17, fontWeight: "600", color: Colors.foreground }} numberOfLines={1}>
                {connection.fullName}
              </Text>
              {connection.company && (
                <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 4 }} numberOfLines={1}>
                  {connection.company}
                </Text>
              )}
              {connection.generationNumber != null && (
                <View
                  style={{
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: Colors.primary + "4D",
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    backgroundColor: Colors.primary + "0D",
                    alignSelf: "flex-start",
                  }}
                >
                  <Text style={{ fontSize: 11, color: Colors.primary }}>
                    {getOrdinalSuffix(connection.generationNumber)} Gen
                  </Text>
                </View>
              )}
              {(connection.city || connection.country) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                  <MapPin size={12} color={Colors.mutedForeground} />
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground }} numberOfLines={1}>
                    {[connection.city, connection.country].filter(Boolean).join(", ")}
                  </Text>
                </View>
              )}
            </View>

            {/* Menu */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setMenuConnection(connection);
              }}
              style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1, alignSelf: "flex-start" })}
              hitSlop={8}
            >
              <MoreVertical size={18} color={Colors.mutedForeground} />
            </Pressable>
          </Pressable>
        )}
      />

      {/* Action Sheet Modal */}
      <Modal
        visible={!!menuConnection}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuConnection(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setMenuConnection(null)}
        >
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, textAlign: "center", marginBottom: 16 }}>
              {menuConnection?.fullName}
            </Text>
            <Pressable
              onPress={() => {
                const c = menuConnection!;
                setMenuConnection(null);
                setConfirmRemove(c);
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 12,
                backgroundColor: pressed ? "#fff0f0" : "transparent",
              })}
            >
              <UserMinus size={18} color={Colors.destructive} />
              <Text style={{ fontSize: 15, color: Colors.destructive, fontWeight: "500" }}>Remove from Circle</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Confirm Remove Modal */}
      <Modal
        visible={!!confirmRemove}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmRemove(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 24, width: "100%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 8 }}>
              Remove from Circle
            </Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20, marginBottom: 24 }}>
              Are you sure you want to remove {confirmRemove?.fullName} from your circle? You will need to scan their QR code again to reconnect.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setConfirmRemove(null)}
                style={({ pressed }) => ({
                  flex: 1,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontWeight: "600", color: Colors.foreground }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmRemove && handleRemoveConnection(confirmRemove)}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: Colors.destructive,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontWeight: "600", color: "white" }}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

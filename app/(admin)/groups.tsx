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
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Users, Eye, Edit, Trash2, Plus, Search, Check, X } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface Member { id: string; full_name: string; email: string; }
interface Group { id: string; name: string; created_at: string; member_count: number; }
interface GroupMember { user_id: string; full_name: string; email: string; }

export default function AdminGroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchGroups(); fetchMembers(); }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("admin_groups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const withCounts = await Promise.all(
        (data || []).map(async (group: any) => {
          const { count } = await supabase.from("admin_group_members").select("*", { count: "exact", head: true }).eq("group_id", group.id);
          return { ...group, member_count: count || 0 };
        })
      );
      setGroups(withCounts);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to fetch groups");
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      setMembers(data || []);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to fetch members");
    }
  };

  const handleCreateGroup = () => {
    setIsEditing(false);
    setCurrentGroup(null);
    setGroupName("");
    setSelectedMembers(new Set());
    setSearchQuery("");
    setShowFormModal(true);
  };

  const handleEditGroup = async (group: Group) => {
    setIsEditing(true);
    setCurrentGroup(group);
    setGroupName(group.name);
    setSearchQuery("");
    try {
      const { data, error } = await supabase.from("admin_group_members").select("user_id").eq("group_id", group.id);
      if (error) throw error;
      setSelectedMembers(new Set((data || []).map((m: any) => m.user_id)));
      setShowFormModal(true);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load group members");
    }
  };

  const handleViewGroup = async (group: Group) => {
    setCurrentGroup(group);
    try {
      const { data, error } = await supabase
        .from("admin_group_members")
        .select("user_id, profiles!inner(full_name, email)")
        .eq("group_id", group.id);
      if (error) throw error;
      setGroupMembers((data || []).map((item: any) => ({ user_id: item.user_id, full_name: item.profiles.full_name, email: item.profiles.email })));
      setShowViewModal(true);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load group members");
    }
  };

  const handleDeleteGroup = (group: Group) => {
    Alert.alert("Delete Group", `Are you sure you want to delete "${group.name}"? This action cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("admin_groups").delete().eq("id", group.id);
            if (error) throw error;
            Alert.alert("Success", "Group deleted successfully");
            fetchGroups();
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!groupName.trim()) { Alert.alert("Error", "Please enter a group name"); return; }
    if (selectedMembers.size === 0) { Alert.alert("Error", "Please select at least one member"); return; }
    setSubmitting(true);
    try {
      if (isEditing && currentGroup) {
        const { error: updateError } = await supabase.from("admin_groups").update({ name: groupName }).eq("id", currentGroup.id);
        if (updateError) throw updateError;
        const { error: deleteError } = await supabase.from("admin_group_members").delete().eq("group_id", currentGroup.id);
        if (deleteError) throw deleteError;
        const { error: insertError } = await supabase.from("admin_group_members").insert(
          Array.from(selectedMembers).map((uid) => ({ group_id: currentGroup.id, user_id: uid }))
        );
        if (insertError) throw insertError;
        Alert.alert("Success", "Group updated successfully");
      } else {
        const { data: newGroup, error: groupError } = await supabase.from("admin_groups").insert({ name: groupName }).select().single();
        if (groupError) throw groupError;
        const { error: insertError } = await supabase.from("admin_group_members").insert(
          Array.from(selectedMembers).map((uid) => ({ group_id: newGroup.id, user_id: uid }))
        );
        if (insertError) throw insertError;
        Alert.alert("Success", "Group created successfully");
      }
      setShowFormModal(false);
      fetchGroups();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save group");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const filteredMembers = members.filter(
    (m) => m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || m.email.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
              <ArrowLeft size={22} color={Colors.foreground} />
            </Pressable>
            <View>
              <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Admin Groups</Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Create and manage member groups</Text>
            </View>
          </View>
          <Pressable
            onPress={handleCreateGroup}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, opacity: pressed ? 0.85 : 1 })}
          >
            <Users size={14} color="white" />
            <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>Create</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ paddingVertical: 48 }} />
        ) : groups.length === 0 ? (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 32, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <Users size={48} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>No groups yet</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 16, textAlign: "center" }}>Create your first group to start organizing members</Text>
            <Pressable onPress={handleCreateGroup} style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ color: "white", fontWeight: "600" }}>Create Group</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {groups.map((group) => (
              <View key={group.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>{group.name}</Text>
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>{group.member_count} {group.member_count === 1 ? "member" : "members"}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => handleViewGroup(group)} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                    <Eye size={16} color={Colors.foreground} />
                  </Pressable>
                  <Pressable onPress={() => handleEditGroup(group)} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                    <Edit size={16} color={Colors.foreground} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteGroup(group)} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 8, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                    <Trash2 size={16} color="white" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showFormModal} transparent animationType="slide" onRequestClose={() => setShowFormModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 16 }}>{isEditing ? "Edit Group" : "Create Group"}</Text>

            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Group Name *</Text>
              <TextInput
                style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.foreground }}
                value={groupName} onChangeText={setGroupName} placeholder="Enter group name" placeholderTextColor={Colors.mutedForeground}
              />
            </View>

            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Select Members *</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, marginBottom: 8 }}>
              <Search size={14} color={Colors.mutedForeground} />
              <TextInput
                style={{ flex: 1, paddingVertical: 8, paddingLeft: 8, fontSize: 13, color: Colors.foreground }}
                placeholder="Search members..." placeholderTextColor={Colors.mutedForeground}
                value={searchQuery} onChangeText={setSearchQuery}
              />
            </View>

            <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, maxHeight: 240, marginBottom: 8 }}>
              <FlatList
                data={filteredMembers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable onPress={() => toggleMember(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "33" }}>
                    <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: selectedMembers.has(item.id) ? Colors.primary : Colors.border, backgroundColor: selectedMembers.has(item.id) ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                      {selectedMembers.has(item.id) && <Check size={14} color="white" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.foreground }}>{item.full_name}</Text>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{item.email}</Text>
                    </View>
                  </Pressable>
                )}
              />
            </View>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 16 }}>{selectedMembers.size} {selectedMembers.size === 1 ? "member" : "members"} selected</Text>

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed || submitting ? 0.7 : 1, marginBottom: 8 })}
            >
              {submitting ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: "white", fontWeight: "600" }}>{isEditing ? "Update Group" : "Create Group"}</Text>}
            </Pressable>
            <Pressable onPress={() => setShowFormModal(false)} style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ fontWeight: "500", color: Colors.foreground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* View Members Modal */}
      <Modal visible={showViewModal} transparent animationType="slide" onRequestClose={() => setShowViewModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "70%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground }}>{currentGroup?.name}</Text>
              <Pressable onPress={() => setShowViewModal(false)}><X size={20} color={Colors.mutedForeground} /></Pressable>
            </View>
            {groupMembers.length === 0 ? (
              <Text style={{ textAlign: "center", color: Colors.mutedForeground, paddingVertical: 32 }}>No members in this group</Text>
            ) : (
              <FlatList
                data={groupMembers}
                keyExtractor={(item) => item.user_id}
                renderItem={({ item }) => (
                  <View style={{ padding: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.foreground }}>{item.full_name}</Text>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{item.email}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

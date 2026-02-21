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
  FlatList,
} from "react-native";
import { Users, Plus, Trash2, Edit, Check, Search, Crown } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface Profile { id: string; full_name: string; email: string; }

interface FamilyMembership {
  id: string;
  family_number: number;
  primary_member_id: string;
  member_count: number;
  is_active: boolean;
  created_at: string;
  primary_member?: Profile;
  family_members?: Profile[];
}

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
};

export function FamilyMemberships() {
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState<FamilyMembership[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<FamilyMembership | null>(null);
  const [saving, setSaving] = useState(false);

  const [memberCount, setMemberCount] = useState<2 | 3>(2);
  const [primaryMemberId, setPrimaryMemberId] = useState("");
  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState<string[]>([]);
  const [primarySearch, setPrimarySearch] = useState("");
  const [familyMemberSearch, setFamilyMemberSearch] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      setAllProfiles(profiles || []);

      const { data: familiesData } = await supabase.from("family_memberships").select("*").order("family_number");

      const enriched = await Promise.all(
        (familiesData || []).map(async (family: any) => {
          const { data: members } = await supabase.from("family_membership_members").select("member_id").eq("family_membership_id", family.id);
          const memberIds = members?.map((m: any) => m.member_id) || [];
          const familyMembers = profiles?.filter((p: any) => memberIds.includes(p.id)) || [];
          const primaryMember = profiles?.find((p: any) => p.id === family.primary_member_id);
          return { ...family, primary_member: primaryMember, family_members: familyMembers };
        })
      );
      setFamilies(enriched);
    } catch (e) {
      Alert.alert("Error", "Failed to load family memberships");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (family: FamilyMembership) => {
    try {
      const { error } = await supabase.from("family_memberships").update({ is_active: !family.is_active }).eq("id", family.id);
      if (error) throw error;
      setFamilies((prev) => prev.map((f) => f.id === family.id ? { ...f, is_active: !f.is_active } : f));
      Alert.alert("Success", `Family #${family.family_number} is now ${!family.is_active ? "active" : "inactive"}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update status");
    }
  };

  const resetForm = () => {
    setMemberCount(2);
    setPrimaryMemberId("");
    setSelectedFamilyMembers([]);
    setPrimarySearch("");
    setFamilyMemberSearch("");
    setSelectedFamily(null);
    setIsEditing(false);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (family: FamilyMembership) => {
    setSelectedFamily(family);
    setIsEditing(true);
    setMemberCount(family.member_count as 2 | 3);
    setPrimaryMemberId(family.primary_member_id);
    setSelectedFamilyMembers(family.family_members?.map((m) => m.id) || []);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!primaryMemberId) { Alert.alert("Error", "Please select a primary member"); return; }
    const required = memberCount - 1;
    if (selectedFamilyMembers.length !== required) { Alert.alert("Error", `Please select exactly ${required} family member(s)`); return; }

    setSaving(true);
    try {
      if (isEditing && selectedFamily) {
        const { error: updateError } = await supabase.from("family_memberships").update({ primary_member_id: primaryMemberId, member_count: memberCount }).eq("id", selectedFamily.id);
        if (updateError) throw updateError;
        await supabase.from("family_membership_members").delete().eq("family_membership_id", selectedFamily.id);
        const { error: membersError } = await supabase.from("family_membership_members").insert(selectedFamilyMembers.map((mid) => ({ family_membership_id: selectedFamily.id, member_id: mid })));
        if (membersError) throw membersError;
        Alert.alert("Success", `Family #${selectedFamily.family_number} updated`);
      } else {
        const { data: nextNumber, error: seqError } = await supabase.rpc("get_next_family_number");
        if (seqError) throw seqError;
        const { data: newFamily, error: createError } = await supabase.from("family_memberships").insert({ family_number: nextNumber, primary_member_id: primaryMemberId, member_count: memberCount, is_active: true }).select().single();
        if (createError) throw createError;
        const { error: membersError } = await supabase.from("family_membership_members").insert(selectedFamilyMembers.map((mid) => ({ family_membership_id: newFamily.id, member_id: mid })));
        if (membersError) throw membersError;
        Alert.alert("Success", `Family #${nextNumber} created`);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save family");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (family: FamilyMembership) => {
    Alert.alert("Delete Family?", `Delete Family #${family.family_number}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("family_memberships").delete().eq("id", family.id);
            if (error) throw error;
            Alert.alert("Success", `Family #${family.family_number} deleted`);
            fetchData();
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };

  const toggleFamilyMember = (id: string) => {
    const required = memberCount - 1;
    setSelectedFamilyMembers((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= required) return prev;
      return [...prev, id];
    });
  };

  const filteredPrimary = allProfiles.filter((p) => p.full_name.toLowerCase().includes(primarySearch.toLowerCase()) || p.email.toLowerCase().includes(primarySearch.toLowerCase()));
  const availableFamilyMembers = allProfiles.filter((p) => {
    if (p.id === primaryMemberId) return false;
    if (!familyMemberSearch) return true;
    return p.full_name.toLowerCase().includes(familyMemberSearch.toLowerCase()) || p.email.toLowerCase().includes(familyMemberSearch.toLowerCase());
  });

  if (loading) return <ActivityIndicator size="small" color={Colors.primary} style={{ paddingVertical: 24 }} />;

  return (
    <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Users size={18} color={Colors.primary} />
          <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>Family Memberships</Text>
          <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{families.length}</Text>
          </View>
        </View>
        <Pressable onPress={openCreate} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, opacity: pressed ? 0.85 : 1 })}>
          <Plus size={12} color="white" /><Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>Add</Text>
        </Pressable>
      </View>

      {families.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Users size={32} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 8 }} />
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>No family memberships yet</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {families.map((family) => (
            <View key={family.id} style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>Family #{family.family_number}</Text>
                    <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, color: Colors.mutedForeground }}>{family.member_count}M</Text>
                    </View>
                    <View style={{ backgroundColor: family.is_active ? "#dcfce7" : "#f3f4f6", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, color: family.is_active ? "#16a34a" : "#6b7280" }}>{family.is_active ? "Active" : "Inactive"}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <Crown size={12} color={Colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: "500", color: Colors.foreground }}>{family.primary_member?.full_name || "Unknown"}</Text>
                  </View>
                  {family.family_members?.map((m) => (
                    <Text key={m.id} style={{ fontSize: 11, color: Colors.mutedForeground, paddingLeft: 16 }}>{m.full_name}</Text>
                  ))}
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 4 }}>Created {fmtDate(family.created_at)}</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Switch value={family.is_active} onValueChange={() => handleToggleActive(family)} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="white" style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} />
                  </View>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <Pressable onPress={() => openEdit(family)} style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}><Edit size={14} color={Colors.foreground} /></Pressable>
                    <Pressable onPress={() => handleDelete(family)} style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}><Trash2 size={14} color={Colors.destructive} /></Pressable>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { resetForm(); setShowModal(false); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>{isEditing ? `Edit Family #${selectedFamily?.family_number}` : "Create Family Membership"}</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 16 }}>Set up a family membership with shared commitment pricing.</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Member Count */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Membership Type</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {([2, 3] as const).map((n) => (
                    <Pressable key={n} onPress={() => { setMemberCount(n); setSelectedFamilyMembers([]); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: memberCount === n ? Colors.primary : Colors.border, backgroundColor: memberCount === n ? Colors.primary + "1A" : "white" }}>
                      <Text style={{ fontSize: 12, color: memberCount === n ? Colors.primary : Colors.mutedForeground }}>{n} Members</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Primary Member */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Primary Member (Payment Holder) *</Text>
                {primaryMemberId ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary + "1A", borderRadius: 10, padding: 10, marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Crown size={14} color={Colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: "500", color: Colors.primary }}>{allProfiles.find((p) => p.id === primaryMemberId)?.full_name}</Text>
                    </View>
                    <Pressable onPress={() => setPrimaryMemberId("")}><Text style={{ fontSize: 12, color: Colors.primary }}>Change</Text></Pressable>
                  </View>
                ) : (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 8, marginBottom: 6 }}>
                      <Search size={14} color={Colors.mutedForeground} />
                      <TextInput style={{ flex: 1, paddingVertical: 7, paddingLeft: 6, fontSize: 12, color: Colors.foreground }} placeholder="Search..." placeholderTextColor={Colors.mutedForeground} value={primarySearch} onChangeText={setPrimarySearch} />
                    </View>
                    <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, maxHeight: 150 }}>
                      <FlatList
                        data={filteredPrimary.slice(0, 30)}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                          <Pressable onPress={() => { setPrimaryMemberId(item.id); setSelectedFamilyMembers((prev) => prev.filter((x) => x !== item.id)); setPrimarySearch(""); }} style={({ pressed }) => ({ padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "33", opacity: pressed ? 0.7 : 1 })}>
                            <Text style={{ fontSize: 12, fontWeight: "500" }}>{item.full_name}</Text>
                            <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{item.email}</Text>
                          </Pressable>
                        )}
                      />
                    </View>
                  </>
                )}
              </View>

              {/* Family Members */}
              {primaryMemberId && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Family Members ({selectedFamilyMembers.length}/{memberCount - 1}) *</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 8, marginBottom: 6 }}>
                    <Search size={14} color={Colors.mutedForeground} />
                    <TextInput style={{ flex: 1, paddingVertical: 7, paddingLeft: 6, fontSize: 12, color: Colors.foreground }} placeholder="Search members..." placeholderTextColor={Colors.mutedForeground} value={familyMemberSearch} onChangeText={setFamilyMemberSearch} />
                  </View>
                  <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, maxHeight: 160 }}>
                    <FlatList
                      data={availableFamilyMembers.slice(0, 50)}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => {
                        const selected = selectedFamilyMembers.includes(item.id);
                        const disabled = !selected && selectedFamilyMembers.length >= memberCount - 1;
                        return (
                          <Pressable onPress={() => !disabled && toggleFamilyMember(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "33", opacity: disabled ? 0.4 : 1 }}>
                            <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: selected ? Colors.primary : Colors.border, backgroundColor: selected ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                              {selected && <Check size={12} color="white" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12, fontWeight: "500" }}>{item.full_name}</Text>
                              <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{item.email}</Text>
                            </View>
                          </Pressable>
                        );
                      }}
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed || saving ? 0.7 : 1, marginTop: 8, marginBottom: 8 })}>
              {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: "white", fontWeight: "600" }}>{isEditing ? "Save Changes" : "Create Family"}</Text>}
            </Pressable>
            <Pressable onPress={() => { resetForm(); setShowModal(false); }} style={{ alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ color: Colors.mutedForeground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

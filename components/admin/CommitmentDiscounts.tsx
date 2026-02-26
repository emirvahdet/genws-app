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
import { Percent, Plus, Trash2, Edit, Check, Users, User, Search } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { DatePicker } from "../ui/DatePicker";

interface Discount {
  id: string;
  name: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  target_type: "all" | "groups" | "members";
  is_active: boolean;
  applies_to_renewals: boolean;
  created_at: string;
  valid_from: string | null;
  valid_until: string | null;
}

interface Group { id: string; name: string; }
interface Member { id: string; full_name: string; email: string; }

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
};

export function CommitmentDiscounts() {
  const [loading, setLoading] = useState(true);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: 10,
    target_type: "all" as "all" | "groups" | "members",
    applies_to_renewals: true,
    selectedGroups: [] as string[],
    selectedMembers: [] as string[],
    valid_from: "",
    valid_until: "",
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data: d } = await supabase.from("commitment_discounts").select("*").order("created_at", { ascending: false });
      setDiscounts((d || []) as Discount[]);
      const { data: g } = await supabase.from("admin_groups").select("id, name").order("name");
      setGroups(g || []);
      const { data: m } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      setMembers(m || []);
    } catch (e) {
      Alert.alert("Error", "Failed to load discount data");
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscountTargets = async (discountId: string) => {
    const { data: gt } = await supabase.from("commitment_discount_groups").select("group_id").eq("discount_id", discountId);
    const { data: mt } = await supabase.from("commitment_discount_members").select("user_id").eq("discount_id", discountId);
    return { groups: gt?.map((g: any) => g.group_id) || [], members: mt?.map((m: any) => m.user_id) || [] };
  };

  const resetForm = () => {
    setFormData({ name: "", discount_type: "percentage", discount_value: 10, target_type: "all", applies_to_renewals: true, selectedGroups: [], selectedMembers: [], valid_from: "", valid_until: "" });
    setSelectedDiscount(null);
    setMemberSearch("");
  };

  const handleEdit = async (discount: Discount) => {
    setSelectedDiscount(discount);
    const targets = await fetchDiscountTargets(discount.id);
    setFormData({
      name: discount.name,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      target_type: discount.target_type,
      applies_to_renewals: discount.applies_to_renewals,
      selectedGroups: targets.groups,
      selectedMembers: targets.members,
      valid_from: discount.valid_from ? discount.valid_from.split("T")[0] : "",
      valid_until: discount.valid_until ? discount.valid_until.split("T")[0] : "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { Alert.alert("Error", "Please enter a discount name"); return; }
    if (formData.discount_value <= 0) { Alert.alert("Error", "Value must be > 0"); return; }
    if (formData.target_type === "groups" && formData.selectedGroups.length === 0) { Alert.alert("Error", "Select at least one group"); return; }
    if (formData.target_type === "members" && formData.selectedMembers.length === 0) { Alert.alert("Error", "Select at least one member"); return; }

    setSaving(true);
    try {
      let discountId: string;
      if (selectedDiscount) {
        const { error } = await supabase.from("commitment_discounts").update({
          name: formData.name, discount_type: formData.discount_type, discount_value: formData.discount_value,
          target_type: formData.target_type, applies_to_renewals: formData.applies_to_renewals,
          valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : null,
          valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq("id", selectedDiscount.id);
        if (error) throw error;
        discountId = selectedDiscount.id;
        await supabase.from("commitment_discount_groups").delete().eq("discount_id", discountId);
        await supabase.from("commitment_discount_members").delete().eq("discount_id", discountId);
      } else {
        const { data, error } = await supabase.from("commitment_discounts").insert({
          name: formData.name, discount_type: formData.discount_type, discount_value: formData.discount_value,
          target_type: formData.target_type, applies_to_renewals: formData.applies_to_renewals,
          valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : null,
          valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        }).select().single();
        if (error) throw error;
        discountId = data.id;
      }
      if (formData.target_type === "groups" && formData.selectedGroups.length > 0) {
        await supabase.from("commitment_discount_groups").insert(formData.selectedGroups.map((gid) => ({ discount_id: discountId, group_id: gid })));
      }
      if (formData.target_type === "members" && formData.selectedMembers.length > 0) {
        await supabase.from("commitment_discount_members").insert(formData.selectedMembers.map((uid) => ({ discount_id: discountId, user_id: uid })));
      }
      Alert.alert("Success", selectedDiscount ? "Discount updated" : "Discount created");
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save discount");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (discount: Discount) => {
    Alert.alert("Delete Discount?", `Delete "${discount.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("commitment_discounts").delete().eq("id", discount.id);
            if (error) throw error;
            Alert.alert("Success", "Discount deleted");
            fetchData();
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };

  const toggleGroup = (id: string) => setFormData((p) => ({ ...p, selectedGroups: p.selectedGroups.includes(id) ? p.selectedGroups.filter((x) => x !== id) : [...p.selectedGroups, id] }));
  const toggleMember = (id: string) => setFormData((p) => ({ ...p, selectedMembers: p.selectedMembers.includes(id) ? p.selectedMembers.filter((x) => x !== id) : [...p.selectedMembers, id] }));

  const filteredMembers = members.filter((m) => m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase()));
  const selectedMemberIds = new Set(formData.selectedMembers);
  const selectedMemberItems = filteredMembers.filter((m) => selectedMemberIds.has(m.id));
  const unselectedMemberItems = filteredMembers.filter((m) => !selectedMemberIds.has(m.id));
  const memberLimit = 50;
  const remainingSlots = Math.max(0, memberLimit - selectedMemberItems.length);
  const orderedMemberItems = [...selectedMemberItems, ...unselectedMemberItems.slice(0, remainingSlots)];

  if (loading) return <ActivityIndicator size="small" color={Colors.primary} style={{ paddingVertical: 24 }} />;

  return (
    <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Percent size={18} color={Colors.primary} />
          <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>Commitment Discounts</Text>
        </View>
        <Pressable onPress={() => { resetForm(); setShowModal(true); }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, opacity: pressed ? 0.85 : 1 })}>
          <Plus size={12} color="white" /><Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>Add</Text>
        </Pressable>
      </View>

      {discounts.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Percent size={32} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 8 }} />
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>No discounts created yet</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {discounts.map((d) => (
            <View key={d.id} style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }}>{d.name}</Text>
                  <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 2 }}>
                    {d.discount_type === "percentage" ? `${d.discount_value}%` : `$${d.discount_value}`} off · {d.target_type === "all" ? "All members" : d.target_type === "groups" ? "Specific groups" : "Specific members"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                    <View style={{ backgroundColor: d.is_active ? "#dcfce7" : "#f3f4f6", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, color: d.is_active ? "#16a34a" : "#6b7280" }}>{d.is_active ? "Active" : "Inactive"}</Text>
                    </View>
                    <View style={{ backgroundColor: d.applies_to_renewals ? "#dbeafe" : "#f3f4f6", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, color: d.applies_to_renewals ? "#2563eb" : "#6b7280" }}>{d.applies_to_renewals ? "Renewals" : "First-time"}</Text>
                    </View>
                  </View>
                  {(d.valid_from || d.valid_until) && <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>{fmtDate(d.valid_from)} → {fmtDate(d.valid_until)}</Text>}
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable onPress={() => handleEdit(d)} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}><Edit size={16} color={Colors.foreground} /></Pressable>
                  <Pressable onPress={() => handleDelete(d)} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}><Trash2 size={16} color={Colors.destructive} /></Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { resetForm(); setShowModal(false); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground, marginBottom: 16 }}>{selectedDiscount ? "Edit Discount" : "Add Discount"}</Text>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
              {/* Name */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Discount Name *</Text>
                <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 9, fontSize: 13, color: Colors.foreground }} value={formData.name} onChangeText={(t) => setFormData((p) => ({ ...p, name: t }))} placeholder="e.g., Early Bird Discount" placeholderTextColor={Colors.mutedForeground} />
              </View>

              {/* Type + Value */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Type</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {(["percentage", "fixed"] as const).map((t) => (
                      <Pressable key={t} onPress={() => setFormData((p) => ({ ...p, discount_type: t }))} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: formData.discount_type === t ? Colors.primary : Colors.border, backgroundColor: formData.discount_type === t ? Colors.primary + "1A" : "white" }}>
                        <Text style={{ fontSize: 11, color: formData.discount_type === t ? "white" : Colors.mutedForeground }}>{t === "percentage" ? "%" : "$"}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Value *</Text>
                  <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 9, fontSize: 13, color: Colors.foreground }} value={formData.discount_value.toString()} onChangeText={(t) => setFormData((p) => ({ ...p, discount_value: Number(t) || 0 }))} keyboardType="decimal-pad" />
                </View>
              </View>

              {/* Target Type */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>Apply To *</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(["all", "groups", "members"] as const).map((t) => (
                    <Pressable key={t} onPress={() => setFormData((p) => ({ ...p, target_type: t, selectedGroups: [], selectedMembers: [] }))} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: formData.target_type === t ? Colors.primary : Colors.border, backgroundColor: formData.target_type === t ? Colors.primary + "1A" : "white" }}>
                      <Text style={{ fontSize: 10, color: formData.target_type === t ? "white" : Colors.mutedForeground, textTransform: "capitalize" }}>{t === "all" ? "All" : t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Applies to Renewals */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground }}>Applies to Renewals</Text>
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{formData.applies_to_renewals ? "First-time & renewals" : "First-time only"}</Text>
                </View>
                <Switch value={formData.applies_to_renewals} onValueChange={(v) => setFormData((p) => ({ ...p, applies_to_renewals: v }))} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="white" />
              </View>

              {/* Validity */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <DatePicker label="Valid From" value={formData.valid_from} onChange={(t) => setFormData((p) => ({ ...p, valid_from: t }))} placeholder="Select start date" />
                </View>
                <View style={{ flex: 1 }}>
                  <DatePicker label="Valid Until" value={formData.valid_until} onChange={(t) => setFormData((p) => ({ ...p, valid_until: t }))} placeholder="Select end date" />
                </View>
              </View>

              {/* Group selection */}
              {formData.target_type === "groups" && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Select Groups *</Text>
                  <ScrollView style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, maxHeight: 160 }} nestedScrollEnabled={true}>
                    {groups.map((item) => (
                      <Pressable key={item.id} onPress={() => toggleGroup(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "33" }}>
                        <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: formData.selectedGroups.includes(item.id) ? Colors.primary : Colors.border, backgroundColor: formData.selectedGroups.includes(item.id) ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                          {formData.selectedGroups.includes(item.id) && <Check size={12} color="white" />}
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Users size={14} color={Colors.mutedForeground} />
                          <Text style={{ fontSize: 12, color: Colors.foreground }}>{item.name}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Member selection */}
              {formData.target_type === "members" && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Select Members *</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 8, marginBottom: 6 }}>
                    <Search size={14} color={Colors.mutedForeground} />
                    <TextInput style={{ flex: 1, paddingVertical: 7, paddingLeft: 6, fontSize: 12, color: Colors.foreground }} placeholder="Search..." placeholderTextColor={Colors.mutedForeground} value={memberSearch} onChangeText={setMemberSearch} />
                  </View>
                  <ScrollView style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, maxHeight: 160 }} nestedScrollEnabled={true}>
                    {orderedMemberItems.map((item) => (
                      <Pressable key={item.id} onPress={() => toggleMember(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "33" }}>
                        <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: formData.selectedMembers.includes(item.id) ? Colors.primary : Colors.border, backgroundColor: formData.selectedMembers.includes(item.id) ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                          {formData.selectedMembers.includes(item.id) && <Check size={12} color="white" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: "500" }}>{item.full_name}</Text>
                          <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{item.email}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {formData.selectedMembers.length > 0 && <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 4 }}>{formData.selectedMembers.length} member(s) selected</Text>}
                </View>
              )}
            </ScrollView>

            <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed || saving ? 0.7 : 1, marginTop: 8, marginBottom: 8 })}>
              {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: "white", fontWeight: "600" }}>{selectedDiscount ? "Update" : "Create"}</Text>}
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

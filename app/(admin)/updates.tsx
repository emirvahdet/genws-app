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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Plus, Trash2, Edit, FileText } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface Update {
  id: string;
  title: string;
  content: string;
  published: boolean;
  created_at: string;
}

export default function AdminUpdatesScreen() {
  const router = useRouter();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", content: "", published: false });

  useEffect(() => { fetchUpdates(); }, []);

  const fetchUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from("updates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUpdates(data || []);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load updates");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) { Alert.alert("Validation Error", "Title is required"); return; }
    try {
      if (editingId) {
        const { error } = await supabase.from("updates").update(formData).eq("id", editingId);
        if (error) throw error;
        Alert.alert("Success", "Update has been modified");
      } else {
        const { error } = await supabase.from("updates").insert([formData]);
        if (error) throw error;
        Alert.alert("Success", "Update has been created");
      }
      resetForm();
      fetchUpdates();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save update");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Update", "Are you sure you want to delete this update?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("updates").delete().eq("id", id);
            if (error) throw error;
            Alert.alert("Success", "Update has been deleted");
            fetchUpdates();
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };

  const handleEdit = (update: Update) => {
    setFormData({ title: update.title, content: update.content, published: update.published });
    setEditingId(update.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ title: "", content: "", published: false });
    setEditingId(null);
    setShowModal(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
              <ArrowLeft size={22} color={Colors.foreground} />
            </Pressable>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Manage Updates</Text>
          </View>
          <Pressable
            onPress={() => { resetForm(); setShowModal(true); }}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, opacity: pressed ? 0.85 : 1 })}
          >
            <Plus size={14} color="white" />
            <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>New Update</Text>
          </Pressable>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ paddingVertical: 48 }} />
        ) : updates.length === 0 ? (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 32, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <FileText size={40} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>No updates yet. Create your first update!</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {updates.map((update) => (
              <View key={update.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>{update.title}</Text>
                    <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 18, marginBottom: 8 }}>{update.content}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ backgroundColor: update.published ? "#dcfce7" : "#f3f4f6", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 11, color: update.published ? "#16a34a" : "#6b7280" }}>{update.published ? "Published" : "Draft"}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{new Date(update.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable onPress={() => handleEdit(update)} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}>
                      <Edit size={18} color={Colors.foreground} />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(update.id)} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}>
                      <Trash2 size={18} color={Colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={resetForm}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 16 }}>
              {editingId ? "Edit Update" : "Create New Update"}
            </Text>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Title *</Text>
              <TextInput
                style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.foreground }}
                value={formData.title} onChangeText={(t) => setFormData((p) => ({ ...p, title: t }))}
              />
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Content</Text>
              <TextInput
                style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.foreground, minHeight: 100, textAlignVertical: "top" }}
                value={formData.content} onChangeText={(t) => setFormData((p) => ({ ...p, content: t }))} multiline
              />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: Colors.foreground }}>Published</Text>
              <Switch value={formData.published} onValueChange={(v) => setFormData((p) => ({ ...p, published: v }))} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="white" />
            </View>
            <Pressable onPress={handleSubmit} style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1, marginBottom: 8 })}>
              <Text style={{ color: "white", fontWeight: "600" }}>{editingId ? "Save Changes" : "Create Update"}</Text>
            </Pressable>
            <Pressable onPress={resetForm} style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ fontWeight: "500", color: Colors.foreground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

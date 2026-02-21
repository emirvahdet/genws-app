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
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Newspaper,
  FileText,
  Video,
  Mic,
  CheckCircle2,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  content_type: string;
  external_url?: string;
  image_url?: string;
  published: boolean;
  reviewed: boolean;
  category?: string;
  created_at: string;
  creator_name?: string;
}

const CONTENT_TYPES = ["article", "video", "interview"] as const;

const getContentIcon = (type: string) => {
  switch (type) {
    case "video": return Video;
    case "interview": return Mic;
    default: return FileText;
  }
};

export default function AdminNewsScreen() {
  const router = useRouter();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    content_type: "article",
    external_url: "",
    image_url: "",
    published: false,
    reviewed: false,
    category: "",
  });

  useEffect(() => {
    fetchNews();
    fetchCategories();
  }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const creatorIds = [...new Set((data || []).map((n: any) => n.created_by).filter(Boolean))];
      let creatorsMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds);
        if (profiles) {
          creatorsMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.full_name]));
        }
      }

      setNewsItems(
        (data || []).map((n: any) => ({
          ...n,
          creator_name: creatorsMap[n.created_by] || undefined,
        }))
      );
    } catch (e) {
      __DEV__ && console.log("Error fetching news:", e);
      Alert.alert("Error", "Failed to load news");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("news_categories")
        .select("name")
        .order("name");
      if (error) throw error;
      setCategories((data || []).map((c: any) => c.name));
    } catch (e) {
      __DEV__ && console.log("Error fetching categories:", e);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    try {
      const { error } = await supabase.from("news_categories").insert([{ name: trimmed }]);
      if (error) throw error;
      setCategories((prev) => [...prev, trimmed].sort());
      setFormData((prev) => ({ ...prev, category: trimmed }));
      setNewCategoryName("");
      setShowAddCategory(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert("Validation Error", "Title is required");
      return;
    }

    const submitData = {
      title: formData.title,
      content: formData.content,
      content_type: formData.content_type,
      external_url: formData.external_url || null,
      image_url: formData.image_url || null,
      published: formData.published,
      reviewed: formData.reviewed,
      category: formData.category || null,
    };

    try {
      if (editingNews) {
        const { error } = await supabase.from("news").update(submitData).eq("id", editingNews.id);
        if (error) throw error;
        Alert.alert("Success", "News updated successfully");
      } else {
        const { error } = await supabase.from("news").insert([submitData]);
        if (error) throw error;
        Alert.alert("Success", "News created successfully");
      }
      setShowModal(false);
      resetForm();
      fetchNews();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save news");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete News", "Are you sure you want to delete this news item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("news").delete().eq("id", id);
            if (error) throw error;
            Alert.alert("Success", "News deleted successfully");
            fetchNews();
          } catch (e) {
            Alert.alert("Error", "Failed to delete news");
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormData({ title: "", content: "", content_type: "article", external_url: "", image_url: "", published: false, reviewed: false, category: "" });
    setEditingNews(null);
    setShowAddCategory(false);
    setNewCategoryName("");
  };

  const openEditModal = (news: NewsItem) => {
    setEditingNews(news);
    setFormData({
      title: news.title,
      content: news.content || "",
      content_type: news.content_type,
      external_url: news.external_url || "",
      image_url: news.image_url || "",
      published: news.published,
      reviewed: news.reviewed || false,
      category: news.category || "",
    });
    setShowModal(true);
  };

  const FormField = ({ label, value, onChangeText, placeholder, multiline, keyboardType }: any) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
          padding: 10, fontSize: 14, color: Colors.foreground,
          ...(multiline ? { minHeight: 80, textAlignVertical: "top" as const } : {}),
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Manage News</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>Add, edit, or remove news articles</Text>
          </View>
        </View>

        {/* Add Button */}
        <Pressable
          onPress={() => { resetForm(); setShowModal(true); }}
          style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginBottom: 16,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Plus size={16} color="white" />
          <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>Add News Article</Text>
        </Pressable>

        {/* List */}
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: "center" }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : newsItems.length === 0 ? (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 32, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <Newspaper size={48} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 12 }} />
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>No news yet</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {newsItems.map((news) => {
              const Icon = getContentIcon(news.content_type);
              return (
                <View key={news.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {news.image_url ? (
                      <Image source={{ uri: news.image_url }} style={{ width: 72, height: 72, borderRadius: 10 }} contentFit="cover" />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      {/* Badges */}
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Icon size={10} color={Colors.mutedForeground} />
                          <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{news.content_type}</Text>
                        </View>
                        {news.published ? (
                          <View style={{ backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, color: "#16a34a" }}>Published</Text>
                          </View>
                        ) : (
                          <View style={{ backgroundColor: "#fef3c7", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, color: "#d97706" }}>Draft</Text>
                          </View>
                        )}
                        {news.reviewed ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <CheckCircle2 size={10} color="#16a34a" />
                            <Text style={{ fontSize: 10, color: "#16a34a" }}>Reviewed</Text>
                          </View>
                        ) : (
                          <View style={{ backgroundColor: "#fee2e2", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, color: "#dc2626" }}>Not Reviewed</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground, marginBottom: 2 }} numberOfLines={1}>{news.title}</Text>
                      {news.creator_name && <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>by {news.creator_name}</Text>}
                      {news.category && <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{news.category}</Text>}
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 4 }} numberOfLines={2}>{news.content}</Text>
                    </View>
                    {/* Actions */}
                    <View style={{ gap: 8 }}>
                      <Pressable onPress={() => openEditModal(news)} style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                        <Edit size={14} color={Colors.foreground} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(news.id)} style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                        <Trash2 size={14} color="white" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 16 }}>
              {editingNews ? "Edit News" : "Create News Article"}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <FormField label="Title *" value={formData.title} onChangeText={(t: string) => setFormData((p) => ({ ...p, title: t }))} placeholder="News title" />

              {/* Content Type */}
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Content Type *</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {CONTENT_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setFormData((p) => ({ ...p, content_type: type }))}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                      borderWidth: 1,
                      borderColor: formData.content_type === type ? Colors.primary : Colors.border,
                      backgroundColor: formData.content_type === type ? Colors.primary + "1A" : "white",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "500", color: formData.content_type === type ? Colors.primary : Colors.mutedForeground, textTransform: "capitalize" }}>{type}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Category */}
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 6 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setFormData((p) => ({ ...p, category: cat }))}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                        borderWidth: 1,
                        borderColor: formData.category === cat ? Colors.primary : Colors.border,
                        backgroundColor: formData.category === cat ? Colors.primary + "1A" : "white",
                      }}
                    >
                      <Text style={{ fontSize: 12, color: formData.category === cat ? Colors.primary : Colors.mutedForeground }}>{cat}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => setShowAddCategory(true)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed" }}
                  >
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>+ Add New</Text>
                  </Pressable>
                </View>
              </ScrollView>
              {showAddCategory && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 12 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, fontSize: 13, color: Colors.foreground }}
                    placeholder="New category name"
                    placeholderTextColor={Colors.mutedForeground}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                  />
                  <Pressable onPress={handleAddCategory} style={{ backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" }}>
                    <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>Add</Text>
                  </Pressable>
                </View>
              )}
              <View style={{ height: 8 }} />

              <FormField label="Content" value={formData.content} onChangeText={(t: string) => setFormData((p) => ({ ...p, content: t }))} multiline />
              <FormField label="External URL" value={formData.external_url} onChangeText={(t: string) => setFormData((p) => ({ ...p, external_url: t }))} placeholder="https://example.com/article" keyboardType="url" />
              <FormField label="Image URL" value={formData.image_url} onChangeText={(t: string) => setFormData((p) => ({ ...p, image_url: t }))} placeholder="https://example.com/image.jpg" keyboardType="url" />

              {/* Published toggle */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: Colors.foreground }}>Published</Text>
                <Switch value={formData.published} onValueChange={(v) => setFormData((p) => ({ ...p, published: v }))} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="white" />
              </View>

              {/* Reviewed toggle */}
              <Pressable
                onPress={() => setFormData((p) => ({ ...p, reviewed: !p.reviewed }))}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: formData.reviewed ? Colors.primary : Colors.border, backgroundColor: formData.reviewed ? Colors.primary : "white", alignItems: "center", justifyContent: "center" }}>
                  {formData.reviewed && <CheckCircle2 size={14} color="white" />}
                </View>
                <Text style={{ fontSize: 13, color: Colors.foreground }}>Reviewed</Text>
              </Pressable>
            </ScrollView>

            {/* Actions */}
            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => ({ backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1, marginBottom: 8 })}
            >
              <Text style={{ color: "white", fontWeight: "600", fontSize: 15 }}>{editingNews ? "Update News" : "Create News"}</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowModal(false); resetForm(); }}
              style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontWeight: "500", color: Colors.foreground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ExternalLink } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  content_type: string;
  image_url?: string;
  external_url?: string;
  category?: string;
  created_at: string;
}

const getContentTypeLabel = (type: string) => {
  if (type === "article") return "INSIGHTS";
  return (type.charAt(0).toUpperCase() + type.slice(1)).toUpperCase();
};

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [newsItem, setNewsItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNewsItem = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq("id", id)
        .eq("published", true)
        .single();
      if (error) throw error;
      setNewsItem(data);
    } catch (e) {
      __DEV__ && console.log("Error fetching news item:", e);
      router.replace("/(tabs)/news" as any);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchNewsItem();
  }, [id, fetchNewsItem]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!newsItem) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
        <View style={{ flex: 1, padding: 16 }}>
          <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <ArrowLeft size={20} color={Colors.foreground} />
            <Text style={{ color: Colors.foreground }}>Back</Text>
          </Pressable>
          <Text style={{ color: Colors.mutedForeground }}>News item not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      {/* Back nav bar */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.6 : 1, alignSelf: "flex-start" })}
        >
          <ArrowLeft size={18} color={Colors.foreground} />
          <Text style={{ fontSize: 14, color: Colors.foreground }}>Back to News</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.5, color: "#00451a" }}>
            {getContentTypeLabel(newsItem.content_type)}
          </Text>
          <Text style={{ color: Colors.mutedForeground }}>•</Text>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
            {new Date(newsItem.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Headline */}
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: Colors.foreground,
            lineHeight: 36,
            paddingHorizontal: 16,
            marginBottom: 20,
          }}
        >
          {newsItem.title}
        </Text>

        {/* Featured Image */}
        {newsItem.image_url && (
          <View style={{ marginBottom: 24 }}>
            <Image
              source={{ uri: newsItem.image_url }}
              style={{ width: "100%", aspectRatio: 16 / 9 }}
              contentFit="cover"
            />
          </View>
        )}

        {/* Body */}
        {newsItem.content && (
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={{ fontSize: 16, lineHeight: 26, color: Colors.foreground }}>
              {stripHtml(newsItem.content)}
            </Text>
          </View>
        )}

        {/* External Link */}
        {newsItem.external_url && (
          <View style={{ paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 20, marginTop: 8 }}>
            <Pressable
              onPress={() => Linking.openURL(newsItem.external_url!)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.7 : 1, alignSelf: "flex-start" })}
            >
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#00451a" }}>Read full article</Text>
              <ExternalLink size={16} color="#00451a" />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

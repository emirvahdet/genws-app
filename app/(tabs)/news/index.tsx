import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../../../lib/supabase";
import { MobileLayout } from "../../../components/layout/MobileLayout";
import { Colors } from "../../../constants/Colors";
import { cacheData, getCachedData } from "../../../lib/offlineCache";
import { useNetworkStatus } from "../../../hooks/useNetworkStatus";
import { OfflineBanner } from "../../../components/ui/OfflineBanner"; 

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

export default function NewsScreen() {
  const router = useRouter();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      if (!isConnected || !isInternetReachable) {
        const cached = await getCachedData<NewsItem[]>("news_list");
        if (cached) {
          setNewsItems(cached);
          setIsOffline(true);
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setNewsItems(data || []);
      await cacheData("news_list", data || []);
      setIsOffline(false);
    } catch (e) {
      __DEV__ && console.log("Error fetching news:", e);
      const cached = await getCachedData<NewsItem[]>("news_list");
      if (cached) {
        setNewsItems(cached);
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [isConnected, isInternetReachable]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchNews();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <MobileLayout>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <OfflineBanner visible={isOffline} />
      <FlatList
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 }}>
            <Text style={{ fontSize: 32, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>
              News & Insights
            </Text>
            <Text style={{ color: Colors.mutedForeground, fontSize: 15 }}>
              Latest stories, interviews, and insights
            </Text>
          </View>
        }
        data={newsItems}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={{ padding: 16, paddingTop: 48, alignItems: "center" }}>
            <Text style={{ color: Colors.mutedForeground }}>No content available yet</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => router.push(`/news/${item.id}` as any)}
            style={({ pressed }) => ({
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
              paddingVertical: 32,
              paddingHorizontal: 16,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            {/* Featured image — first item only, above content */}
            {index === 0 && item.image_url && (
              <View style={{ marginBottom: 24, borderRadius: 4, overflow: "hidden" }}>
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: "100%", aspectRatio: 16 / 9 }}
                  contentFit="cover"
                />
              </View>
            )}

            {/* Category + Date row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.5, color: "#00451a" }}>
                {getContentTypeLabel(item.content_type)}
              </Text>
              {item.category && (
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, fontWeight: "500" }}>
                  {item.category}
                </Text>
              )}
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
                {new Date(item.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>

            {/* Headline */}
            <Text
              style={{
                fontWeight: "700",
                color: Colors.foreground,
                marginBottom: 12,
                fontSize: index === 0 ? 28 : 20,
                lineHeight: index === 0 ? 36 : 28,
              }}
            >
              {item.title}
            </Text>

            {/* Summary */}
            {item.content && (
              <Text
                style={{
                  color: Colors.foreground,
                  lineHeight: 22,
                  fontSize: index === 0 ? 16 : 14,
                }}
                numberOfLines={index === 0 ? 4 : 3}
              >
                {stripHtml(item.content)}
              </Text>
            )}

            {/* External link indicator */}
            {item.external_url && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <ExternalLink size={14} color={Colors.mutedForeground} />
                <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>External article</Text>
              </View>
            )}

            {/* Thumbnail — non-first items, below content */}
            {index !== 0 && item.image_url && (
              <View style={{ marginTop: 16, borderRadius: 4, overflow: "hidden" }}>
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: "100%", aspectRatio: 16 / 9 }}
                  contentFit="cover"
                />
              </View>
            )}
          </Pressable>
        )}
      />
    </MobileLayout>
  );
}

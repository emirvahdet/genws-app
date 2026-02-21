import { ReactNode, useEffect, useState } from "react";
import { View, Text, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useViewAs } from "../../stores/ViewAsContext";
import { Colors } from "../../constants/Colors";

interface MobileLayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
}

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  batch_number: string | null;
  generation_number: number | null;
}

const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
};

const getInitials = (fullName: string | null): string => {
  if (!fullName) return "U";
  const parts = fullName.split(" ").filter((n) => n.length > 0);
  if (parts.length >= 3) {
    return (parts[0][0] + parts[1][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts.map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
};

export const MobileLayout = ({ children, hideHeader = false }: MobileLayoutProps) => {
  const { isViewingAs, viewAsUser } = useViewAs();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        return;
      }
      const effectiveId = isViewingAs && viewAsUser ? viewAsUser.id : user.id;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, batch_number, generation_number")
        .eq("id", effectiveId)
        .single();
      setProfile(data);
    };

    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchProfile();
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [isViewingAs, viewAsUser]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Top Header - extends into status bar */}
      {!hideHeader && (
        <View style={{ backgroundColor: Colors.card }}>
          <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.card }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: 80,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border + "80",
              }}
            >
              {/* Avatar - rounded square with light gray background */}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: Colors.muted, // Light gray background (#f5f5f5)
                  borderWidth: 1,
                  borderColor: Colors.border + "4D", // 30% opacity border
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                  overflow: "hidden",
                }}
              >
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={{ width: 48, height: 48 }}
                  />
                ) : (
                  <Text
                    style={{
                      color: Colors.primary, // Dark green text
                      fontWeight: "600",
                      fontSize: 16,
                    }}
                  >
                    {getInitials(profile?.full_name ?? null)}
                  </Text>
                )}
              </View>

              {/* Name + Badge */}
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: Colors.foreground,
                    lineHeight: 18,
                  }}
                  numberOfLines={1}
                >
                  {profile?.full_name || "Member"}
                </Text>
                {profile?.generation_number != null && (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      borderWidth: 1,
                      borderColor: Colors.primary + "4D", // 30% opacity green border
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      backgroundColor: Colors.muted, // Light gray background
                    }}
                  >
                    <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "400" }}>
                      {profile.generation_number}
                      {getOrdinalSuffix(profile.generation_number)} Gen
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ width: 48 }} />
            </View>
          </SafeAreaView>
        </View>
      )}

      {/* Content */}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
};

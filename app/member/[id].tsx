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
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Mail,
  Phone,
  Briefcase,
  Target,
  Activity,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { MobileLayout } from "../../components/layout/MobileLayout";

interface MemberData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  company: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  interests: string[] | null;
  priorities: string[] | null;
  preferred_activities: string[] | null;
  preferred_email: string | null;
  preferred_telephone: string | null;
  batch_number: string | null;
  generation_number: number | null;
  show_location: boolean | null;
}

const getInitials = (name: string | null) => {
  if (!name) return "??";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

const getOrdinalSuffix = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const fetchMember = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !id) {
        router.back();
        return;
      }

      const { data: connectionData, error: connectionError } = await supabase
        .from("network_connections")
        .select("id")
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${id}),and(user1_id.eq.${id},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (connectionError) throw connectionError;

      if (!connectionData) {
        router.back();
        return;
      }

      setIsConnected(true);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, company, bio, city, country, interests, priorities, preferred_activities, preferred_email, preferred_telephone, batch_number, generation_number, show_location")
        .eq("id", id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (profileData) setMember(profileData as MemberData);
    } catch (e) {
      __DEV__ && console.log("Error fetching member profile:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  if (loading) {
    return (
      <MobileLayout>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </MobileLayout>
    );
  }

  if (!member || !isConnected) {
    return (
      <MobileLayout>
        <View style={{ flex: 1, padding: 16 }}>
          <Pressable
            onPress={() => router.replace("/(tabs)/profile" as any)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, opacity: pressed ? 0.6 : 1 })}
          >
            <ArrowLeft size={20} color={Colors.foreground} />
            <Text style={{ color: Colors.foreground }}>Back</Text>
          </Pressable>
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ color: Colors.mutedForeground }}>Member not found or you are not connected.</Text>
          </View>
        </View>
      </MobileLayout>
    );
  }

  const Section = ({ title, icon: Icon, tags }: { title: string; icon: any; tags: string[] }) => (
    <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon size={16} color={Colors.foreground} />
        <Text style={{ fontWeight: "600", fontSize: 15, color: Colors.foreground }}>{title}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {tags.map((tag, i) => (
          <View key={i} style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, color: Colors.foreground }}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <MobileLayout>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
        <Pressable
          onPress={() => router.replace("/(tabs)/profile" as any)}
          style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
        >
          <ArrowLeft size={22} color={Colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "600", color: Colors.foreground }}>Member Profile</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
          {/* Avatar */}
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.primary + "1A", borderWidth: 1, borderColor: Colors.border + "4D", alignItems: "center", justifyContent: "center", marginBottom: 12, overflow: "hidden" }}>
            {member.avatar_url ? (
              <Image source={{ uri: member.avatar_url }} style={{ width: 96, height: 96 }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 28, fontWeight: "600", color: Colors.primary }}>{getInitials(member.full_name)}</Text>
            )}
          </View>

          <Text style={{ fontSize: 20, fontWeight: "600", color: Colors.foreground, marginBottom: 4, textAlign: "center" }}>
            {member.full_name}
          </Text>

          {member.company && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Building2 size={14} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>{member.company}</Text>
            </View>
          )}

          {member.show_location && (member.city || member.country) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <MapPin size={14} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>
                {[member.city, member.country].filter(Boolean).join(", ")}
              </Text>
            </View>
          )}

          {/* Badges */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 }}>
            {member.batch_number && (
              <View style={{ backgroundColor: Colors.muted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, color: Colors.foreground }}>{member.batch_number}</Text>
              </View>
            )}
            {member.generation_number != null && (
              <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, color: Colors.foreground }}>{getOrdinalSuffix(member.generation_number)} Gen</Text>
              </View>
            )}
          </View>
        </View>

        {/* Contact */}
        {(member.preferred_email || member.preferred_telephone) && (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, gap: 12 }}>
            <Text style={{ fontWeight: "600", fontSize: 15, color: Colors.foreground, marginBottom: 4 }}>Contact</Text>
            {member.preferred_email && (
              <Pressable
                onPress={() => Linking.openURL(`mailto:${member.preferred_email}`)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 })}
              >
                <Mail size={16} color={Colors.mutedForeground} />
                <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>{member.preferred_email}</Text>
              </Pressable>
            )}
            {member.preferred_telephone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${member.preferred_telephone!.replace(/\s/g, "")}`)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 })}
              >
                <Phone size={16} color={Colors.mutedForeground} />
                <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>{member.preferred_telephone}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Bio */}
        {member.bio && (
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontWeight: "600", fontSize: 15, color: Colors.foreground, marginBottom: 8 }}>About</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 22 }}>{member.bio}</Text>
          </View>
        )}

        {/* Interests */}
        {member.interests && member.interests.length > 0 && (
          <Section title="Interests" icon={Briefcase} tags={member.interests} />
        )}

        {/* Priorities */}
        {member.priorities && member.priorities.length > 0 && (
          <Section title="Priorities" icon={Target} tags={member.priorities} />
        )}

        {/* Preferred Activities */}
        {member.preferred_activities && member.preferred_activities.length > 0 && (
          <Section title="Preferred Activities" icon={Activity} tags={member.preferred_activities} />
        )}
      </ScrollView>
    </MobileLayout>
  );
}

import {
  View,
  Text,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Users,
  CalendarDays,
  Newspaper,
  FileEdit,
  FolderOpen,
  MessageSquare,
  BarChart3,
  DollarSign,
  Mail,
  CreditCard,
  Bell,
  ChevronRight,
} from "lucide-react-native";
import { Colors } from "../../constants/Colors";

interface AdminLink {
  label: string;
  description: string;
  route: string;
  icon: React.ComponentType<any>;
  color: string;
}

const ADMIN_LINKS: AdminLink[] = [
  { label: "Members", description: "Create, edit, and manage members", route: "/(admin)/members", icon: Users, color: "#6366f1" },
  { label: "Events", description: "Create and manage events", route: "/(admin)/events", icon: CalendarDays, color: "#0ea5e9" },
  { label: "News", description: "Manage news articles and content", route: "/(admin)/news", icon: Newspaper, color: "#f59e0b" },
  { label: "Notifications", description: "Send push notifications to members", route: "/(admin)/notifications", icon: Bell, color: "#22c55e" },
  { label: "Profile Requests", description: "Review member profile update requests", route: "/(admin)/profile-requests", icon: FileEdit, color: "#8b5cf6" },
  { label: "Groups", description: "Create and manage member groups", route: "/(admin)/groups", icon: FolderOpen, color: "#10b981" },
  { label: "Updates", description: "Manage app updates and announcements", route: "/(admin)/updates", icon: MessageSquare, color: "#ec4899" },
  { label: "Forms", description: "View member submissions and requests", route: "/(admin)/forms", icon: MessageSquare, color: "#14b8a6" },
  { label: "Commitments", description: "Manage annual commitment settings", route: "/(admin)/commitments", icon: DollarSign, color: "#f97316" },
  { label: "Statistics", description: "Attendance verification & analytics", route: "/(admin)/statistics", icon: BarChart3, color: "#06b6d4" },
  { label: "Emails", description: "Create and send newsletters", route: "/(admin)/emails", icon: Mail, color: "#a855f7" },
  { label: "Payments", description: "Payment provider and QNB POS settings", route: "/(admin)/payment", icon: CreditCard, color: "#ef4444" },
];

export default function AdminPanelScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Pressable
            onPress={() => router.replace("/(tabs)/profile" as any)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>
              Admin Panel
            </Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>
              Manage members, content, and settings
            </Text>
          </View>
        </View>

        {/* Navigation Grid */}
        <View style={{ gap: 10 }}>
          {ADMIN_LINKS.map((link) => (
            <Pressable
              key={link.route}
              onPress={() => router.push(link.route as any)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "white",
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: link.color + "1A",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <link.icon size={20} color={link.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>
                  {link.label}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                  {link.description}
                </Text>
              </View>
              <ChevronRight size={18} color={Colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, FileEdit, Users } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

type Tab = "profile-requests" | "groups";

export default function AdminPanelScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("profile-requests");

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile-requests", label: "Profiles" },
    { key: "groups", label: "Groups" },
  ];

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
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
          >
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>
              Admin Panel
            </Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>
              Manage members and content
            </Text>
          </View>
        </View>

        {/* Tab Bar */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: Colors.muted,
            borderRadius: 10,
            padding: 3,
            marginBottom: 16,
          }}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: "center",
                backgroundColor: activeTab === tab.key ? "white" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: activeTab === tab.key ? "600" : "400",
                  color: activeTab === tab.key ? Colors.foreground : Colors.mutedForeground,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === "profile-requests" && (
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: Colors.border,
              alignItems: "center",
            }}
          >
            <FileEdit size={40} color={Colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 8 }}>
              Profile Update Requests
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.mutedForeground,
                textAlign: "center",
                marginBottom: 16,
                lineHeight: 20,
              }}
            >
              Review and approve member profile change requests
            </Text>
            <Pressable
              onPress={() => router.push("/(admin)/profile-requests" as any)}
              style={({ pressed }) => ({
                backgroundColor: Colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 24,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>
                View Profile Requests
              </Text>
            </Pressable>
          </View>
        )}

        {activeTab === "groups" && (
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: Colors.border,
              alignItems: "center",
            }}
          >
            <Users size={40} color={Colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 8 }}>
              Admin Groups
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.mutedForeground,
                textAlign: "center",
                marginBottom: 16,
                lineHeight: 20,
              }}
            >
              Create and manage member groups for event restrictions
            </Text>
            <Pressable
              onPress={() => {/* TODO: groups screen */}}
              style={({ pressed }) => ({
                backgroundColor: Colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 24,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>
                Manage Groups
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

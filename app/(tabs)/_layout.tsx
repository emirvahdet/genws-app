// ⚠️ CRITICAL: DO NOT MODIFY TAB BAR — exactly 5 tabs: Map, Events, GWS, News, Profile
import { Tabs } from "expo-router";
import { Image } from "react-native";
import { MapPin, Calendar, Newspaper, User } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

const TAB_COLOR = "#324750";
const ACTIVE_COLOR = Colors.primary;
const GREEN_BAR = "#00451a";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_COLOR,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border + "80",
          borderTopWidth: 1,
          paddingBottom: 0,
          paddingTop: 4,
          height: 64,
          borderBottomWidth: 7,
          borderBottomColor: GREEN_BAR,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: 0,
          marginBottom: 6,
        },
      }}
    >
      <Tabs.Screen
        name="maps"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => (
            <MapPin size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarIcon: () => (
            <Image
              source={require("../../assets/images/gws-qr-icon.png")}
              style={{ width: 40, height: 40, borderRadius: 6 }}
              resizeMode="cover"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="news/index"
        options={{
          title: "News",
          tabBarIcon: ({ color, size }) => (
            <Newspaper size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      {/* Hidden detail screens - keep tab bar visible but don't show as tabs */}
      <Tabs.Screen
        name="event/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="news/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="member/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/information"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings/email-preferences"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings/privacy-security"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings/help-support"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings/terms-privacy"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="guidebook"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

// ⚠️ CRITICAL: DO NOT MODIFY TAB BAR — exactly 5 tabs: Map, Events, GWS, News, Profile
import { Tabs } from "expo-router";
import { Image, View } from "react-native";
import { MapPin, Calendar, Newspaper, User } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { CustomTabBar } from "../../components/navigation/CustomTabBar";

const TAB_COLOR = "#324750";
const ACTIVE_COLOR = Colors.primary;

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_COLOR,
      }}
    >
      <Tabs.Screen name="maps" options={{ title: "Map" }} />
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="index" options={{ title: "" }} />
      <Tabs.Screen name="news/index" options={{ title: "News" }} />
      <Tabs.Screen name="profile/index" options={{ title: "Profile" }} />
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

import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { MapPin, Calendar, Newspaper, User } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

const INACTIVE_COLOR = "#324750";
const ACTIVE_COLOR = Colors.primary;

function GWSTabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: focused ? Colors.primary : "#324750",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 2,
      }}
    >
      <Text
        style={{
          color: "white",
          fontWeight: "700",
          fontSize: 13,
          letterSpacing: 0.5,
        }}
      >
        GWS
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border + "80",
          borderTopWidth: 1,
          paddingBottom: 0,
          paddingTop: 4,
          height: 64,
          // Green bottom bar (7px) matching webapp
          borderBottomWidth: 7,
          borderBottomColor: Colors.primary,
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
          tabBarIcon: ({ focused }) => <GWSTabIcon focused={focused} />,
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

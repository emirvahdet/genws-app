import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Mail, Phone, MapPin, Globe } from "lucide-react-native";
import { Colors } from "../../../constants/Colors";

export default function HelpSupportScreen() {
  const router = useRouter();

  const Row = ({ icon: Icon, title, value, onPress }: { icon: any; title: string; value: string; onPress?: () => void }) => (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16, padding: 16, backgroundColor: Colors.muted, borderRadius: 12 }}>
      <View style={{ padding: 8, borderRadius: 10, backgroundColor: Colors.primary + "1A" }}>
        <Icon size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.foreground, marginBottom: 4 }}>{title}</Text>
        {onPress ? (
          <Pressable onPress={onPress}>
            <Text style={{ fontSize: 13, color: Colors.primary }}>{value}</Text>
          </Pressable>
        ) : (
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 18 }}>{value}</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Pressable onPress={() => router.replace("/(tabs)/profile" as any)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Help & Support</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>Get in touch with us</Text>
          </View>
        </View>

        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>Generational Wealth Society</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>by Karman Beyond</Text>
          </View>
          <View style={{ gap: 10 }}>
            <Row icon={MapPin} title="Address" value={"Business Istanbul\nBlok A, No: 122\nKadıköy / Istanbul / Türkiye"} />
            <Row icon={Mail} title="Email" value="gws@karmanbeyond.com" onPress={() => Linking.openURL("mailto:gws@karmanbeyond.com")} />
            <Row icon={Phone} title="Phone" value="+90 216 939 00 12" onPress={() => Linking.openURL("tel:+902169390012")} />
            <Row icon={Globe} title="Global Presence" value="Istanbul / London / Dubai" />
          </View>
        </View>

        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, alignItems: "center" }}>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", lineHeight: 20 }}>
            Our team is here to help you. Feel free to reach out with any questions or concerns about the Generational Wealth Society platform.
          </Text>
        </View>

        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", marginBottom: 16 }}>
            Need a refresher on our community guidelines?
          </Text>
          <View style={{ width: "100%", gap: 10 }}>
            <Pressable
              onPress={() => router.push("/onboarding/welcome" as any)}
              style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground }}>Restart Onboarding</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(tabs)/events" as any)}
              style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground }}>Restart Event Onboarding</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

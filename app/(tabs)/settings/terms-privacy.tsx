import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Shield, FileText } from "lucide-react-native";
import { Colors } from "../../../constants/Colors";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground, marginBottom: 6 }}>{title}</Text>
    {children}
  </View>
);

export default function TermsPrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Pressable onPress={() => router.replace("/(tabs)/profile" as any)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Terms & Privacy</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>Our terms of service and privacy policy</Text>
          </View>
        </View>

        {/* Terms of Service */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <View style={{ padding: 8, borderRadius: 10, backgroundColor: Colors.primary + "1A" }}>
              <FileText size={22} color={Colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: Colors.foreground }}>Terms of Service</Text>
          </View>
          <View style={{ gap: 16 }}>
            <Section title="1. Acceptance of Terms">
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 20 }}>
                By accessing and using the Generational Wealth Society (GWS) application, you accept and agree to be bound by the terms and provision of this agreement.
              </Text>
            </Section>
            <Section title="2. Membership">
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 20 }}>
                Membership to GWS is by invitation only. All members must maintain professional conduct and respect the privacy and confidentiality of other members.
              </Text>
            </Section>
            <Section title="3. User Content">
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 20 }}>
                Members are responsible for the content they share on the platform. Content must be appropriate, lawful, and respectful of others.
              </Text>
            </Section>
            <Section title="4. Intellectual Property">
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 20 }}>
                All content, features, and functionality of the GWS app are owned by Karman Beyond and are protected by international copyright, trademark, and other intellectual property laws.
              </Text>
            </Section>
          </View>
        </View>

        {/* Privacy Policy */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <View style={{ padding: 8, borderRadius: 10, backgroundColor: Colors.primary + "1A" }}>
              <Shield size={22} color={Colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: Colors.foreground }}>Privacy Policy</Text>
          </View>
          <View style={{ gap: 16 }}>
            <Section title="Information We Collect">
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 20 }}>
                We collect information you provide directly to us, including your name, email address, company information, and professional interests. We also collect information about your usage of the platform.
              </Text>
            </Section>
            <Section title="How We Use Your Information">
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 20 }}>
                We use the information we collect to provide, maintain, and improve our services, to communicate with you, and to facilitate connections between members.
              </Text>
            </Section>
            <Section title="Information Sharing">
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 20 }}>
                Your profile information is visible to other approved members of the GWS community. We do not sell or share your personal information with third parties for marketing purposes.
              </Text>
            </Section>
            <Section title="Data Security">
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 20 }}>
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
              </Text>
            </Section>
            <Section title="Your Rights">
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 20 }}>
                You have the right to access, correct, or delete your personal information. You can also control your privacy settings through the app's Privacy & Security section.
              </Text>
            </Section>
          </View>
        </View>

        {/* Contact */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 6 }}>
            Questions about our Terms or Privacy Policy?
          </Text>
          <Text style={{ fontSize: 13, color: Colors.primary, marginBottom: 12 }}>
            Contact us at gws@karmanbeyond.com
          </Text>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>Last updated: October 2025</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

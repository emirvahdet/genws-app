import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Colors } from "../constants/Colors";

const GCard = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
    {title && (
      <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 10 }}>{title}</Text>
    )}
    {children}
  </View>
);

const Body = ({ text }: { text: string }) => (
  <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 22 }}>{text}</Text>
);

export default function GuidebookScreen() {
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
          <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Society Guidebook</Text>
        </View>

        {/* A Note Before You Begin */}
        <GCard>
          <Text style={{ fontSize: 16, fontWeight: "600", color: Colors.foreground, marginBottom: 10 }}>
            A Note Before You Begin
          </Text>
          <Body text="If you're reading this, it means you are a committed member to the Generational Wealth Society." />
          <View style={{ height: 10 }} />
          <Body text="This guide is here to give you clarity — not rules for the sake of rules, but shared principles that make the experience meaningful for everyone involved. Think of it as a common understanding of how The Society works, what we value, and what we expect from one another." />
        </GCard>

        {/* What GWS Is About */}
        <GCard title="What GWS Is About">
          <Body text="The Generational Wealth Society is built for NextGen individuals who are navigating wealth alongside responsibility, family dynamics, and long-term decision-making." />
          <View style={{ height: 10 }} />
          <Body text="It is not designed as a social club or an event platform. Instead, it's a long-term environment for learning, reflection, and connection — one that grows through the people who participate in it." />
          <View style={{ height: 10 }} />
          <Body text="The value of The Society comes from continuity, trust, and shared context rather than one-off moments." />
        </GCard>

        {/* Who The Society Is Designed For */}
        <GCard title="Who The Society Is Designed For">
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 22 }}>
            GWS is intended for family members between{" "}
            <Text style={{ fontWeight: "700", color: Colors.foreground }}>21 and 40 years old</Text>
            {", from the "}
            <Text style={{ fontWeight: "700", color: Colors.foreground }}>second generation onward</Text>
            {", who are either already involved in — or preparing to step into — roles connected to family wealth, enterprise, or governance."}
          </Text>
          <View style={{ height: 10 }} />
          <Body text="Beyond age or background, what matters most is alignment: a willingness to learn, respect discretion, and contribute for collective growth." />
        </GCard>

        {/* How We Relate to One Another */}
        <GCard title="How We Relate to One Another">
          <Body text="The Society operates on the idea of a circle of equals." />
          <View style={{ height: 10 }} />
          <Body text="No one is here to impress. No one is expected to explain their background or justify their reality. What matters is how we show up. Honest conversations, differing perspectives, and shared experiences are encouraged. Judgment, posturing, or unnecessary drama are not part of the culture we're building." />
        </GCard>

        {/* Privacy & Discretion */}
        <GCard title="Privacy & Discretion">
          <Body text="Discretion is fundamental to The Society." />
          <View style={{ height: 10 }} />
          <Body text="What is shared within GWS — whether conversations, personal stories, or moments — stays within The Society. This includes not sharing details externally and being mindful of others' comfort levels." />
          <View style={{ height: 10 }} />
          <Body text="If photos or videos are considered, it's always good practice to ask first. Member and attendee lists are not shared, and we expect members to honor this standard consistently." />
        </GCard>

        {/* Engagement & Responsibility */}
        <GCard title="Engagement & Responsibility">
          <Body text="Membership in GWS implies a level of engagement." />
          <View style={{ height: 10 }} />
          <Body text="The Society is intentionally kept limited in size to preserve quality and depth. For that reason, prolonged inactivity may lead to a review of membership status, as space is reserved for those who wish to participate actively over time." />
        </GCard>

        {/* Events & Experiences */}
        <GCard title="Events & Experiences">
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 22 }}>
            {"All gatherings and experiences are communicated through the "}
            <Text style={{ fontWeight: "700", color: Colors.foreground }}>GWS App</Text>
            {"."}
          </Text>
          <View style={{ height: 10 }} />
          <Body text="Some events are open to the broader community, while others are curated for smaller groups based on interest, theme, or format. When capacity is limited, spots are allocated on a first-come basis." />
          <View style={{ height: 10 }} />
          <Body text="Certain experiences may involve an additional cost, which will always be communicated clearly in advance. Participation in these events is optional." />
          <View style={{ height: 10 }} />
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 22 }}>
            {"Occasionally, events may be designated as "}
            <Text style={{ fontWeight: "700", color: Colors.foreground }}>+1 experiences</Text>
            {", where partners or guests are welcome. Outside of those formats, members who wish to engage more consistently with close connections are encouraged to suggest them for membership."}
          </Text>
        </GCard>

        {/* Commitments & Cancellations */}
        <GCard title="Commitments & Cancellations">
          <Body text="Registering for an event means committing to attend." />
          <View style={{ height: 10 }} />
          <Body text="If plans change, members are expected to update their status through the app so that another member may take the spot. For paid events, the specific cancellation terms outlined on the event page will apply." />
        </GCard>

        {/* Using the GWS App */}
        <GCard title="Using the GWS App">
          <Body text="The App is the primary space where The Society operates." />
          <View style={{ height: 10 }} />
          <Body text="Through it, you can follow the evolving agenda, register for events, access content, and manage your profile. You'll also find a dedicated message area on the home page where you can share questions, ideas, or requests — visible only to the GWS team." />
          <View style={{ height: 10 }} />
          <Body text="For any additional support, you can reach out directly via WhatsApp." />
        </GCard>
      </ScrollView>
    </SafeAreaView>
  );
}

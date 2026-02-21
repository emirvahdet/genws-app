import { View, Text, Pressable, ActivityIndicator, TextInput, Alert } from "react-native";
import { Check } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

export interface EventRegButtonProps {
  event: {
    id: string;
    status: string[];
    price_charged_via_app?: boolean;
    is_restricted?: boolean;
    rsvp_date?: string;
  };
  isRegistered: boolean;
  isWaitingList: boolean;
  hasVerifiedAttendance: boolean;
  registering: boolean;
  registration: any;
  plusOneGuest: { name: string; email: string } | null;
  plusOneName: string;
  plusOneEmail: string;
  showPlusOneForm: boolean;
  savingPlusOne: boolean;
  onRegister: () => void;
  onCancelPress: () => void;
  onSavePlusOne: () => void;
  onRemovePlusOne: () => void;
  onShowPlusOneForm: (show: boolean) => void;
  onPlusOneNameChange: (v: string) => void;
  onPlusOneEmailChange: (v: string) => void;
}

export function EventRegButton({
  event,
  isRegistered,
  isWaitingList,
  hasVerifiedAttendance,
  registering,
  registration,
  plusOneGuest,
  plusOneName,
  plusOneEmail,
  showPlusOneForm,
  savingPlusOne,
  onRegister,
  onCancelPress,
  onSavePlusOne,
  onRemovePlusOne,
  onShowPlusOneForm,
  onPlusOneNameChange,
  onPlusOneEmailChange,
}: EventRegButtonProps) {
  const fb = event.status.includes("Fully Booked");
  const rc = event.status.includes("Registration Closed");
  const hw = event.status.includes("Waitlist");
  const isPreReg = event.status.includes("Pre-Registration");
  const isCB = event.status.includes("Cost Bearing Event");

  const PBtn = ({
    label,
    onPress,
    outline = false,
    disabled = false,
  }: {
    label: string;
    onPress?: () => void;
    outline?: boolean;
    disabled?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled || registering}
      style={({ pressed }) => ({
        borderWidth: 2,
        borderColor: disabled ? "#999" : Colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        backgroundColor: disabled ? "#999" : outline ? "white" : Colors.primary,
        opacity: pressed && !disabled ? 0.85 : 1,
      })}
    >
      {registering && !disabled ? (
        <ActivityIndicator size="small" color={outline ? "#00451a" : "white"} />
      ) : (
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: disabled ? "white" : outline ? "#00451a" : "white",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );

  const SBtn = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        backgroundColor: Colors.muted,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 15, fontWeight: "500", color: Colors.foreground }}>{label}</Text>
    </Pressable>
  );

  const ImIn = ({ label }: { label: string }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 12,
      }}
    >
      <Check size={20} color={Colors.primary} />
      <Text
        style={{
          fontSize: 14,
          fontWeight: "500",
          color: Colors.primary,
          textAlign: "center",
          flex: 1,
        }}
      >
        {label}
      </Text>
    </View>
  );

  const PlusOneSection = () => (
    <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16, gap: 10 }}>
      {plusOneGuest ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Check size={16} color={Colors.primary} />
            <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.primary }}>+1 Guest Added</Text>
          </View>
          <View style={{ backgroundColor: Colors.muted, borderRadius: 8, padding: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground }}>{plusOneGuest.name}</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{plusOneGuest.email}</Text>
          </View>
          <Pressable
            onPress={onRemovePlusOne}
            disabled={savingPlusOne}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: 10,
              paddingVertical: 10,
              alignItems: "center",
              opacity: pressed || savingPlusOne ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 14, color: Colors.foreground }}>
              {savingPlusOne ? "Removing..." : "Remove +1 Guest"}
            </Text>
          </Pressable>
        </View>
      ) : showPlusOneForm ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground }}>+1 Guest Details</Text>
          <TextInput
            style={{
              backgroundColor: Colors.input,
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 15,
              color: Colors.foreground,
            }}
            placeholder="Guest Name"
            placeholderTextColor={Colors.mutedForeground}
            value={plusOneName}
            onChangeText={onPlusOneNameChange}
          />
          <TextInput
            style={{
              backgroundColor: Colors.input,
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 15,
              color: Colors.foreground,
            }}
            placeholder="Guest Email"
            placeholderTextColor={Colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            value={plusOneEmail}
            onChangeText={onPlusOneEmailChange}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => {
                onShowPlusOneForm(false);
                onPlusOneNameChange("");
                onPlusOneEmailChange("");
              }}
              disabled={savingPlusOne}
              style={({ pressed }) => ({
                flex: 1,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: Colors.foreground }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSavePlusOne}
              disabled={savingPlusOne || !plusOneName.trim() || !plusOneEmail.trim()}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: Colors.primary,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: "center",
                opacity: pressed || savingPlusOne ? 0.7 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>
                {savingPlusOne ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => onShowPlusOneForm(true)}
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderWidth: 1.5,
              borderColor: Colors.border,
              borderRadius: 4,
            }}
          />
          <Text style={{ fontSize: 14, color: "#324750", flex: 1 }}>
            I am bringing a +1 who is NOT a GWS member
          </Text>
        </Pressable>
      )}
    </View>
  );

  // ── Fully Booked ──────────────────────────────────────────────────────────
  if (fb) {
    if (isRegistered)
      return (
        <View style={{ gap: 10 }}>
          <ImIn
            label={
              isWaitingList
                ? "You are on the Waitlist. We'll notify you when a spot opens."
                : "I'm In"
            }
          />
          <SBtn
            label={isWaitingList ? "Leave the Waitlist" : "Oops, my plans changed!"}
            onPress={onCancelPress}
          />
        </View>
      );
    if (hw)
      return (
        <View style={{ gap: 10 }}>
          <PBtn label="Fully Booked" disabled />
          <PBtn label="Join the Waitlist" onPress={onRegister} outline />
        </View>
      );
    return <PBtn label="Fully Booked" disabled />;
  }

  // ── Registration Closed ───────────────────────────────────────────────────
  if (rc) {
    if (isRegistered)
      return <ImIn label={isWaitingList ? "You are on the Waitlist" : "I'm In"} />;
    return <PBtn label="Registration Closed" disabled />;
  }

  // ── Already registered ────────────────────────────────────────────────────
  if (isRegistered) {
    if (
      registration?.refund_requested &&
      !registration?.refund_processed &&
      event.price_charged_via_app
    )
      return (
        <View style={{ gap: 8 }}>
          <ImIn label={isWaitingList ? "You are on the Waitlist" : "I am in!"} />
          <PBtn label="Cancellation Pending" disabled />
          <Text
            style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center" }}
          >
            Waiting for approval – refund will be processed after admin approval
          </Text>
        </View>
      );

    if (hasVerifiedAttendance) return null;

    return (
      <View style={{ gap: 10 }}>
        <ImIn
          label={
            isCB && !event.price_charged_via_app
              ? "Thanks for your interest. We will get in touch with you via email to confirm your registration."
              : isWaitingList
              ? "You are on the Waitlist. We'll notify you when a spot opens."
              : "I'm In"
          }
        />
        {event.status.includes("+1 Event") && !isWaitingList && <PlusOneSection />}
        <SBtn
          label={isWaitingList ? "Leave the Waitlist" : "Oops, my plans changed!"}
          onPress={onCancelPress}
        />
      </View>
    );
  }

  // ── Restricted / RSVP expired ─────────────────────────────────────────────
  if (
    event.is_restricted &&
    event.rsvp_date &&
    new Date() > new Date(event.rsvp_date)
  )
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: Colors.primary,
          borderRadius: 12,
          padding: 16,
          backgroundColor: "#f5f5f5",
        }}
      >
        <Text
          style={{ fontSize: 14, fontWeight: "500", color: "#666", textAlign: "center" }}
        >
          Registration Closed
        </Text>
      </View>
    );

  // ── Waitlist only ─────────────────────────────────────────────────────────
  if (hw) return <PBtn label="Join the Waitlist" onPress={onRegister} outline />;

  // ── Default register ──────────────────────────────────────────────────────
  return (
    <PBtn
      label={isPreReg ? "Pre-register for Event" : "Register for Event"}
      onPress={onRegister}
      outline
    />
  );
}

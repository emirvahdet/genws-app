import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { QrCode, X } from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface AttendanceBarcodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  userId: string;
  userName: string;
  memberId?: string;
}

export const AttendanceBarcodeModal = ({
  open,
  onOpenChange,
  eventId,
  userId,
  userName,
  memberId,
}: AttendanceBarcodeModalProps) => {
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && eventId && userId) {
      fetchOrCreateQRCode();
    }
  }, [open, eventId, userId]);

  const fetchOrCreateQRCode = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_or_create_event_barcode", {
        p_user_id: userId,
        p_event_id: eventId,
      });
      if (error) throw error;
      setQrValue(data);
    } catch (error: unknown) {
      __DEV__ && console.log("Error fetching QR code:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={() => onOpenChange(false)}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: Colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 40,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <QrCode size={20} color={Colors.foreground} />
              <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.foreground }}>
                For Attendance
              </Text>
            </View>
            <Pressable
              onPress={() => onOpenChange(false)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <X size={22} color={Colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={{ alignItems: "center", gap: 16 }}>
            {loading ? (
              <View style={{ height: 208, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : qrValue ? (
              <>
                {/* QR Code */}
                <View
                  style={{
                    backgroundColor: "white",
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                >
                  <QRCode value={qrValue} size={200} />
                </View>

                {/* User Info */}
                <View style={{ alignItems: "center", gap: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.foreground }}>
                    {userName}
                  </Text>
                  {memberId && (
                    <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>
                      Member ID: {memberId}
                    </Text>
                  )}
                </View>

                {/* Instructions */}
                <View
                  style={{
                    backgroundColor: Colors.muted,
                    borderRadius: 12,
                    padding: 16,
                    width: "100%",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: Colors.mutedForeground,
                      textAlign: "center",
                    }}
                  >
                    Present this QR code to The Team at the event entrance for attendance verification.
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>
                Unable to generate QR code
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

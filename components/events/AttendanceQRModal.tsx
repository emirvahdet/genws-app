import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { X } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface AttendanceQRModalProps {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  userId: string;
  userName: string;
  memberId?: string;
}

export function AttendanceQRModal({
  visible,
  onClose,
  eventId,
  userId,
  userName,
  memberId,
}: AttendanceQRModalProps) {
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && eventId && userId) {
      fetchOrCreateQRCode();
    }
  }, [visible, eventId, userId]);

  const fetchOrCreateQRCode = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_or_create_event_barcode", {
        p_user_id: userId,
        p_event_id: eventId,
      });

      if (error) throw error;
      setQrValue(data);
    } catch (error) {
      console.error("Error fetching QR code:", error);
      setQrValue(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>For Attendance</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <X size={24} color={Colors.foreground} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : qrValue ? (
              <>
                {/* QR Code */}
                <View style={styles.qrContainer}>
                  <QRCode value={qrValue} size={220} />
                </View>

                {/* User Info */}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{userName}</Text>
                  {memberId && (
                    <Text style={styles.memberId}>Member ID: {memberId}</Text>
                  )}
                </View>

                {/* Instructions */}
                <View style={styles.instructions}>
                  <Text style={styles.instructionsText}>
                    Present this QR code to The Team at the event entrance for
                    attendance verification.
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.errorText}>Unable to generate QR code</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  container: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.foreground,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  loadingContainer: {
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
  qrContainer: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    marginTop: 20,
    alignItems: "center",
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.foreground,
  },
  memberId: {
    fontSize: 13,
    color: Colors.mutedForeground,
  },
  instructions: {
    marginTop: 20,
    backgroundColor: Colors.muted,
    padding: 16,
    borderRadius: 10,
    width: "100%",
  },
  instructionsText: {
    fontSize: 13,
    color: Colors.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: Colors.mutedForeground,
    padding: 40,
  },
});

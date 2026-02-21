import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Camera, CameraView } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import {
  QrCode,
  ScanLine,
  CheckCircle,
  ArrowLeft,
  X,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface NetworkingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  userId: string;
}

type ModalView = "menu" | "show-qr" | "scan-qr";

const CODE_DURATION_SECONDS = 60;

const NetworkingModal: React.FC<NetworkingModalProps> = ({
  open,
  onOpenChange,
  eventId,
  userId,
}) => {
  const [view, setView] = useState<ModalView>("menu");
  const [matchCode, setMatchCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(CODE_DURATION_SECONDS);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [connectedMemberName, setConnectedMemberName] = useState<string>("");
  const [scanned, setScanned] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (open) {
      setView("menu");
      setTimeLeft(CODE_DURATION_SECONDS);
      setShowSuccess(false);
      setConnectedMemberName("");
      setScanned(false);
      clearTimers();
    } else {
      clearTimers();
    }
    return () => clearTimers();
  }, [open, clearTimers]);

  // Realtime subscription when showing QR
  useEffect(() => {
    if (view !== "show-qr" || !open) return;

    const channel = supabase
      .channel("networking-connection")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "network_connections" },
        async (payload) => {
          const conn = payload.new as { user1_id: string; user2_id: string; event_id: string };
          if (
            conn.event_id === eventId &&
            (conn.user1_id === userId || conn.user2_id === userId)
          ) {
            const otherUserId = conn.user1_id === userId ? conn.user2_id : conn.user1_id;
            const { data: profile } = await supabase
              .from("public_profiles")
              .select("full_name")
              .eq("id", otherUserId)
              .single();
            setConnectedMemberName(profile?.full_name || "a member");
            setShowSuccess(true);
            clearTimers();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [view, open, eventId, userId, clearTimers]);

  const generateNewCode = useCallback(async () => {
    setLoading(true);
    try {
      await supabase
        .from("event_match_codes")
        .delete()
        .eq("user_id", userId)
        .eq("event_id", eventId);

      const { data, error } = await supabase.rpc("get_or_create_match_code", {
        p_user_id: userId,
        p_event_id: eventId,
      });
      if (error) throw error;
      setMatchCode(data);
      setTimeLeft(CODE_DURATION_SECONDS);
    } catch (error: unknown) {
      __DEV__ && console.log("Error generating match code:", error);
      Alert.alert("Error", "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  }, [userId, eventId]);

  // Countdown timer when showing QR
  useEffect(() => {
    if (view === "show-qr" && matchCode) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            generateNewCode();
            return CODE_DURATION_SECONDS;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearTimers();
    }
  }, [view, matchCode, generateNewCode, clearTimers]);

  const handleShowQR = async () => {
    setView("show-qr");
    await generateNewCode();
  };

  const handleScanQR = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(status === "granted");
    if (status !== "granted") {
      Alert.alert("Camera Permission", "Camera access is required to scan QR codes.");
      return;
    }
    setScanned(false);
    setView("scan-qr");
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || submitting) return;
    setScanned(true);
    setSubmitting(true);

    try {
      let extractedCode: string | null = null;
      const connectMatch = data.match(/CONNECT-[^-]+-(\d{5})/);
      if (connectMatch) {
        extractedCode = connectMatch[1];
      } else if (/^\d{5}$/.test(data)) {
        extractedCode = data;
      }

      if (!extractedCode) {
        Alert.alert("Invalid QR", "This QR code is not a valid networking code.");
        setScanned(false);
        setSubmitting(false);
        return;
      }

      const { data: result, error } = await supabase.rpc("match_users_by_code", {
        p_user_id: userId,
        p_event_id: eventId,
        p_code: extractedCode,
      });

      if (error) throw error;

      const matchResult = result as { success: boolean; error?: string; matched_user_id?: string };

      if (matchResult.success && matchResult.matched_user_id) {
        const { data: profile } = await supabase
          .from("public_profiles")
          .select("full_name")
          .eq("id", matchResult.matched_user_id)
          .single();
        setConnectedMemberName(profile?.full_name || "a member");
        setShowSuccess(true);
      } else {
        Alert.alert("Error", matchResult.error || "Failed to match");
        setView("menu");
      }
    } catch (error: unknown) {
      __DEV__ && console.log("Error matching:", error);
      Alert.alert("Error", "Failed to process QR code");
      setView("menu");
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent = (timeLeft / CODE_DURATION_SECONDS) * 100;
  const qrValue = matchCode ? `CONNECT-${eventId.substring(0, 8)}-${matchCode}` : "";

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={() => onOpenChange(false)}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: Colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 40,
            minHeight: 400,
          }}
        >
          {showSuccess ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 24 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: Colors.primary + "1A",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle size={48} color={Colors.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "500", color: Colors.foreground, textAlign: "center" }}>
                {connectedMemberName} is now in your circle.
              </Text>
              <Pressable
                onPress={() => onOpenChange(false)}
                style={({ pressed }) => ({
                  backgroundColor: Colors.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
                {(view === "show-qr" || view === "scan-qr") && (
                  <Pressable
                    onPress={() => {
                      if (view === "scan-qr") setScanned(false);
                      setView("menu");
                    }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 12 })}
                  >
                    <ArrowLeft size={22} color={Colors.foreground} />
                  </Pressable>
                )}
                <Text style={{ flex: 1, fontSize: 18, fontWeight: "600", color: Colors.foreground, textAlign: "center" }}>
                  {view === "menu" && "Connect"}
                  {view === "show-qr" && "For Connections"}
                  {view === "scan-qr" && "Scan QR Code"}
                </Text>
                <Pressable
                  onPress={() => onOpenChange(false)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <X size={22} color={Colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Menu View */}
              {view === "menu" && (
                <View style={{ gap: 12 }}>
                  <Pressable
                    onPress={handleShowQR}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 16,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 12,
                      padding: 16,
                      height: 72,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + "1A", alignItems: "center", justifyContent: "center" }}>
                      <QrCode size={20} color={Colors.primary} />
                    </View>
                    <View>
                      <Text style={{ fontWeight: "500", color: Colors.foreground }}>Show my QR code</Text>
                      <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Let someone scan to connect</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={handleScanQR}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 16,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 12,
                      padding: 16,
                      height: 72,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + "1A", alignItems: "center", justifyContent: "center" }}>
                      <ScanLine size={20} color={Colors.primary} />
                    </View>
                    <View>
                      <Text style={{ fontWeight: "500", color: Colors.foreground }}>Scan a QR code</Text>
                      <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Connect with another member</Text>
                    </View>
                  </Pressable>
                </View>
              )}

              {/* Show QR View */}
              {view === "show-qr" && (
                <View style={{ alignItems: "center", gap: 16, paddingVertical: 16 }}>
                  {loading ? (
                    <View style={{ height: 200, alignItems: "center", justifyContent: "center" }}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                  ) : (
                    <>
                      <View style={{ backgroundColor: "white", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }}>
                        <QRCode value={qrValue || " "} size={200} />
                      </View>

                      {/* Countdown bar */}
                      <View style={{ width: "100%", gap: 8 }}>
                        <View style={{ height: 8, backgroundColor: Colors.muted, borderRadius: 4, overflow: "hidden" }}>
                          <View
                            style={{
                              height: "100%",
                              backgroundColor: Colors.primary,
                              borderRadius: 4,
                              width: `${progressPercent}%`,
                            }}
                          />
                        </View>
                        <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center" }}>
                          QR code refreshes in {timeLeft}s
                        </Text>
                      </View>

                      <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center" }}>
                        Let another member scan this QR code to connect
                      </Text>
                    </>
                  )}
                </View>
              )}

              {/* Scan QR View */}
              {view === "scan-qr" && (
                <View style={{ alignItems: "center", gap: 16, paddingVertical: 16 }}>
                  {submitting ? (
                    <View style={{ height: 250, alignItems: "center", justifyContent: "center", gap: 16 }}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                      <Text style={{ color: Colors.mutedForeground }}>Connecting...</Text>
                    </View>
                  ) : hasCameraPermission === false ? (
                    <View style={{ alignItems: "center", gap: 16 }}>
                      <Text style={{ color: Colors.destructive, textAlign: "center" }}>
                        Camera permission denied. Please allow camera access and try again.
                      </Text>
                      <Pressable
                        onPress={handleScanQR}
                        style={({ pressed }) => ({
                          borderWidth: 1,
                          borderColor: Colors.border,
                          borderRadius: 12,
                          paddingVertical: 12,
                          paddingHorizontal: 24,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ color: Colors.foreground }}>Try Again</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <View
                        style={{
                          width: 280,
                          height: 280,
                          borderRadius: 12,
                          overflow: "hidden",
                          backgroundColor: "black",
                        }}
                      >
                        <CameraView
                          style={{ flex: 1 }}
                          facing="back"
                          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        />
                        {/* Scanning overlay */}
                        <View
                          style={{
                            position: "absolute",
                            inset: 0,
                            top: "15%",
                            left: "15%",
                            right: "15%",
                            bottom: "15%",
                            borderWidth: 2,
                            borderColor: "rgba(255,255,255,0.5)",
                            borderRadius: 8,
                          }}
                        />
                      </View>
                      <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center" }}>
                        Point camera at another member's QR code
                      </Text>
                    </>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default NetworkingModal;

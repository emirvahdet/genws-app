import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ArrowLeft, Check, AlertCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../../../lib/supabase";
import { Colors } from "../../../constants/Colors";

interface ScanResult {
  success: boolean;
  message: string;
  userName?: string;
}

export default function EventScannerScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scannedCodes, setScannedCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const verifyCode = async (code: string) => {
    // Prevent duplicate scans of the same code
    if (scannedCodes.has(code) || scanning) return;
    
    setScanning(true);
    setResult(null);
    setScannedCodes(prev => new Set(prev).add(code));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.rpc("verify_attendance_by_barcode", {
        p_barcode: code,
        p_admin_id: user.id
      });

      if (error) throw error;

      const resultData = data as { success: boolean; error?: string; user_id?: string; event_id?: string };

      if (resultData.success) {
        // Get user name
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", resultData.user_id)
          .single();

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResult({
          success: true,
          message: "Attendance verified successfully!",
          userName: profile?.full_name
        });

        // Clear result after 2 seconds to allow continuous scanning
        setTimeout(() => {
          setResult(null);
        }, 2000);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResult({
          success: false,
          message: resultData.error || "Invalid QR code"
        });

        // Clear error after 3 seconds
        setTimeout(() => {
          setResult(null);
          setScannedCodes(prev => {
            const newSet = new Set(prev);
            newSet.delete(code);
            return newSet;
          });
        }, 3000);
      }
    } catch (error: any) {
      console.error("Error verifying QR code:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({
        success: false,
        message: error.message || "Failed to verify QR code"
      });

      setTimeout(() => {
        setResult(null);
        setScannedCodes(prev => {
          const newSet = new Set(prev);
          newSet.delete(code);
          return newSet;
        });
      }, 3000);
    } finally {
      setScanning(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (!scanning && !result) {
      verifyCode(data);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <AlertCircle size={48} color={Colors.mutedForeground} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Please grant camera access to scan QR codes for attendance verification.
          </Text>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [
              styles.permissionButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/(admin)/events?openGuestList=${eventId}` as any)}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push(`/(admin)/events?openGuestList=${eventId}` as any)}
          style={({ pressed }) => [
            styles.headerButton,
            { opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <ArrowLeft size={20} color="white" />
          <Text style={styles.headerButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Scan Attendance</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={handleBarCodeScanned}
        >
          {/* Scanning Frame */}
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
          </View>

          {/* Result Display */}
          {result && (
            <View style={styles.resultContainer}>
              <View
                style={[
                  styles.resultBox,
                  result.success ? styles.resultSuccess : styles.resultError
                ]}
              >
                {result.success ? (
                  <Check size={32} color="#16a34a" />
                ) : (
                  <AlertCircle size={32} color="#dc2626" />
                )}
                <View style={styles.resultTextContainer}>
                  <Text
                    style={[
                      styles.resultMessage,
                      result.success ? styles.resultMessageSuccess : styles.resultMessageError
                    ]}
                  >
                    {result.message}
                  </Text>
                  {result.userName && (
                    <Text style={styles.resultUserName}>{result.userName}</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Scanning Indicator */}
          {scanning && (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.scanningText}>Verifying...</Text>
            </View>
          )}
        </CameraView>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How to scan:</Text>
        <Text style={styles.instructionsText}>
          1. Ask attendee to show their QR code{"\n"}
          2. Center the QR code in the frame{"\n"}
          3. Wait for automatic verification{"\n"}
          4. Continue scanning next attendee
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 80,
  },
  headerButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: Colors.primary,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  resultContainer: {
    position: "absolute",
    top: 120,
    left: 16,
    right: 16,
  },
  resultBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  resultSuccess: {
    backgroundColor: "rgba(220, 252, 231, 0.95)",
    borderColor: "#16a34a",
  },
  resultError: {
    backgroundColor: "rgba(254, 226, 226, 0.95)",
    borderColor: "#dc2626",
  },
  resultTextContainer: {
    flex: 1,
  },
  resultMessage: {
    fontSize: 15,
    fontWeight: "600",
  },
  resultMessageSuccess: {
    color: "#16a34a",
  },
  resultMessageError: {
    color: "#dc2626",
  },
  resultUserName: {
    fontSize: 13,
    color: "#374151",
    marginTop: 2,
  },
  scanningIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  scanningText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  instructions: {
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 20,
    paddingBottom: 40,
  },
  instructionsTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  instructionsText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 22,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.foreground,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 15,
    color: Colors.mutedForeground,
    textAlign: "center",
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    color: Colors.mutedForeground,
    fontSize: 14,
  },
});

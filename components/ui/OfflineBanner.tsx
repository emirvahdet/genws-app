import { View, Text, StyleSheet } from "react-native";
import { AlertCircle } from "lucide-react-native";

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <AlertCircle size={16} color="#92400e" />
      <Text style={styles.text}>You're offline — showing saved data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
  },
  text: {
    fontSize: 13,
    color: "#92400e",
    fontWeight: "500",
  },
});

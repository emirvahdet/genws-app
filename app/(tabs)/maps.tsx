import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../constants/Colors";

export default function MapsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "600", color: Colors.foreground }}>
          Member Maps
        </Text>
        <Text style={{ fontSize: 14, color: Colors.mutedForeground, marginTop: 8 }}>
          Coming soon
        </Text>
      </View>
    </SafeAreaView>
  );
}

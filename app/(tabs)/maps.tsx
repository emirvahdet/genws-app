import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MapsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Map temporarily disabled</Text>
      </View>
    </SafeAreaView>
  );
}

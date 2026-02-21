import { View, Text } from "react-native";
import { MobileLayout } from "../../components/layout/MobileLayout";

export default function MapsScreen() {
  return (
    <MobileLayout>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Map temporarily disabled</Text>
      </View>
    </MobileLayout>
  );
}

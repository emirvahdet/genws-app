import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-bold">GenWS App</Text>
        <Text className="text-gray-500 mt-2">Kurulum başarılı!</Text>
      </View>
    </SafeAreaView>
  );
}

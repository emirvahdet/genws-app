import { Stack } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { Colors } from "../../constants/Colors";

export default function AdminLayout() {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

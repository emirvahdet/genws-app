import { useViewAs } from "../../stores/ViewAsContext";
import { useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Eye } from "lucide-react-native";
import { Colors } from "../../constants/Colors";

export const ViewAsBanner = () => {
  const { viewAsUser, isViewingAs, stopViewAs } = useViewAs();
  const router = useRouter();

  if (!isViewingAs || !viewAsUser) return null;

  const handleClose = () => {
    stopViewAs();
    router.push("/(admin)/members" as any);
  };

  return (
    <SafeAreaView 
      style={{ 
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: "#f59e0b", // amber-500
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
      edges={["top"]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <Eye size={16} color="#000" />
        <Text style={{ fontSize: 14, fontWeight: "500", color: "#000", flex: 1 }} numberOfLines={1}>
          Viewing as: <Text style={{ fontWeight: "700" }}>{viewAsUser.full_name}</Text>
        </Text>
      </View>
      <Pressable
        onPress={handleClose}
        style={({ pressed }) => ({ 
          padding: 4,
          borderRadius: 4,
          backgroundColor: pressed ? "#d97706" : "transparent", // amber-600 on press
          flexShrink: 0
        })}
      >
        <X size={16} color="#000" />
      </Pressable>
    </SafeAreaView>
  );
};

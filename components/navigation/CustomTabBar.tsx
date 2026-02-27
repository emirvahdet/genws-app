import { View, Pressable, Image, Text } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { MapPin, Calendar, Newspaper, User } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "../../constants/Colors";

const TAB_COLOR = "#324750";
const ACTIVE_COLOR = Colors.primary;
const GREEN_BAR = "#00451a";

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={{ backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border + "80" }}>
      <View style={{ flexDirection: "row", height: 64, paddingTop: 2 }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(route.name);
            }
          };

          // Only show the 5 main tabs
          if (index > 4) return null;

          const iconColor = isFocused ? ACTIVE_COLOR : TAB_COLOR;
          const iconSize = 24;

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", position: "relative" }}
            >
              {/* Icon and Label */}
              <View style={{ alignItems: "center", justifyContent: "center", gap: 1 }}>
                {index === 0 && <MapPin size={iconSize} color={iconColor} />}
                {index === 1 && <Calendar size={iconSize} color={iconColor} />}
                {index === 2 && (
                  <View style={{ paddingTop: 0 }}>
                    <Image
                      source={require("../../assets/images/gws-qr-icon.png")}
                      style={{ width: 40, height: 40, borderRadius: 6 }}
                      resizeMode="cover"
                    />
                  </View>
                )}
                {index === 3 && <Newspaper size={iconSize} color={iconColor} />}
                {index === 4 && <User size={iconSize} color={iconColor} />}
                
                {/* Label */}
                {index !== 2 && (
                  <Text style={{ fontSize: 10, fontWeight: "500", color: iconColor }}>
                    {index === 0 && "Map"}
                    {index === 1 && "Events"}
                    {index === 3 && "News"}
                    {index === 4 && "Profile"}
                  </Text>
                )}
              </View>

                          </Pressable>
          );
        })}
      </View>
      {/* Green bottom bar with white gap for active tab */}
      <View style={{ height: 7, flexDirection: "row" }}>
        {state.routes.slice(0, 5).map((route, index) => {
          const isActive = state.index === index;
          const tabWidth = 52; // Same as white indicator width
          const gapWidth = 52; // Gap width for active tab
          
          return (
            <View key={route.key} style={{ flex: 1 }}>
              {isActive ? (
                <View style={{ 
                  flex: 1, 
                  flexDirection: "row",
                  alignItems: "flex-end"
                }}>
                  <View style={{ flex: 1, height: 7, backgroundColor: GREEN_BAR }} />
                  <View style={{ width: gapWidth, height: 7, backgroundColor: "white" }} />
                  <View style={{ flex: 1, height: 7, backgroundColor: GREEN_BAR }} />
                </View>
              ) : (
                <View style={{ flex: 1, height: 7, backgroundColor: GREEN_BAR }} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

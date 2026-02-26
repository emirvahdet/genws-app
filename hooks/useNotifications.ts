import { useState, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

// Set notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState("");
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        savePushTokenToSupabase(token, userId);
      }
    });

    // Listener for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      handleNotificationTap(data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [userId]);

  const handleNotificationTap = (data: any) => {
    // Navigate to relevant screen based on notification data
    if (data.event_id) {
      router.push(`/event/${data.event_id}`);
    } else if (data.news_id) {
      router.push(`/news/${data.news_id}`);
    } else if (data.screen) {
      router.push(data.screen);
    }
  };

  const savePushTokenToSupabase = async (token: string, userId: string) => {
    try {
      const platform = Platform.OS;

      // Check if token already exists
      const { data: existingToken } = await supabase
        .from("push_tokens")
        .select("id, token")
        .eq("user_id", userId)
        .eq("platform", platform)
        .single();

      if (existingToken) {
        // Update if token changed
        if (existingToken.token !== token) {
          await supabase
            .from("push_tokens")
            .update({ token, updated_at: new Date().toISOString() })
            .eq("id", existingToken.id);
          __DEV__ && console.log("Push token updated");
        }
      } else {
        // Insert new token
        await supabase.from("push_tokens").insert({
          user_id: userId,
          token,
          platform,
        });
        __DEV__ && console.log("Push token saved");
      }
    } catch (error) {
      __DEV__ && console.log("Error saving push token:", error);
    }
  };

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      __DEV__ && console.log("Failed to get push token for push notification!");
      return;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: "f8d72e1d-8643-4bbc-8a0d-4178f8f9720d",
      })).data;
    } catch (error) {
      __DEV__ && console.log("Error getting push token:", error);
    }
  } else {
    __DEV__ && console.log("Must use physical device for Push Notifications");
  }

  return token;
}

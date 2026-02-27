import { useState, useEffect } from "react";
import * as Network from "expo-network";

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    let isMounted = true;

    const checkNetworkStatus = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        
        if (isMounted) {
          setNetworkStatus({
            isConnected: state.isConnected ?? true,
            isInternetReachable: state.isInternetReachable ?? true,
          });
        }
      } catch (error) {
        __DEV__ && console.error("Error checking network status:", error);
        // Assume connected on error
        if (isMounted) {
          setNetworkStatus({
            isConnected: true,
            isInternetReachable: true,
          });
        }
      }
    };

    // Check immediately
    checkNetworkStatus();

    // Check periodically (every 5 seconds)
    const interval = setInterval(checkNetworkStatus, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return networkStatus;
}

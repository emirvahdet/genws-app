import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "offline_cache_";
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CachedData<T> {
  data: T;
  timestamp: number;
}

export async function cacheData<T>(key: string, data: T): Promise<void> {
  try {
    const cacheKey = CACHE_PREFIX + key;
    const cachedData: CachedData<T> = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData));
  } catch (error) {
    __DEV__ && console.error("Error caching data:", error);
  }
}

export async function getCachedData<T>(
  key: string,
  maxAge: number = DEFAULT_MAX_AGE
): Promise<T | null> {
  try {
    const cacheKey = CACHE_PREFIX + key;
    const cached = await AsyncStorage.getItem(cacheKey);
    
    if (!cached) {
      return null;
    }

    const cachedData: CachedData<T> = JSON.parse(cached);
    const age = Date.now() - cachedData.timestamp;

    if (age > maxAge) {
      // Cache expired, remove it
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }

    return cachedData.data;
  } catch (error) {
    __DEV__ && console.error("Error getting cached data:", error);
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    __DEV__ && console.error("Error clearing cache:", error);
  }
}

export async function removeCachedData(key: string): Promise<void> {
  try {
    const cacheKey = CACHE_PREFIX + key;
    await AsyncStorage.removeItem(cacheKey);
  } catch (error) {
    __DEV__ && console.error("Error removing cached data:", error);
  }
}

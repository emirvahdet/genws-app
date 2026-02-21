import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MapboxGL from "@rnmapbox/maps";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface LocationData {
  city: string;
  country: string;
  type: "user" | "event";
  id?: string;
  title?: string;
  coordinates?: string;
}

interface MarkerPoint {
  id: string;
  lng: number;
  lat: number;
  type: "user" | "event";
  label: string;
  eventId?: string;
  title?: string;
}

// District coordinates for major cities (same as webapp)
const CITY_DISTRICTS: Record<string, Array<{ name: string; lng: number; lat: number }>> = {
  "İstanbul, Türkiye": [
    { name: "Kadıköy", lng: 29.0321, lat: 40.9887 },
    { name: "Beşiktaş", lng: 29.0056, lat: 41.0421 },
    { name: "Üsküdar", lng: 29.0216, lat: 41.0224 },
    { name: "Beyoğlu", lng: 28.9744, lat: 41.0369 },
    { name: "Şişli", lng: 28.9869, lat: 41.0602 },
    { name: "Sarıyer", lng: 29.0465, lat: 41.1651 },
    { name: "Ataşehir", lng: 29.1265, lat: 40.9824 },
    { name: "Bakırköy", lng: 28.8734, lat: 40.9805 },
    { name: "Maltepe", lng: 29.1381, lat: 40.9358 },
    { name: "Kartal", lng: 29.1868, lat: 40.8986 },
  ],
  "Istanbul, Türkiye": [
    { name: "Kadıköy", lng: 29.0321, lat: 40.9887 },
    { name: "Beşiktaş", lng: 29.0056, lat: 41.0421 },
    { name: "Üsküdar", lng: 29.0216, lat: 41.0224 },
    { name: "Beyoğlu", lng: 28.9744, lat: 41.0369 },
    { name: "Şişli", lng: 28.9869, lat: 41.0602 },
    { name: "Sarıyer", lng: 29.0465, lat: 41.1651 },
    { name: "Ataşehir", lng: 29.1265, lat: 40.9824 },
    { name: "Bakırköy", lng: 28.8734, lat: 40.9805 },
    { name: "Maltepe", lng: 29.1381, lat: 40.9358 },
    { name: "Kartal", lng: 29.1868, lat: 40.8986 },
  ],
  "London, UK": [
    { name: "Westminster", lng: -0.1278, lat: 51.4975 },
    { name: "Camden", lng: -0.1426, lat: 51.5392 },
    { name: "Islington", lng: -0.1028, lat: 51.5465 },
    { name: "Kensington", lng: -0.1936, lat: 51.4991 },
    { name: "Tower Hamlets", lng: -0.0419, lat: 51.5203 },
    { name: "Southwark", lng: -0.0877, lat: 51.5035 },
    { name: "Greenwich", lng: 0.014, lat: 51.482 },
    { name: "Hackney", lng: -0.0553, lat: 51.545 },
  ],
  "London, United Kingdom": [
    { name: "Westminster", lng: -0.1278, lat: 51.4975 },
    { name: "Camden", lng: -0.1426, lat: 51.5392 },
    { name: "Islington", lng: -0.1028, lat: 51.5465 },
    { name: "Kensington", lng: -0.1936, lat: 51.4991 },
    { name: "Tower Hamlets", lng: -0.0419, lat: 51.5203 },
    { name: "Southwark", lng: -0.0877, lat: 51.5035 },
    { name: "Greenwich", lng: 0.014, lat: 51.482 },
    { name: "Hackney", lng: -0.0553, lat: 51.545 },
  ],
  "Dubai, UAE": [
    { name: "Downtown", lng: 55.2744, lat: 25.1972 },
    { name: "Marina", lng: 55.1398, lat: 25.08 },
    { name: "Deira", lng: 55.3324, lat: 25.2697 },
    { name: "Jumeirah", lng: 55.2324, lat: 25.2248 },
    { name: "Business Bay", lng: 55.2633, lat: 25.1872 },
  ],
  "Milan, Italy": [
    { name: "Centro", lng: 9.19, lat: 45.4642 },
    { name: "Porta Romana", lng: 9.205, lat: 45.45 },
    { name: "Porta Venezia", lng: 9.21, lat: 45.475 },
    { name: "Brera", lng: 9.185, lat: 45.472 },
    { name: "Navigli", lng: 9.17, lat: 45.448 },
  ],
};

const geocodeCity = async (cityKey: string): Promise<[number, number] | null> => {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cityKey)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.features?.length > 0) {
      const [lng, lat] = data.features[0].center;
      return [lng, lat];
    }
  } catch {}
  return null;
};

const buildMarkers = async (
  locations: LocationData[],
  type: "user" | "event"
): Promise<MarkerPoint[]> => {
  const markers: MarkerPoint[] = [];

  // Events with exact coordinates
  if (type === "event") {
    for (const loc of locations) {
      if (loc.coordinates) {
        const [latStr, lngStr] = loc.coordinates.split(",").map((s) => s.trim());
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (!isNaN(lat) && !isNaN(lng)) {
          markers.push({
            id: `${loc.id}-exact`,
            lng,
            lat,
            type,
            label: `${loc.city}, ${loc.country}`,
            eventId: loc.id,
            title: loc.title,
          });
        }
      }
    }
  }

  // Group by city
  const cityGroups = new Map<string, LocationData[]>();
  for (const loc of locations) {
    if (type === "event" && loc.coordinates) continue;
    const key = `${loc.city}, ${loc.country}`;
    if (!cityGroups.has(key)) cityGroups.set(key, []);
    cityGroups.get(key)!.push(loc);
  }

  for (const [cityKey, locs] of cityGroups) {
    const districts = CITY_DISTRICTS[cityKey];
    let center: [number, number] | null = null;

    if (!districts) {
      center = await geocodeCity(cityKey);
    }

    locs.forEach((loc, idx) => {
      let lng: number, lat: number;
      const offsetRange = districts ? 0.01 : 0.05;

      if (districts) {
        const d = districts[idx % districts.length];
        lng = d.lng + (Math.random() - 0.5) * offsetRange;
        lat = d.lat + (Math.random() - 0.5) * offsetRange;
      } else if (center) {
        lng = center[0] + (Math.random() - 0.5) * offsetRange;
        lat = center[1] + (Math.random() - 0.5) * offsetRange;
      } else {
        return;
      }

      markers.push({
        id: `${loc.id || cityKey}-${idx}`,
        lng,
        lat,
        type,
        label: cityKey,
        eventId: loc.id,
        title: loc.title,
      });
    });
  }

  return markers;
};

export default function MapsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"users" | "events">("users");
  const [loading, setLoading] = useState(true);
  const [userMarkers, setUserMarkers] = useState<MarkerPoint[]>([]);
  const [eventMarkers, setEventMarkers] = useState<MarkerPoint[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MarkerPoint | null>(null);

  const fetchAndBuild = useCallback(async () => {
    try {
      const [{ data: userData }, { data: eventData }] = await Promise.all([
        supabase.from("public_profiles").select("city, country").not("city", "is", null).not("country", "is", null),
        supabase.from("events").select("id, title, city, country, coordinates").not("city", "is", null).not("country", "is", null),
      ]);

      const userLocs: LocationData[] = (userData || []).map((u) => ({ ...u, type: "user" as const }));
      const eventLocs: LocationData[] = (eventData || []).map((e) => ({
        city: e.city!,
        country: e.country!,
        type: "event" as const,
        id: e.id,
        title: e.title,
        coordinates: e.coordinates || undefined,
      }));

      const [uMarkers, eMarkers] = await Promise.all([
        buildMarkers(userLocs, "user"),
        buildMarkers(eventLocs, "event"),
      ]);

      setUserMarkers(uMarkers);
      setEventMarkers(eMarkers);
    } catch (e) {
      __DEV__ && console.log("Error fetching map data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAndBuild(); }, [fetchAndBuild]);

  const activeMarkers = activeTab === "users" ? userMarkers : eventMarkers;
  const markerColor = activeTab === "users" ? "#00451a" : "#324750";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <View style={{ flex: 1 }}>
        {/* Map */}
        <MapboxGL.MapView
          style={{ flex: 1 }}
          styleURL="mapbox://styles/mapbox/light-v11"
          logoEnabled={false}
          attributionEnabled={false}
        >
          <MapboxGL.Camera
            defaultSettings={{ centerCoordinate: [28.9784, 41.0082], zoomLevel: 10 }}
          />

          {activeMarkers.map((marker) => (
            <MapboxGL.MarkerView
              key={marker.id}
              coordinate={[marker.lng, marker.lat]}
            >
              <Pressable
                onPress={() => setSelectedMarker(marker)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: markerColor,
                  borderWidth: 3,
                  borderColor: "white",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              />
            </MapboxGL.MarkerView>
          ))}
        </MapboxGL.MapView>

        {/* Floating tab switcher */}
        <View
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: Colors.border + "80",
            padding: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => { setActiveTab("users"); setSelectedMarker(null); }}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: "center",
                backgroundColor: activeTab === "users" ? Colors.primary : "transparent",
                borderWidth: 1,
                borderColor: activeTab === "users" ? Colors.primary : Colors.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontWeight: "600", fontSize: 14, color: activeTab === "users" ? "white" : Colors.foreground }}>
                Members
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setActiveTab("events"); setSelectedMarker(null); }}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: "center",
                backgroundColor: activeTab === "events" ? "#324750" : "transparent",
                borderWidth: 1,
                borderColor: "#324750",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontWeight: "600", fontSize: 14, color: activeTab === "events" ? "white" : "#324750" }}>
                Events
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Marker popup */}
        {selectedMarker && (
          <Pressable
            onPress={() => {
              if (selectedMarker.eventId && activeTab === "events") {
                router.push(`/event/${selectedMarker.eventId}` as any);
              }
              setSelectedMarker(null);
            }}
            style={{
              position: "absolute",
              bottom: 32,
              left: 16,
              right: 16,
              backgroundColor: "white",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: Colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            {selectedMarker.title && (
              <Text style={{ fontWeight: "700", fontSize: 14, color: markerColor, marginBottom: 4 }}>
                {selectedMarker.title}
              </Text>
            )}
            <Text style={{ fontSize: 13, color: "#666" }}>{selectedMarker.label}</Text>
            {activeTab === "events" && selectedMarker.eventId && (
              <Text style={{ fontSize: 11, color: "#999", marginTop: 6 }}>Tap to view details</Text>
            )}
            {activeTab === "users" && (
              <Text style={{ fontWeight: "700", fontSize: 12, color: markerColor, marginTop: 4 }}>
                Member Location
              </Text>
            )}
          </Pressable>
        )}

        {/* Loading overlay */}
        {loading && (
          <View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(255,255,255,0.8)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ color: Colors.mutedForeground, marginTop: 8 }}>Loading locations...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

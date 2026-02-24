// NOTE: Requires development build — will not work in Expo Go
import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { Config } from "../../constants/Config";
import { MobileLayout } from "../../components/layout/MobileLayout";

// Conditional MapboxGL import - won't crash in Expo Go
let MapboxGL: any = null;
try {
  MapboxGL = require("@rnmapbox/maps").default;
  // Set Mapbox access token if available
  if (MapboxGL && Config.MAPBOX_ACCESS_TOKEN) {
    MapboxGL.setAccessToken(Config.MAPBOX_ACCESS_TOKEN);
  }
} catch (e) {
  // MapboxGL not available in Expo Go
  console.log("MapboxGL not available - running in Expo Go");
}

interface LocationData {
  city: string;
  country: string;
  type: 'user' | 'event';
  id?: string;
  title?: string;
  coordinates?: string;
  full_name?: string;
}

// District coordinates for major cities (same as webapp)
const CITY_DISTRICTS: Record<string, Array<{ name: string; lng: number; lat: number }>> = {
  'İstanbul, Türkiye': [
    { name: 'Kadıköy', lng: 29.0321, lat: 40.9887 },
    { name: 'Beşiktaş', lng: 29.0056, lat: 41.0421 },
    { name: 'Üsküdar', lng: 29.0216, lat: 41.0224 },
    { name: 'Beyoğlu', lng: 28.9744, lat: 41.0369 },
    { name: 'Şişli', lng: 28.9869, lat: 41.0602 },
    { name: 'Sarıyer', lng: 29.0465, lat: 41.1651 },
    { name: 'Ataşehir', lng: 29.1265, lat: 40.9824 },
    { name: 'Bakırköy', lng: 28.8734, lat: 40.9805 },
    { name: 'Maltepe', lng: 29.1381, lat: 40.9358 },
    { name: 'Kartal', lng: 29.1868, lat: 40.8986 },
  ],
  'Istanbul, Türkiye': [
    { name: 'Kadıköy', lng: 29.0321, lat: 40.9887 },
    { name: 'Beşiktaş', lng: 29.0056, lat: 41.0421 },
    { name: 'Üsküdar', lng: 29.0216, lat: 41.0224 },
    { name: 'Beyoğlu', lng: 28.9744, lat: 41.0369 },
    { name: 'Şişli', lng: 28.9869, lat: 41.0602 },
    { name: 'Sarıyer', lng: 29.0465, lat: 41.1651 },
    { name: 'Ataşehir', lng: 29.1265, lat: 40.9824 },
    { name: 'Bakırköy', lng: 28.8734, lat: 40.9805 },
    { name: 'Maltepe', lng: 29.1381, lat: 40.9358 },
    { name: 'Kartal', lng: 29.1868, lat: 40.8986 },
  ],
  'Ankara, Türkiye': [
    { name: 'Çankaya', lng: 32.8543, lat: 39.9184 },
    { name: 'Keçiören', lng: 32.8632, lat: 39.9667 },
    { name: 'Yenimahalle', lng: 32.7886, lat: 39.9667 },
    { name: 'Mamak', lng: 32.9141, lat: 39.9208 },
    { name: 'Etimesgut', lng: 32.6779, lat: 39.9478 },
    { name: 'Sincan', lng: 32.5855, lat: 39.9687 },
  ],
  'İzmir, Türkiye': [
    { name: 'Konak', lng: 27.1428, lat: 38.4192 },
    { name: 'Karşıyaka', lng: 27.0945, lat: 38.4599 },
    { name: 'Bornova', lng: 27.2150, lat: 38.4698 },
    { name: 'Buca', lng: 27.1841, lat: 38.3940 },
    { name: 'Bayraklı', lng: 27.1634, lat: 38.4637 },
    { name: 'Gaziemir', lng: 27.1373, lat: 38.3243 },
  ],
  'London, UK': [
    { name: 'Westminster', lng: -0.1278, lat: 51.4975 },
    { name: 'Camden', lng: -0.1426, lat: 51.5392 },
    { name: 'Islington', lng: -0.1028, lat: 51.5465 },
    { name: 'Kensington', lng: -0.1936, lat: 51.4991 },
    { name: 'Tower Hamlets', lng: -0.0419, lat: 51.5203 },
    { name: 'Southwark', lng: -0.0877, lat: 51.5035 },
    { name: 'Greenwich', lng: 0.0140, lat: 51.4820 },
    { name: 'Hackney', lng: -0.0553, lat: 51.5450 },
  ],
  'London, United Kingdom': [
    { name: 'Westminster', lng: -0.1278, lat: 51.4975 },
    { name: 'Camden', lng: -0.1426, lat: 51.5392 },
    { name: 'Islington', lng: -0.1028, lat: 51.5465 },
    { name: 'Kensington', lng: -0.1936, lat: 51.4991 },
    { name: 'Tower Hamlets', lng: -0.0419, lat: 51.5203 },
    { name: 'Southwark', lng: -0.0877, lat: 51.5035 },
    { name: 'Greenwich', lng: 0.0140, lat: 51.4820 },
    { name: 'Hackney', lng: -0.0553, lat: 51.5450 },
  ],
  'Dubai, UAE': [
    { name: 'Downtown', lng: 55.2744, lat: 25.1972 },
    { name: 'Marina', lng: 55.1398, lat: 25.0800 },
    { name: 'Deira', lng: 55.3324, lat: 25.2697 },
    { name: 'Jumeirah', lng: 55.2324, lat: 25.2248 },
    { name: 'Business Bay', lng: 55.2633, lat: 25.1872 },
  ],
};

export default function MapsScreen() {
  const router = useRouter();
  const [userLocations, setUserLocations] = useState<LocationData[]>([]);
  const [eventLocations, setEventLocations] = useState<LocationData[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'events'>('users');
  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<Array<{ id: string; coordinate: [number, number]; location: LocationData }>>([]);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    updateMarkers();
  }, [activeTab, userLocations, eventLocations]);

  const fetchLocations = async () => {
    try {
      // Fetch user locations with names
      const { data: userData, error: userError } = await supabase
        .from("public_profiles")
        .select("city, country, full_name")
        .not("city", "is", null)
        .not("country", "is", null);

      if (userError) throw userError;

      // Fetch event locations with id, title, and coordinates
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, title, city, country, coordinates")
        .not("city", "is", null)
        .not("country", "is", null);

      if (eventError) throw eventError;

      setUserLocations(userData?.map(loc => ({ ...loc, type: 'user' as const })) || []);
      setEventLocations(eventData?.map(loc => ({ 
        city: loc.city!, 
        country: loc.country!, 
        type: 'event' as const,
        id: loc.id,
        title: loc.title,
        coordinates: loc.coordinates || undefined
      })) || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateMarkers = () => {
    const locationsToShow = activeTab === 'users' ? userLocations : eventLocations;
    const newMarkers: Array<{ id: string; coordinate: [number, number]; location: LocationData }> = [];

    // For events with exact coordinates
    if (activeTab === 'events') {
      locationsToShow.forEach((location, index) => {
        if (location.coordinates) {
          const [latStr, lngStr] = location.coordinates.split(',').map(s => s.trim());
          const lat = parseFloat(latStr);
          const lng = parseFloat(lngStr);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            newMarkers.push({
              id: `event-exact-${location.id || index}`,
              coordinate: [lng, lat],
              location
            });
          }
        }
      });
    }

    // Group locations by city
    const cityGroups = new Map<string, LocationData[]>();
    locationsToShow.forEach(location => {
      // Skip events with exact coordinates (already handled)
      if (activeTab === 'events' && location.coordinates) return;
      
      const key = `${location.city}, ${location.country}`;
      if (!cityGroups.has(key)) {
        cityGroups.set(key, []);
      }
      cityGroups.get(key)!.push(location);
    });

    // Process each city group
    for (const [cityKey, locations] of cityGroups) {
      const districts = CITY_DISTRICTS[cityKey];
      
      if (districts && districts.length > 0) {
        // Use predefined districts
        locations.forEach((location, index) => {
          const district = districts[index % districts.length];
          
          // Add small random offset
          const offsetRange = 0.01;
          const lngOffset = (Math.random() - 0.5) * offsetRange;
          const latOffset = (Math.random() - 0.5) * offsetRange;

          const lng = district.lng + lngOffset;
          const lat = district.lat + latOffset;

          newMarkers.push({
            id: `${activeTab}-${cityKey}-${index}`,
            coordinate: [lng, lat],
            location
          });
        });
      }
    }

    setMarkers(newMarkers);
  };

  const markerColor = activeTab === 'users' ? Colors.primary : '#324750';

  // Get current locations based on active tab
  const currentLocations = activeTab === 'users' ? userLocations : eventLocations;

  // Render map if available, otherwise show placeholder with member list
  if (MapboxGL) {
    return (
      <MobileLayout>
        <View style={styles.container}>
          {/* Tab Buttons - Below Header */}
          <View style={styles.tabContainer}>
            <View style={styles.tabCard}>
              <Pressable
                onPress={() => setActiveTab('users')}
                style={[
                  styles.tabButton,
                  activeTab === 'users' && { backgroundColor: Colors.primary }
                ]}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'users' && styles.tabTextActive
                ]}>
                  Members
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('events')}
                style={[
                  styles.tabButton,
                  activeTab === 'events' && { backgroundColor: '#324750' }
                ]}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'events' && styles.tabTextActive
                ]}>
                  Events
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Map */}
          <MapboxGL.MapView
            style={styles.map}
            styleURL="mapbox://styles/mapbox/light-v11"
            zoomEnabled={true}
            scrollEnabled={true}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <MapboxGL.Camera
              zoomLevel={10}
              centerCoordinate={[28.9784, 41.0082]} // Istanbul
              animationMode="flyTo"
              animationDuration={1000}
            />

            {/* Markers */}
            {markers.map((marker) => (
              <MapboxGL.PointAnnotation
                key={marker.id}
                id={marker.id}
                coordinate={marker.coordinate}
                onSelected={() => {
                  if (activeTab === 'events' && marker.location.id) {
                    router.push(`/event/${marker.location.id}` as any);
                  }
                }}
              >
                <View style={[styles.marker, { backgroundColor: markerColor }]} />
                <MapboxGL.Callout
                  title={
                    activeTab === 'events' 
                      ? marker.location.title || 'Event'
                      : marker.location.full_name || 'Member Location'
                  }
                  style={styles.callout}
                >
                  <View style={styles.calloutContent}>
                    <Text style={[styles.calloutTitle, { color: markerColor }]}>
                      {activeTab === 'events' 
                        ? marker.location.title || 'Event'
                        : marker.location.full_name || 'Member Location'}
                    </Text>
                    <Text style={styles.calloutText}>
                      {marker.location.city}, {marker.location.country}
                    </Text>
                    {activeTab === 'events' && (
                      <Text style={styles.calloutHint}>Tap to view details</Text>
                    )}
                  </View>
                </MapboxGL.Callout>
              </MapboxGL.PointAnnotation>
            ))}
          </MapboxGL.MapView>

          {/* Loading State */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading locations...</Text>
            </View>
          )}
        </View>
      </MobileLayout>
    );
  }

  // Placeholder for Expo Go
  return (
    <MobileLayout>
      <View style={styles.container}>
        {/* Tab Buttons - Below Header */}
        <View style={styles.tabContainer}>
          <View style={styles.tabCard}>
            <Pressable
              onPress={() => setActiveTab('users')}
              style={[
                styles.tabButton,
                activeTab === 'users' && { backgroundColor: Colors.primary }
              ]}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'users' && styles.tabTextActive
              ]}>
                Members
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('events')}
              style={[
                styles.tabButton,
                activeTab === 'events' && { backgroundColor: '#324750' }
              ]}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'events' && styles.tabTextActive
              ]}>
                Events
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Placeholder Content */}
        <View style={styles.placeholder}>
          <View style={styles.placeholderIcon}>
            <Text style={styles.placeholderIconText}>🗺️</Text>
          </View>
          <Text style={styles.placeholderTitle}>Map requires development build</Text>
          <Text style={styles.placeholderSubtitle}>Available soon — member list below</Text>
        </View>

        {/* Location List */}
        <View style={styles.listContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading locations...</Text>
            </View>
          ) : currentLocations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {activeTab === 'users' ? 'members' : 'events'} found</Text>
            </View>
          ) : (
            <FlatList
              data={currentLocations}
              keyExtractor={(item, index) => `${activeTab}-${index}`}
              renderItem={({ item }) => (
                <View style={styles.locationItem}>
                  <View style={styles.locationMarker}>
                    <View style={[styles.markerDot, { backgroundColor: markerColor }]} />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationTitle}>
                      {activeTab === 'events' ? item.title || 'Event' : item.full_name || 'Member'}
                    </Text>
                    <Text style={styles.locationText}>
                      {item.city}, {item.country}
                    </Text>
                    {activeTab === 'events' && item.id && (
                      <Pressable
                        onPress={() => router.push(`/event/${item.id}` as any)}
                        style={styles.viewButton}
                      >
                        <Text style={styles.viewButtonText}>View Details</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </MobileLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  callout: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 0,
  },
  calloutContent: {
    padding: 12,
    minWidth: 150,
  },
  calloutTitle: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 11,
    color: '#666',
  },
  calloutHint: {
    fontSize: 10,
    color: '#999',
    marginTop: 6,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  tabCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.foreground,
  },
  tabTextActive: {
    color: 'white',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  // Placeholder styles
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  placeholderIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderIconText: {
    fontSize: 40,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.foreground,
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: Colors.mutedForeground,
    textAlign: 'center',
  },
  // List styles
  listContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.mutedForeground,
    textAlign: 'center',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: 'white',
  },
  locationMarker: {
    marginRight: 16,
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: Colors.mutedForeground,
    marginBottom: 8,
  },
  viewButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  listContent: {
    paddingBottom: 20,
  },
});

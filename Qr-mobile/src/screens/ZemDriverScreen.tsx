import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../api/supabase';
import { api } from '../api/config';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';
import { fonts, fontSizes } from '../theme/typography';
import { BackButton } from '../components/BackButton';
import { getRoute, RouteData } from '../utils/osrm';

const { width, height } = Dimensions.get('window');

// L'API Google Maps Directions nécessite une clé API. 
// Pour le MVP sans clé, on affichera une ligne droite (Polyline).

export default function ZemDriverScreen({ navigation }: any) {
  const { getUser } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const u = await getUser();
    setUser(u);
    startTracking(u.id);
  };

  const startTracking = async (userId: string) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erreur', 'Permission de localisation refusée');
      setLoading(false);
      return;
    }

    // Écouter les changements de position
    Location.watchPositionAsync({
      accuracy: Location.Accuracy.High,
      distanceInterval: 50, // Mettre à jour tous les 50 mètres
    }, (loc) => {
      setLocation(loc);
      if (isOnline) {
        updateZemLocation(userId, loc.coords.latitude, loc.coords.longitude, true);
      }
    });

    // Écouter les nouvelles courses via Supabase Realtime (si configuré)
    if (supabase) {
      supabase
        .channel('public:rides')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides', filter: `zem_id=eq.${userId}` }, payload => {
          if (payload.new.status === 'requested') {
            handleNewRideRequest(payload.new);
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `zem_id=eq.${userId}` }, payload => {
          if (payload.new.status === 'canceled' && activeRide?.id === payload.new.id) {
            Alert.alert("Annulation", "La course a été annulée par le client.");
            setActiveRide(null);
            setRouteData(null);
          }
        })
        .subscribe();
    }

    setLoading(false);
  };

  const updateZemLocation = async (userId: string, lat: number, lng: number, online: boolean) => {
    try {
      await api('/zem/location', 'POST', {
        zemId: userId,
        lat,
        lng,
        isOnline: online
      });
    } catch (err) {
      console.error("Erreur mise à jour position", err);
    }
  };

  const toggleOnline = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (user && location) {
      updateZemLocation(user.id, location.coords.latitude, location.coords.longitude, newStatus);
    }
  };

  const handleNewRideRequest = (ride: any) => {
    Alert.alert(
      "🚀 Nouvelle course !",
      `Distance: ${ride.distance_km} km\nGains: ${ride.price_fcfa} FCFA\nAccepter la course ?`,
      [
        { text: "Refuser", style: "cancel", onPress: () => declineRide(ride.id) },
        { text: "Accepter", onPress: () => acceptRide(ride) }
      ],
      { cancelable: false }
    );
  };

  const acceptRide = async (ride: any) => {
    if (!supabase) return;
    try {
      // Mettre à jour Supabase
      const { data, error } = await supabase
        .from('rides')
        .update({ status: 'accepted' })
        .eq('id', ride.id)
        .select()
        .single();
      
      if (error) throw error;
      setActiveRide(data);
      
      // Se mettre hors ligne pour ne pas recevoir d'autres courses
      setIsOnline(false);
      updateZemLocation(user.id, location!.coords.latitude, location!.coords.longitude, false);

      // Calculer la route OSRM
      const rData = await getRoute(
        { latitude: data.origin_lat, longitude: data.origin_lng },
        { latitude: data.dest_lat, longitude: data.dest_lng }
      );
      setRouteData(rData);

      // Centrer la carte
      mapRef.current?.fitToCoordinates([
        { latitude: data.origin_lat, longitude: data.origin_lng },
        { latitude: data.dest_lat, longitude: data.dest_lng }
      ], { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });

    } catch (err) {
      Alert.alert("Erreur", "Impossible d'accepter la course.");
    }
  };

  const declineRide = async (rideId: string) => {
    if (!supabase) return;
    try {
      await supabase
        .from('rides')
        .update({ status: 'declined' }) // Le client devra relancer une recherche
        .eq('id', rideId);
    } catch (err) {
      console.error(err);
    }
  };

  const completeRide = async () => {
    if (!activeRide || !supabase) return;
    try {
      await supabase
        .from('rides')
        .update({ status: 'completed' })
        .eq('id', activeRide.id);
      
      Alert.alert("Terminé", `Course terminée. Vous avez gagné ${activeRide.price_fcfa} FCFA.`);
      setActiveRide(null);
      setRouteData(null);
      setIsOnline(true);
      updateZemLocation(user.id, location!.coords.latitude, location!.coords.longitude, true);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de clôturer la course.");
    }
  };

  if (loading || !location) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Acquisition GPS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <BackButton color={colors.text} />
          <Text style={styles.headerTitle}>Mode Conducteur</Text>
        </View>
      </SafeAreaView>

      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="none"
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {activeRide && (
          <>
            <Marker coordinate={{ latitude: activeRide.origin_lat, longitude: activeRide.origin_lng }} title="Départ" pinColor="green" />
            <Marker coordinate={{ latitude: activeRide.dest_lat, longitude: activeRide.dest_lng }} title="Destination" pinColor="red" />
            {routeData ? (
              <Polyline 
                coordinates={routeData.coordinates} 
                strokeColor={colors.primary} 
                strokeWidth={4} 
              />
            ) : (
              <Polyline 
                coordinates={[
                  { latitude: activeRide.origin_lat, longitude: activeRide.origin_lng },
                  { latitude: activeRide.dest_lat, longitude: activeRide.dest_lng }
                ]} 
                strokeColor={colors.primary} 
                strokeWidth={4} 
              />
            )}
          </>
        )}
      </MapView>

      <View style={styles.bottomPanel}>
        {!activeRide ? (
          <>
            <View style={styles.statusIndicator}>
              <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
              <Text style={styles.statusText}>{isOnline ? "En Ligne - Prêt" : "Hors Ligne"}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: isOnline ? colors.danger : colors.success }]} 
              onPress={toggleOnline}
            >
              <Text style={styles.btnText}>{isOnline ? "Se mettre hors ligne" : "Se mettre en ligne"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.rideTitle}>Course en cours</Text>
            <Text style={styles.rideInfo}>Gain estimé : {activeRide.price_fcfa} FCFA</Text>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={completeRide}>
              <Text style={styles.btnText}>Terminer la course</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  headerTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, marginLeft: 15 },
  map: { width, height },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statusText: { fontSize: fontSizes.md, fontFamily: fonts.semiBold, color: colors.text },
  btn: { padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fontSizes.md },
  rideTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, textAlign: 'center', marginBottom: 5 },
  rideInfo: { fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', marginBottom: 15 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerText: { marginTop: 10, fontSize: fontSizes.md, color: colors.textSecondary },
});

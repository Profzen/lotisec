import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../api/supabase';
import { api } from '../api/config';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';
import { fonts, fontSizes } from '../theme/typography';
import { BackButton } from '../components/BackButton';

const { width, height } = Dimensions.get('window');

// Formule de Haversine pour estimer la distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function ZemPassengerScreen({ navigation }: any) {
  const { getUser } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [destination, setDestination] = useState<{lat: number, lng: number} | null>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const u = await getUser();
    setUser(u);
    startTracking();
  };

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erreur', 'Permission de localisation refusée');
      setLoading(false);
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc);

    // Écouter les mises à jour des courses
    supabase
      .channel('public:rides')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, payload => {
        if (activeRide && payload.new.id === activeRide.id) {
          setActiveRide(payload.new);
          if (payload.new.status === 'accepted') {
            Alert.alert("Succès", "Un Zem a accepté votre course ! Il est en route.");
          } else if (payload.new.status === 'completed') {
            Alert.alert("Arrivée", "Course terminée. Merci d'avoir voyagé avec SafeLife Zem !");
            setActiveRide(null);
            setDestination(null);
          } else if (payload.new.status === 'declined') {
            // Le Zem a refusé, on pourrait relancer la recherche ici
            Alert.alert("Désolé", "Le Zem a décliné. Relancez la recherche.");
            setActiveRide(null);
          }
        }
      })
      .subscribe();

    setLoading(false);
  };

  const handleMapPress = (e: any) => {
    if (activeRide) return; // On ne change pas si une course est en cours
    setDestination({
      lat: e.nativeEvent.coordinate.latitude,
      lng: e.nativeEvent.coordinate.longitude
    });
  };

  const requestZem = async () => {
    if (!destination || !location || !user) return;

    const dist = calculateDistance(
      location.coords.latitude, location.coords.longitude,
      destination.lat, destination.lng
    );
    const price = Math.round(dist * 75);

    try {
      setLoading(true);
      const res = await api('/zem/request', 'POST', {
        passengerId: user.id,
        originLat: location.coords.latitude,
        originLng: location.coords.longitude,
        destLat: destination.lat,
        destLng: destination.lng,
        distanceKm: Math.round(dist * 10) / 10,
        priceFcfa: price
      });

      if (res.ride) {
        setActiveRide(res.ride);
        Alert.alert("Recherche", "Recherche de Zem en cours...");
      } else {
        Alert.alert("Erreur", "Aucun Zem disponible.");
      }
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Impossible de commander.");
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    try {
      await supabase
        .from('rides')
        .update({ status: 'canceled' })
        .eq('id', activeRide.id);
      setActiveRide(null);
      setDestination(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !location) {
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
          <Text style={styles.headerTitle}>Commander un Zem</Text>
        </View>
      </SafeAreaView>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location?.coords.latitude || 6.13,
          longitude: location?.coords.longitude || 1.21,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        onPress={handleMapPress}
      >
        {destination && (
          <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title="Destination" pinColor="red" />
        )}
        {(destination && location) && (
          <Polyline 
            coordinates={[
              { latitude: location.coords.latitude, longitude: location.coords.longitude },
              { latitude: destination.lat, longitude: destination.lng }
            ]} 
            strokeColor={colors.primary} 
            strokeWidth={4} 
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      <View style={styles.bottomPanel}>
        {!activeRide ? (
          <>
            <Text style={styles.instruction}>
              {destination ? "Destination sélectionnée" : "Appuyez sur la carte pour choisir votre destination"}
            </Text>
            {destination && location && (
              <View style={styles.estimateBox}>
                <Text style={styles.estimateText}>
                  Distance: {Math.round(calculateDistance(location.coords.latitude, location.coords.longitude, destination.lat, destination.lng) * 10) / 10} km
                </Text>
                <Text style={styles.priceText}>
                  ~ {Math.round(calculateDistance(location.coords.latitude, location.coords.longitude, destination.lat, destination.lng) * 75)} FCFA
                </Text>
              </View>
            )}
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: destination ? colors.primary : '#ccc' }]} 
              onPress={requestZem}
              disabled={!destination || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Commander le Zem</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.rideTitle}>Course {activeRide.status === 'requested' ? 'en attente' : 'en cours'}</Text>
            <Text style={styles.rideInfo}>Prix: {activeRide.price_fcfa} FCFA</Text>
            <Text style={styles.statusInfo}>
              {activeRide.status === 'requested' ? "Recherche d'un conducteur..." : "Votre Zem est en route !"}
            </Text>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.danger }]} onPress={cancelRide}>
              <Text style={styles.btnText}>Annuler</Text>
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
  instruction: { fontSize: fontSizes.md, fontFamily: fonts.semiBold, color: colors.text, textAlign: 'center', marginBottom: 15 },
  estimateBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 10 },
  estimateText: { fontSize: fontSizes.md, color: colors.textSecondary },
  priceText: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.success },
  btn: { padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fontSizes.md },
  rideTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, textAlign: 'center', marginBottom: 5 },
  rideInfo: { fontSize: fontSizes.md, fontFamily: fonts.semiBold, color: colors.success, textAlign: 'center', marginBottom: 5 },
  statusInfo: { fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', marginBottom: 15 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerText: { marginTop: 10, fontSize: fontSizes.md, color: colors.textSecondary },
});

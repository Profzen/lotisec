import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, UrlTile } from '../components/PlatformMap';
import { api } from '../api/config';
import { supabase } from '../api/supabase';
import { hydrateSession } from '../services/session';
import { colors } from '../theme/colors';
import { getRoute } from '../utils/osrm';

const labels: Record<string, string> = {
  searching: 'Recherche d’un Zem',
  offered: 'Proposition envoyee',
  accepted: 'Zem affecte',
  driver_en_route: 'Le Zem arrive',
  driver_arrived: 'Zem arrive',
  ready_to_start: 'Pret a partir',
  in_progress: 'Trajet en cours',
  driver_completed: 'Arrivee a confirmer',
  completed: 'Termine',
  canceled: 'Annule',
  expired: 'Aucun Zem trouve',
  no_show: 'Absence signalee',
  disputed: 'A verifier',
};

export default function RideDetailScreen({ route, navigation }: any) {
  const { rideId } = route.params;
  const [ride, setRide] = useState<any>();
  const [position, setPosition] = useState<any>();
  const [user, setUser] = useState<any>();
  const [error, setError] = useState('');
  const [road, setRoad] = useState<any[]>([]);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const load = async () => {
    try {
      const s = await hydrateSession();
      if (!s) return;
      setUser(s.user);
      const data = await api(`/zem/rides/${rideId}`, 'GET', undefined, s.token);
      setRide(data.ride);
      const pos = await api(`/zem/rides/${rideId}/positions/latest`, 'GET', undefined, s.token);
      setPosition(pos.position);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load,15000);
    const realtime = supabase;
    if (!realtime) return () => clearInterval(timer);

    const rc = realtime
      .channel(`ride-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
        ({ new: r }) => setRide(r)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_positions', filter: `ride_id=eq.${rideId}` },
        ({ new: p }) => setPosition(p)
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      realtime.removeChannel(rc);
    };
  }, [rideId]);

  // Driver live telemetry broadcast during ride
  useEffect(() => {
    if (!ride || !user) return;
    const isDriver = user.id === ride.zem_id;
    const isActive = ['accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start', 'in_progress'].includes(ride.status);

    if (isDriver && isActive) {
      (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') return;
          if (locationSub.current) locationSub.current.remove();

          locationSub.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 4000,
              distanceInterval: 5,
            },
            async (loc) => {
              const s = await hydrateSession();
              if (!s?.token) return;
              try {
                await api('/zem/location', 'POST', {
                  lat: loc.coords.latitude,
                  lng: loc.coords.longitude,
                  isOnline: true,
                  accuracy: loc.coords.accuracy,
                  heading: loc.coords.heading,
                  speed: loc.coords.speed,
                }, s.token);
              } catch {
                // Background telemetry retry silently
              }
            }
          );
        } catch {
          // Ignore watch error
        }
      })();
    }

    return () => {
      if (locationSub.current) {
        locationSub.current.remove();
        locationSub.current = null;
      }
    };
  }, [ride?.status, user?.id]);

  useEffect(() => {
    if (!ride) return;
    const approaching = ['accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start'].includes(ride.status);
    const from = approaching && position
      ? { latitude: position.latitude, longitude: position.longitude }
      : { latitude: ride.origin_lat, longitude: ride.origin_lng };
    const to = approaching
      ? { latitude: ride.origin_lat, longitude: ride.origin_lng }
      : { latitude: ride.dest_lat, longitude: ride.dest_lng };

    getRoute(from, to)
      .then((result) => setRoad(result?.coordinates || [from, to]))
      .catch(() => setRoad([from, to]));
  }, [ride?.status, position?.latitude, position?.longitude]);

  if (!ride) {
    return (
      <SafeAreaView style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </SafeAreaView>
    );
  }

  const isDriver = user?.id === ride.zem_id;
  const approaching = ['accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start'].includes(ride.status);
  const routePoints = road.length
    ? road
    : approaching && position
    ? [{ latitude: position.latitude, longitude: position.longitude }, { latitude: ride.origin_lat, longitude: ride.origin_lng }]
    : [{ latitude: ride.origin_lat, longitude: ride.origin_lng }, { latitude: ride.dest_lat, longitude: ride.dest_lng }];

  const action = async (name: string) => {
    try {
      const s = await hydrateSession();
      const result = await api(`/zem/rides/${ride.id}/action`, 'POST', { action: name }, s?.token);
      setRide(result.ride);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const actions: [string, string][] = [];
  if (isDriver && ride.status === 'accepted') actions.push(['Commencer l’approche', 'driver_en_route']);
  if (isDriver && ride.status === 'driver_en_route') actions.push(['Je suis arrive', 'driver_arrived']);
  if (!isDriver && ride.status === 'driver_arrived') actions.push(['Je suis pret', 'passenger_ready']);
  if (isDriver && ride.status === 'ready_to_start') actions.push(['Demarrer le trajet', 'start']);
  if (isDriver && ride.status === 'in_progress') actions.push(['Arrive a destination', 'driver_completed']);
  if (!isDriver && ride.status === 'driver_completed') actions.push(['Confirmer la fin', 'confirm_complete']);

  const active = ['searching', 'offered', 'accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start', 'in_progress'].includes(ride.status);
  const confirm = (title: string, message: string, name: string) =>
    Alert.alert(title, message, [
      { text: 'Retour', style: 'cancel' },
      { text: 'Confirmer', style: 'destructive', onPress: () => action(name) },
    ]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.icon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Course en cours</Text>
          <Text style={styles.status}>{labels[ride.status] || ride.status}</Text>
        </View>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: approaching ? ride.origin_lat : ride.dest_lat,
          longitude: approaching ? ride.origin_lng : ride.dest_lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <UrlTile />
        <Marker coordinate={{ latitude: ride.origin_lat, longitude: ride.origin_lng }} title="Depart" />
        <Marker coordinate={{ latitude: ride.dest_lat, longitude: ride.dest_lng }} title="Destination" />
        {position ? (
          <Marker coordinate={{ latitude: position.latitude, longitude: position.longitude }} title="Zem" />
        ) : null}
        <Polyline coordinates={routePoints} strokeColor={colors.primary} strokeWidth={4} />
      </MapView>

      <ScrollView style={styles.panel}>
        <View style={styles.metrics}>
          <Text style={styles.price}>{ride.price_fcfa} FCFA</Text>
          <Text>{ride.distance_km} km</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={styles.chat}
          onPress={() => navigation.navigate('RideChat', { rideId: ride.id })}
        >
          <Ionicons name="chatbubbles-outline" size={21} color={colors.primary} />
          <Text style={styles.chatText}>Discuter avec {isDriver ? 'le passager' : 'le Zem'}</Text>
        </TouchableOpacity>
        {actions.map(([label, name]) => (
          <TouchableOpacity key={name} style={styles.primary} onPress={() => action(name)}>
            <Text style={styles.primaryText}>{label}</Text>
          </TouchableOpacity>
        ))}
        {isDriver && ride.status === 'driver_arrived' ? (
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => confirm('Passager absent', 'Signaler que le passager ne s’est pas presente ?', 'no_show')}
          >
            <Text style={styles.secondaryText}>Signaler une absence</Text>
          </TouchableOpacity>
        ) : null}
        {ride.status === 'driver_completed' ? (
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => confirm('Contester la fin', 'La course sera transmise a la supervision.', 'dispute')}
          >
            <Text style={styles.secondaryText}>Signaler un probleme</Text>
          </TouchableOpacity>
        ) : null}
        {active ? (
          <TouchableOpacity
            style={styles.cancel}
            onPress={() => confirm('Annuler la course', 'Cette action mettra fin au suivi et au chat.', 'cancel')}
          >
            <Text style={styles.cancelText}>Annuler la course</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    height: 66,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
  },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800', fontSize: 17, color: colors.text },
  status: { color: colors.primary, marginTop: 2 },
  map: { flex: 1, minHeight: 280 },
  panel: { maxHeight: 330, padding: 18 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  price: { fontSize: 19, fontWeight: '800', color: colors.text },
  chat: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  chatText: { color: colors.primary, fontWeight: '700' },
  primary: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryText: { color: colors.white, fontWeight: '800' },
  secondary: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  secondaryText: { color: colors.warning, fontWeight: '700' },
  cancel: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.danger, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center', margin: 8 },
});

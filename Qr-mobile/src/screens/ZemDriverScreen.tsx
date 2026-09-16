import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, UrlTile } from '../components/PlatformMap';
import { BackButton } from '../components/BackButton';
import { api } from '../api/config';
import { supabase } from '../api/supabase';
import { hydrateSession } from '../services/session';
import { colors } from '../theme/colors';

export default function ZemDriverScreen({ navigation }: any) {
  const [session, setSession] = useState<any>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [online, setOnline] = useState(false);
  const onlineRef = useRef(false);
  const [offer, setOffer] = useState<any>(null);
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const mapRef = useRef<MapView>(null);

  const loadOffer = async (token?: string) => {
    try {
      const authToken = token || session?.token;
      if (!authToken) return;
      const r = await api('/zem/offers/current', 'GET', undefined, authToken);
      const activeOffer = r.offers?.[0] || null;
      if (activeOffer) {
        console.log('[DRIVER] offer received:', activeOffer.id, activeOffer.distance_km, 'km');
      }
      setOffer(activeOffer);
    } catch (e) {
      // Ignorer les échecs temporaires
    }
  };

  const publishLocation = async (loc: Location.LocationObject, isOnline = onlineRef.current) => {
    try {
      await api('/zem/location', 'POST', {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? null,
        heading: loc.coords.heading ?? null,
        speed: loc.coords.speed ?? null,
        isOnline,
      });
      console.log('[DRIVER] position updated:', loc.coords.latitude, loc.coords.longitude, 'online:', isOnline);
    } catch (e) {
      // Erreur réseau
    }
  };

  useEffect(() => {
    let watcher: Location.LocationSubscription | undefined;
    let timer: ReturnType<typeof setInterval>;
    let channel: any;

    (async () => {
      try {
        const s = await hydrateSession();
        if (!s || !s.user) {
          Alert.alert('Session requise', 'Veuillez vous connecter pour accéder à l’espace conducteur.');
          setLoading(false);
          return;
        }

        const isZem = s.user.is_zem || s.user.roles?.includes('zem_driver') || s.user.role === 'zem_driver';
        if (!isZem) {
          Alert.alert(
            'Accès restreint',
            'Ce profil n’est pas accrédité comme conducteur Zem. Veuillez contacter le support ou postuler.'
          );
          setLoading(false);
          return;
        }

        setSession(s);

        // Charger l'historique des courses actives
        const history = await api('/zem/history?page=1&page_size=10', 'GET', undefined, s.token).catch(() => ({ rides: [] }));
        const currentActive = history.rides?.find((item: any) =>
          ['accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start', 'in_progress', 'driver_completed'].includes(item.status)
        );
        if (currentActive) {
          setRide(currentActive);
        }

        // Vérification de la permission GPS
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert('Localisation requise', 'Activez la localisation pour recevoir des courses.');
          setLoading(false);
          return;
        }

        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(first);
        await publishLocation(first, false);

        // Suivi continu des déplacements
        watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 25, timeInterval: 8000 },
          (loc) => {
            setLocation(loc);
            if (onlineRef.current) {
              publishLocation(loc, true);
            }
          }
        );

        await loadOffer(s.token);
        timer = setInterval(() => loadOffer(s.token), 5000);

        if (supabase) {
          channel = supabase
            .channel(`zem-driver-live-${s.user.id}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'ride_offers', filter: `zem_id=eq.${s.user.id}` },
              () => loadOffer(s.token)
            )
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'rides', filter: `zem_id=eq.${s.user.id}` },
              ({ new: item }: any) => {
                if (['completed', 'canceled', 'expired', 'no_show', 'disputed'].includes(item.status)) {
                  setRide(null);
                } else {
                  setRide(item);
                }
              }
            )
            .subscribe();
        }
      } catch (err) {
        console.warn('[DRIVER] Erreur initialisation conducteur:', err);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      watcher?.remove();
      if (timer) clearInterval(timer);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  const toggleOnline = async () => {
    if (!location) {
      Alert.alert('Position indisponible', 'Impossible de passer en ligne sans signal GPS réel.');
      return;
    }

    const next = !online;
    onlineRef.current = next;
    setOnline(next);
    await publishLocation(location, next);
    if (next) {
      await loadOffer();
    }
  };

  const respondToOffer = async (accept: boolean) => {
    if (!offer || responding) return;
    try {
      setResponding(true);
      console.log('[DRIVER] offer responding accept=', accept);
      const result = await api(`/zem/offers/${offer.id}/respond`, 'POST', { accept });
      setOffer(null);

      if (accept && result?.ride) {
        console.log('[DRIVER] offer accepted, ride:', result.ride.id);
        setRide(result.ride);
        onlineRef.current = false;
        setOnline(false);
        if (location) {
          await publishLocation(location, false);
        }
        navigation.navigate('RideDetail', { rideId: result.ride.id });
      } else {
        await loadOffer();
      }
    } catch (e: any) {
      Alert.alert('Offre indisponible', e.message || 'L’offre a expiré ou a été attribuée.');
      await loadOffer();
    } finally {
      setResponding(false);
    }
  };

  if (loading || !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Acquisition de votre position GPS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <BackButton color={colors.text} />
        <Text style={styles.title}>Espace Conducteur Zem</Text>
      </SafeAreaView>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        <UrlTile />

        {/* Si une offre est en attente, afficher le départ et la destination */}
        {offer && offer.origin_lat && offer.origin_lng && (
          <Marker
            coordinate={{ latitude: Number(offer.origin_lat), longitude: Number(offer.origin_lng) }}
            title="Point de prise en charge"
            pinColor="#1565D8"
          />
        )}
        {offer && offer.dest_lat && offer.dest_lng && (
          <Marker
            coordinate={{ latitude: Number(offer.dest_lat), longitude: Number(offer.dest_lng) }}
            title="Destination client"
            pinColor="#D32F2F"
          />
        )}
      </MapView>

      <View style={styles.panel}>
        {offer ? (
          <>
            <View style={styles.row}>
              <Ionicons name="navigate-circle" size={26} color={colors.primary} />
              <Text style={styles.offerTitle}>Nouvelle course disponible</Text>
            </View>
            <Text style={styles.offerMeta}>
              {offer.distance_km} km · {offer.price_fcfa} FCFA
            </Text>
            <Text style={styles.muted}>
              Cette proposition expire après 45 secondes. Acceptez uniquement si vous pouvez rejoindre le client.
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.flex, { backgroundColor: colors.danger }]}
                onPress={() => respondToOffer(false)}
                disabled={responding}
              >
                <Text style={styles.buttonText}>Refuser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.flex, { backgroundColor: colors.success }]}
                onPress={() => respondToOffer(true)}
                disabled={responding}
              >
                {responding ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Accepter</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : ride ? (
          <>
            <Text style={styles.offerTitle}>Course en cours</Text>
            <Text style={styles.offerMeta}>Statut : {ride.status}</Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('RideDetail', { rideId: ride.id })}
            >
              <Text style={styles.buttonText}>Ouvrir le suivi et les actions</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.textLight }]} />
              <Text style={styles.offerTitle}>
                {online ? 'Disponible pour les courses' : 'Actuellement hors ligne'}
              </Text>
            </View>
            <Text style={styles.muted}>
              {online
                ? 'Votre position est partagée avec les passagers proches (rayon 5 km).'
                : 'Passez en ligne pour recevoir des demandes de courses Zem.'}
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: online ? colors.text : colors.success }]}
              onPress={toggleOnline}
            >
              <Text style={styles.buttonText}>
                {online ? 'Passer hors ligne' : 'Passer en ligne'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    position: 'absolute',
    zIndex: 3,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  map: { flex: 1 },
  panel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 20,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.white,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  offerTitle: { fontWeight: '800', fontSize: 17, color: colors.text, textAlign: 'center' },
  offerMeta: { fontWeight: '800', fontSize: 18, color: colors.primary, textAlign: 'center', marginVertical: 6 },
  muted: { color: colors.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  button: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingHorizontal: 16 },
  flex: { flex: 1, marginTop: 0 },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});

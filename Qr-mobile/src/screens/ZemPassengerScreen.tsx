import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Dimensions, ActivityIndicator, TextInput, FlatList,
  Keyboard, Platform,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from '../components/PlatformMap';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../api/supabase';
import { api } from '../api/config';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';
import { fonts, fontSizes } from '../theme/typography';
import { BackButton } from '../components/BackButton';
import { getRoute, calculateFallbackDistance, RouteData } from '../utils/osrm';
import { searchAddress, reverseGeocode, getShortName, NominatimResult } from '../utils/nominatim';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Centre par défaut : Lomé, Togo
const DEFAULT_COORDS = { latitude: 6.1375, longitude: 1.2125 };

export default function ZemPassengerScreen({ navigation }: any) {
  const { getUser } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [destination, setDestination] = useState<{lat: number, lng: number} | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [zemLocation, setZemLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingRide, setRequestingRide] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Recherche d'adresse
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const u = await getUser();
      setUser(u);
    } catch (e) {
      console.warn('Erreur chargement session utilisateur:', e);
    }
    startTracking();
  };

  const startTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Activez la localisation pour commander un Zem.');
        // Position par défaut sur Lomé
        setLocation({
          coords: {
            latitude: DEFAULT_COORDS.latitude,
            longitude: DEFAULT_COORDS.longitude,
            altitude: null,
            accuracy: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc);

      // Écouter les mises à jour des courses
      if (supabase) {
        supabase
          .channel('public:rides')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload: any) => {
            if (activeRide && payload.new.id === activeRide.id) {
              setActiveRide(payload.new);
              if (payload.new.status === 'accepted') {
                Alert.alert("Succès", "Un Zem a accepté votre course ! Il est en route.");
              } else if (payload.new.status === 'completed') {
                Alert.alert("Arrivée", "Course terminée. Merci d'avoir voyagé avec LOTISEC Zem !");
                setActiveRide(null);
                setDestination(null);
                setRouteData(null);
                setDestinationName('');
              } else if (payload.new.status === 'declined') {
                Alert.alert("Information", "Le conducteur a décliné. Recherche d'un autre conducteur...");
              }
            }
          })
          .subscribe();

        // Suivi de la position de la moto si une course est active
        supabase
          .channel('zem_tracking')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'zem_locations' }, (payload: any) => {
            if (activeRide && payload.new.zem_id === activeRide.zem_id) {
              setZemLocation({ lat: payload.new.latitude, lng: payload.new.longitude });
            }
          })
          .subscribe();
      }
    } catch (err) {
      console.warn('[ZemPassenger] Erreur acquisition GPS:', err);
      // Fallback Lomé
      setLocation({
        coords: {
          latitude: DEFAULT_COORDS.latitude,
          longitude: DEFAULT_COORDS.longitude,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── Recherche d'adresse avec debounce ─────────────────────
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setShowResults(true);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (text.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchAddress(text, 'tg', 5);
      setSearchResults(results);
      setIsSearching(false);
    }, 400);
  }, []);

  const selectSearchResult = async (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    setDestination({ lat, lng });
    const name = getShortName(result);
    setDestinationName(name);
    setSearchQuery(name);
    setShowResults(false);
    setSearchResults([]);
    Keyboard.dismiss();

    // Animer la carte vers la destination
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 800);

    // Calcul immédiat du tracé et de la distance
    const startCoords = location
      ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
      : DEFAULT_COORDS;

    // Estimation immédiate
    const fallback = calculateFallbackDistance(startCoords, { latitude: lat, longitude: lng });
    setRouteData({
      coordinates: [startCoords, { latitude: lat, longitude: lng }],
      distanceKm: fallback.distanceKm,
      durationMin: fallback.durationMin,
    });

    // Raffinement via OSRM
    const rData = await getRoute(startCoords, { latitude: lat, longitude: lng });
    if (rData) {
      setRouteData(rData);
    }
  };

  // ─── Clic sur la carte ────────────────────────────────────
  const handleMapPress = async (e: any) => {
    if (activeRide) return;

    const dest = {
      lat: e.nativeEvent.coordinate.latitude,
      lng: e.nativeEvent.coordinate.longitude,
    };
    setDestination(dest);
    setShowResults(false);

    // Calcul immédiat de la distance pour un affichage instantané
    const startCoords = location
      ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
      : DEFAULT_COORDS;

    const fallback = calculateFallbackDistance(startCoords, { latitude: dest.lat, longitude: dest.lng });
    setRouteData({
      coordinates: [startCoords, { latitude: dest.lat, longitude: dest.lng }],
      distanceKm: fallback.distanceKm,
      durationMin: fallback.durationMin,
    });

    // Géocodage inversé pour afficher le nom du lieu
    reverseGeocode(dest.lat, dest.lng).then((reverseResult) => {
      if (reverseResult) {
        const name = getShortName(reverseResult);
        setDestinationName(name);
        setSearchQuery(name);
      } else {
        const name = `${dest.lat.toFixed(4)}, ${dest.lng.toFixed(4)}`;
        setDestinationName(name);
        setSearchQuery(name);
      }
    });

    // Calcul de l'itinéraire OSRM
    const rData = await getRoute(startCoords, { latitude: dest.lat, longitude: dest.lng });
    if (rData) {
      setRouteData(rData);
    }
  };

  const requestZem = async () => {
    if (!destination) {
      Alert.alert('Destination requise', 'Veuillez choisir un lieu d’arrivée sur la carte ou via la recherche.');
      return;
    }

    let currentUser = user;
    if (!currentUser) {
      currentUser = await getUser();
      setUser(currentUser);
    }

    if (!currentUser?.id) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour commander une course.');
      return;
    }

    const startLat = location?.coords.latitude || DEFAULT_COORDS.latitude;
    const startLng = location?.coords.longitude || DEFAULT_COORDS.longitude;

    // Calcul distance et prix garanti
    const distanceKm = routeData?.distanceKm || calculateFallbackDistance({ latitude: startLat, longitude: startLng }, { latitude: destination.lat, longitude: destination.lng }).distanceKm;
    const price = Math.max(300, Math.round(distanceKm * 75));

    try {
      setRequestingRide(true);
      const res = await api('/zem/request', 'POST', {
        passengerId: currentUser.id,
        originLat: startLat,
        originLng: startLng,
        destLat: destination.lat,
        destLng: destination.lng,
        distanceKm: Math.round(distanceKm * 10) / 10,
        priceFcfa: price,
      });

      if (res.ride) {
        setActiveRide(res.ride);
        navigation.navigate('RideDetail', { rideId: res.ride.id });
      } else {
        Alert.alert('Information', 'Votre demande est enregistrée. Recherche d’un conducteur Zem en cours...');
      }
    } catch (err: any) {
      console.warn('[ZemPassenger] Erreur commande:', err);
      Alert.alert('Commande Zem', err.message || 'Aucun conducteur Zem n’est disponible à proximité actuellement.');
    } finally {
      setRequestingRide(false);
    }
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    try {
      await api(`/zem/rides/${activeRide.id}/action`, 'POST', { action: 'cancel' });
      setActiveRide(null);
      setZemLocation(null);
      setDestination(null);
      setRouteData(null);
      setDestinationName('');
      setSearchQuery('');
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible d’annuler la course.');
    }
  };

  const estimatedDistance = routeData?.distanceKm || (destination && location ? calculateFallbackDistance(
    { latitude: location.coords.latitude, longitude: location.coords.longitude },
    { latitude: destination.lat, longitude: destination.lng }
  ).distanceKm : 0);

  const estimatedPrice = Math.max(300, Math.round(estimatedDistance * 75));

  if (loading && !location) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Acquisition de la carte et du GPS...</Text>
      </View>
    );
  }

  const currentLat = location?.coords.latitude || DEFAULT_COORDS.latitude;
  const currentLng = location?.coords.longitude || DEFAULT_COORDS.longitude;

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <BackButton color={colors.text} />
          <Text style={styles.headerTitle}>Commander un Zem</Text>
        </View>

        {/* Barre de recherche */}
        {!activeRide && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Où allez-vous ? Rechercher une adresse..."
                placeholderTextColor={colors.textLight}
                value={searchQuery}
                onChangeText={handleSearchChange}
                onFocus={() => setShowResults(true)}
                returnKeyType="search"
              />
              {searchQuery !== '' && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowResults(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.searchClear}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Résultats de recherche */}
            {showResults && searchResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => String(item.place_id)}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.resultItem}
                      onPress={() => selectSearchResult(item)}
                    >
                      <Ionicons name="location-outline" size={20} color={colors.primary} style={styles.resultIcon} />
                      <View style={styles.resultText}>
                        <Text style={styles.resultName} numberOfLines={1}>
                          {getShortName(item)}
                        </Text>
                        <Text style={styles.resultAddress} numberOfLines={1}>
                          {item.display_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Indicateur de chargement recherche */}
            {isSearching && (
              <View style={styles.searchingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.searchingText}>Recherche d’adresses...</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>

      {/* Carte interactive */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: currentLat,
          longitude: currentLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        onPress={handleMapPress}
        onMapReady={() => setMapReady(true)}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          tileSize={256}
          zIndex={1}
          shouldReplaceMapContent={true}
        />
        {destination && (
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title={destinationName || 'Destination'}
            pinColor="#D21034"
          />
        )}
        {destination && routeData && (
          <Polyline
            coordinates={routeData.coordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}

        {/* Marqueur dynamique de la moto Zem */}
        {zemLocation && (
          <Marker
            coordinate={{ latitude: zemLocation.lat, longitude: zemLocation.lng }}
            title="Votre Zem"
            pinColor="#FFCD00"
          />
        )}
      </MapView>

      {/* Message si carte ne charge pas */}
      {!mapReady && Platform.OS !== 'web' && (
        <View style={styles.mapLoadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.mapLoadingText}>Chargement de la carte...</Text>
        </View>
      )}

      {/* Panneau bas */}
      <View style={styles.bottomPanel}>
        {!activeRide ? (
          <>
            <Text style={styles.instruction} numberOfLines={2}>
              {destination
                ? destinationName || 'Destination sélectionnée'
                : 'Recherchez une adresse ou touchez la carte pour choisir'}
            </Text>

            {destination && (
              <View style={styles.estimateBox}>
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Distance</Text>
                  <Text style={styles.estimateValue}>
                    {Math.round(estimatedDistance * 10) / 10} km
                  </Text>
                </View>
                <View style={styles.estimateDivider} />
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Prix estimé</Text>
                  <Text style={styles.priceText}>
                    {estimatedPrice} FCFA
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: destination ? colors.primary : colors.border },
              ]}
              onPress={requestZem}
              disabled={!destination || requestingRide}
              activeOpacity={0.8}
            >
              {requestingRide ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.btnText, { marginLeft: 10 }]}>Recherche d’un Zem...</Text>
                </View>
              ) : (
                <Text style={styles.btnText}>Commander le Zem</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.rideTitle}>
              Course {activeRide.status === 'requested' ? 'en attente' : 'en cours'}
            </Text>
            <Text style={styles.rideInfo}>Prix : {activeRide.price_fcfa} FCFA</Text>
            <Text style={styles.statusInfo}>
              {activeRide.status === 'requested'
                ? 'Recherche d’un conducteur...'
                : 'Votre Zem est en route !'}
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.danger }]}
              onPress={cancelRide}
            >
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
  headerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
  headerTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, marginLeft: 15 },
  map: { width: '100%', height: '100%', flex: 1 },

  // Recherche
  searchContainer: { paddingHorizontal: 15, paddingBottom: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text,
    paddingVertical: 0,
  },
  searchClear: { fontSize: 22, color: colors.textLight, paddingHorizontal: 4 },

  // Résultats
  resultsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
    maxHeight: 200,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  resultIcon: { marginRight: 10 },
  resultText: { flex: 1 },
  resultName: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, color: colors.text },
  resultAddress: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },

  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  searchingText: { fontSize: fontSizes.xs, color: colors.textSecondary },

  // Map loading
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    zIndex: 5,
  },
  mapLoadingText: { marginTop: 10, fontSize: fontSizes.md, color: colors.textSecondary },

  // Bottom panel
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  instruction: {
    fontSize: fontSizes.md,
    fontFamily: fonts.semiBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  estimateBox: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  estimateItem: { flex: 1, alignItems: 'center' },
  estimateLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, marginBottom: 4 },
  estimateValue: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.text },
  estimateDivider: { width: 1, height: 32, backgroundColor: colors.border },
  priceText: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.primary },
  btn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fontSizes.md },
  rideTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, textAlign: 'center', marginBottom: 5 },
  rideInfo: { fontSize: fontSizes.md, fontFamily: fonts.semiBold, color: colors.primary, textAlign: 'center', marginBottom: 5 },
  statusInfo: { fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', marginBottom: 15 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  centerText: { marginTop: 10, fontSize: fontSizes.md, color: colors.textSecondary },
});

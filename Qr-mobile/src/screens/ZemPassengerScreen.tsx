import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Dimensions, ActivityIndicator, TextInput, FlatList,
  Keyboard, Platform,
} from 'react-native';
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
import { searchAddress, reverseGeocode, getShortName, NominatimResult } from '../utils/nominatim';

const { width, height } = Dimensions.get('window');

export default function ZemPassengerScreen({ navigation }: any) {
  const { getUser } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [destination, setDestination] = useState<{lat: number, lng: number} | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

    // Écouter les mises à jour des courses (si Supabase est configuré)
    if (supabase) {
      supabase
        .channel('public:rides')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, payload => {
          if (activeRide && payload.new.id === activeRide.id) {
            setActiveRide(payload.new);
            if (payload.new.status === 'accepted') {
              Alert.alert("Succès", "Un Zem a accepté votre course ! Il est en route.");
            } else if (payload.new.status === 'completed') {
              Alert.alert("Arrivée", "Course terminée. Merci d'avoir voyagé avec Lotisec Zem !");
              setActiveRide(null);
              setDestination(null);
              setRouteData(null);
              setDestinationName('');
            } else if (payload.new.status === 'declined') {
              Alert.alert("Désolé", "Le Zem a décliné. Relancez la recherche.");
              setActiveRide(null);
            }
          }
        })
        .subscribe();
    }

    setLoading(false);
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
    setDestinationName(getShortName(result));
    setSearchQuery(getShortName(result));
    setShowResults(false);
    setSearchResults([]);
    Keyboard.dismiss();

    // Animer la carte vers la destination
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 800);

    // Calculer l'itinéraire
    if (location) {
      setLoading(true);
      const rData = await getRoute(
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        { latitude: lat, longitude: lng }
      );
      setRouteData(rData);
      setLoading(false);
    }
  };

  // ─── Clic sur la carte ────────────────────────────────────
  const handleMapPress = async (e: any) => {
    if (activeRide) return;

    const dest = {
      lat: e.nativeEvent.coordinate.latitude,
      lng: e.nativeEvent.coordinate.longitude
    };
    setDestination(dest);
    setShowResults(false);

    // Géocodage inversé pour afficher le nom du lieu
    const reverseResult = await reverseGeocode(dest.lat, dest.lng);
    if (reverseResult) {
      const name = getShortName(reverseResult);
      setDestinationName(name);
      setSearchQuery(name);
    } else {
      setDestinationName(`${dest.lat.toFixed(4)}, ${dest.lng.toFixed(4)}`);
    }

    if (location) {
      setLoading(true);
      const rData = await getRoute(
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        { latitude: dest.lat, longitude: dest.lng }
      );
      setRouteData(rData);
      setLoading(false);
    }
  };

  const requestZem = async () => {
    if (!destination || !location || !user || !routeData) return;

    const price = Math.round(routeData.distanceKm * 75);

    try {
      setLoading(true);
      const res = await api('/zem/request', 'POST', {
        passengerId: user.id,
        originLat: location.coords.latitude,
        originLng: location.coords.longitude,
        destLat: destination.lat,
        destLng: destination.lng,
        distanceKm: Math.round(routeData.distanceKm * 10) / 10,
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
    if (!activeRide || !supabase) return;
    try {
      await supabase
        .from('rides')
        .update({ status: 'canceled' })
        .eq('id', activeRide.id);
      setActiveRide(null);
      setDestination(null);
      setRouteData(null);
      setDestinationName('');
      setSearchQuery('');
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
              <Text style={styles.searchIcon}>🔍</Text>
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
                      <Text style={styles.resultIcon}>📍</Text>
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
                <Text style={styles.searchingText}>Recherche en cours...</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>

      {/* Carte */}
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="none"
        initialRegion={{
          latitude: location?.coords.latitude || 6.13,
          longitude: location?.coords.longitude || 1.21,
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
        />
        {destination && (
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title={destinationName || "Destination"}
            pinColor="red"
          />
        )}
        {(destination && location && routeData) ? (
          <Polyline
            coordinates={routeData.coordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        ) : (destination && location) ? (
          <Polyline
            coordinates={[
              { latitude: location.coords.latitude, longitude: location.coords.longitude },
              { latitude: destination.lat, longitude: destination.lng }
            ]}
            strokeColor={colors.primary}
            strokeWidth={4}
            lineDashPattern={[5, 5]}
          />
        ) : null}
      </MapView>

      {/* Message si carte ne charge pas */}
      {!mapReady && (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.mapLoadingText}>Chargement de la carte...</Text>
        </View>
      )}

      {/* Panneau bas */}
      <View style={styles.bottomPanel}>
        {!activeRide ? (
          <>
            <Text style={styles.instruction}>
              {destination
                ? `📍 ${destinationName || 'Destination sélectionnée'}`
                : "Recherchez une adresse ou appuyez sur la carte"
              }
            </Text>
            {destination && location && routeData && (
              <View style={styles.estimateBox}>
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Distance</Text>
                  <Text style={styles.estimateValue}>
                    {Math.round(routeData.distanceKm * 10) / 10} km
                  </Text>
                </View>
                <View style={styles.estimateDivider} />
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Prix estimé</Text>
                  <Text style={styles.priceText}>
                    {Math.round(routeData.distanceKm * 75)} FCFA
                  </Text>
                </View>
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
  headerSafe: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  headerTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, marginLeft: 15 },
  map: { width, height },

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
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
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
  resultIcon: { fontSize: 16, marginRight: 10 },
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
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    zIndex: 5,
  },
  mapLoadingText: { marginTop: 10, fontSize: fontSizes.md, color: colors.textSecondary },

  // Bottom panel
  bottomPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
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
  instruction: {
    fontSize: fontSizes.md,
    fontFamily: fonts.semiBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 15,
  },
  estimateBox: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
    alignItems: 'center',
  },
  estimateItem: { flex: 1, alignItems: 'center' },
  estimateLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, marginBottom: 4 },
  estimateValue: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.text },
  estimateDivider: { width: 1, height: 32, backgroundColor: colors.border },
  priceText: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.success },
  btn: { padding: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: fontSizes.md },
  rideTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, textAlign: 'center', marginBottom: 5 },
  rideInfo: { fontSize: fontSizes.md, fontFamily: fonts.semiBold, color: colors.success, textAlign: 'center', marginBottom: 5 },
  statusInfo: { fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', marginBottom: 15 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerText: { marginTop: 10, fontSize: fontSizes.md, color: colors.textSecondary },
});

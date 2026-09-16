import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  TextInput,
  FlatList,
  Keyboard,
  Platform,
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
import { searchAddress, reverseGeocode, getShortName, NominatimResult, isInsideTogo } from '../utils/nominatim';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Centre visuel par défaut pour afficher Lomé si le GPS n'est pas encore acquis
const DEFAULT_COORDS = { latitude: 6.1375, longitude: 1.2125 };

type OriginSource = 'gps' | 'manual' | null;

export default function ZemPassengerScreen({ navigation }: any) {
  const { getUser } = useAuth();
  const [user, setUser] = useState<any>(null);

  // Position et point de départ réel
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [originName, setOriginName] = useState<string>('');
  const [originSource, setOriginSource] = useState<OriginSource>(null);
  const [hasRealGps, setHasRealGps] = useState(false);

  // Destination
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');

  // Itinéraire & distance
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeError, setRouteError] = useState(false);

  // Course active & suivi moto
  const [activeRide, setActiveRide] = useState<any>(null);
  const [zemLocation, setZemLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingRide, setRequestingRide] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [currentRegion, setCurrentRegion] = useState({
    latitude: DEFAULT_COORDS.latitude,
    longitude: DEFAULT_COORDS.longitude,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  });

  // Recherche d'adresse
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadUserAndGps();
  }, []);

  const loadUserAndGps = async () => {
    try {
      const u = await getUser();
      setUser(u);
    } catch (e) {
      console.warn('[ZEM PASSENGER] Erreur session utilisateur:', e);
    }
    await acquireGps();
  };

  const acquireGps = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[ZEM PASSENGER] GPS permission denied');
        setHasRealGps(false);
        setOrigin(null);
        setOriginSource(null);
        setOriginName('');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('[ZEM PASSENGER] GPS acquired', loc.coords.latitude, loc.coords.longitude);
      if (isInsideTogo(loc.coords.latitude, loc.coords.longitude)) {
        setHasRealGps(true);
        setOrigin({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setOriginSource('gps');
        setOriginName('Ma position actuelle');

        const nextRegion = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        };
        setCurrentRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 800);
      } else {
        console.warn('[ZEM PASSENGER] GPS outside Togo:', loc.coords.latitude, loc.coords.longitude);
        setHasRealGps(false);
        setOrigin(null);
        setOriginSource(null);
        setOriginName('');
        Alert.alert(
          'Position hors zone',
          'Votre position GPS est en dehors du Togo. LOTISEC Zem est actuellement disponible uniquement au Togo. Touchez la carte pour définir votre point de départ.'
        );
      }
    } catch (err) {
      console.warn('[ZEM PASSENGER] Erreur acquisition GPS:', err);
      setHasRealGps(false);
      setOrigin(null);
      setOriginSource(null);
      setOriginName('');
    } finally {
      setLoading(false);
    }
  };

  const handleRecenter = () => {
    const target = origin ? { latitude: origin.lat, longitude: origin.lng } : DEFAULT_COORDS;
    mapRef.current?.animateToRegion({
      ...target,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    }, 600);
  };

  const handleZoomIn = () => {
    const targetLat = destination?.lat || origin?.lat || currentRegion.latitude;
    const targetLng = destination?.lng || origin?.lng || currentRegion.longitude;
    const nextDeltaLat = Math.max(0.003, currentRegion.latitudeDelta / 2);
    const nextDeltaLng = Math.max(0.003, currentRegion.longitudeDelta / 2);
    const nextRegion = {
      latitude: targetLat,
      longitude: targetLng,
      latitudeDelta: nextDeltaLat,
      longitudeDelta: nextDeltaLng,
    };
    setCurrentRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 300);
  };

  const handleZoomOut = () => {
    const targetLat = destination?.lat || origin?.lat || currentRegion.latitude;
    const targetLng = destination?.lng || origin?.lng || currentRegion.longitude;
    const nextDeltaLat = Math.min(1.5, currentRegion.latitudeDelta * 2);
    const nextDeltaLng = Math.min(1.5, currentRegion.longitudeDelta * 2);
    const nextRegion = {
      latitude: targetLat,
      longitude: targetLng,
      latitudeDelta: nextDeltaLat,
      longitudeDelta: nextDeltaLng,
    };
    setCurrentRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 300);
  };

  // ─── Calcul d'itinéraire ──────────────────────────────────
  const calculateItinerary = async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (!isInsideTogo(start.lat, start.lng) || !isInsideTogo(end.lat, end.lng)) {
      Alert.alert('Zone non couverte', 'LOTISEC Zem est actuellement disponible au Togo.');
      return;
    }

    const startCoords = { latitude: start.lat, longitude: start.lng };
    const endCoords = { latitude: end.lat, longitude: end.lng };

    try {
      const r = await getRoute(startCoords, endCoords);
      if (r && r.coordinates && r.coordinates.length > 1) {
        if (r.distanceKm > 150) {
          Alert.alert('Distance excessive', 'La distance maximale autorisée pour une course Zem est de 150 km.');
          setRouteData(null);
          return;
        }
        console.log('[ZEM PASSENGER] route calculated:', r.distanceKm, 'km');
        setRouteData(r);
        setRouteError(false);

        // Centrer la vue sur l'itinéraire
        mapRef.current?.fitToCoordinates(r.coordinates, {
          edgePadding: { top: 70, right: 40, bottom: 220, left: 40 },
          animated: true,
        });
      } else {
        throw new Error('OSRM route empty');
      }
    } catch {
      console.warn('[ZEM PASSENGER] Itinéraire routier non disponible, utilisation du calcul direct');
      const fb = calculateFallbackDistance(startCoords, endCoords);
      if (fb.distanceKm > 150) {
        Alert.alert('Distance excessive', 'La distance maximale autorisée pour une course Zem est de 150 km.');
        setRouteData(null);
        return;
      }
      setRouteError(true);
      setRouteData(null);

      mapRef.current?.fitToCoordinates([startCoords, endCoords], {
        edgePadding: { top: 70, right: 40, bottom: 220, left: 40 },
        animated: true,
      });
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
      try {
        const results = await searchAddress(text, 'tg', 5);
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  const selectSearchResult = async (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (!isInsideTogo(lat, lng)) {
      Alert.alert('Zone non couverte', 'LOTISEC Zem est actuellement disponible au Togo.');
      return;
    }

    setDestination({ lat, lng });
    const name = getShortName(result) || result.display_name;
    setDestinationName(name);
    setSearchQuery(name);
    setShowResults(false);
    setSearchResults([]);
    Keyboard.dismiss();

    if (origin) {
      await calculateItinerary(origin, { lat, lng });
    } else {
      const nextRegion = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setCurrentRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 800);
    }
  };

  // ─── Clic sur la carte ────────────────────────────────────
  const handleMapPress = async (e: any) => {
    if (activeRide) return;

    const clicked = {
      lat: e.nativeEvent.coordinate.latitude,
      lng: e.nativeEvent.coordinate.longitude,
    };

    if (!isInsideTogo(clicked.lat, clicked.lng)) {
      Alert.alert('Zone non couverte', 'LOTISEC Zem est actuellement disponible au Togo.');
      return;
    }

    // Si aucun point de départ réel n'est défini, le premier clic définit le départ
    if (!origin || !originSource) {
      setOrigin(clicked);
      setOriginSource('manual');
      setOriginName('Point de départ sélectionné');

      reverseGeocode(clicked.lat, clicked.lng)
        .then((rev) => {
          if (rev) setOriginName(getShortName(rev));
        })
        .catch(() => {});
      return;
    }

    // Sinon le clic définit la destination
    setDestination(clicked);
    setShowResults(false);
    setDestinationName('Destination sélectionnée');

    reverseGeocode(clicked.lat, clicked.lng)
      .then((rev) => {
        if (rev) {
          const name = getShortName(rev);
          setDestinationName(name);
          setSearchQuery(name);
        } else {
          const name = `${clicked.lat.toFixed(4)}, ${clicked.lng.toFixed(4)}`;
          setDestinationName(name);
          setSearchQuery(name);
        }
      })
      .catch(() => {
        setDestinationName(`${clicked.lat.toFixed(4)}, ${clicked.lng.toFixed(4)}`);
      });

    await calculateItinerary(origin, clicked);
  };

  // ─── Abonnement Supabase temps réel spécifique à la course ─
  useEffect(() => {
    if (!activeRide?.id || !supabase) return;

    console.log('[ZEM PASSENGER] souscription temps réel à la course', activeRide.id);
    const channel = supabase
      .channel(`ride-live-${activeRide.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${activeRide.id}` },
        (payload: any) => {
          if (payload.new) {
            console.log('[ZEM PASSENGER] statut temps réel reçu:', payload.new.status);
            setActiveRide((prev: any) => ({ ...prev, ...payload.new }));

            if (payload.new.status === 'accepted') {
              console.log('[PASSENGER] ride accepted');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [activeRide?.id]);

  // ─── Abonnement Supabase à la position du Zem ──────────────
  useEffect(() => {
    if (!activeRide?.zem_id || !supabase) return;

    const channel = supabase
      .channel(`zem-pos-${activeRide.zem_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'zem_locations', filter: `zem_id=eq.${activeRide.zem_id}` },
        (payload: any) => {
          if (payload.new?.latitude && payload.new?.longitude) {
            console.log('[TRACKING] position updated:', payload.new.latitude, payload.new.longitude);
            setZemLocation({ lat: payload.new.latitude, lng: payload.new.longitude });
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [activeRide?.zem_id]);

  // ─── Polling de secours REST ──────────────────────────────
  useEffect(() => {
    if (!activeRide?.id) return;
    const terminal = ['completed', 'canceled', 'expired', 'no_show', 'disputed'];
    if (terminal.includes(activeRide.status)) return;

    let mounted = true;
    const poll = async () => {
      try {
        const res = await api(`/zem/rides/${activeRide.id}`, 'GET');
        if (mounted && res?.ride) {
          setActiveRide((prev: any) => {
            if (!prev || prev.status !== res.ride.status || prev.version !== res.ride.version) {
              return res.ride;
            }
            return prev;
          });
        }
        const posRes = await api(`/zem/rides/${activeRide.id}/positions/latest`, 'GET').catch(() => null);
        if (mounted && posRes?.position) {
          setZemLocation({ lat: posRes.position.latitude, lng: posRes.position.longitude });
        }
      } catch {
        // En cas d'indisponibilité réseau temporaire
      }
    };

    const timer = setInterval(poll, 4000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [activeRide?.id, activeRide?.status]);

  // ─── Distance et prix ─────────────────────────────────────
  const fallbackGeodesic = (origin && destination)
    ? calculateFallbackDistance(
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: destination.lat, longitude: destination.lng }
      )
    : { distanceKm: 0, durationMin: 0 };

  const effectiveDistance = routeData?.distanceKm ?? fallbackGeodesic.distanceKm;
  const effectivePrice = Math.max(300, Math.round(effectiveDistance * 75));

  // ─── Commander un Zem ─────────────────────────────────────
  const requestZem = async () => {
    if (!origin || !originSource) {
      Alert.alert(
        'Point de départ requis',
        'Activez la localisation ou touchez la carte pour définir votre point de départ.'
      );
      return;
    }
    if (!destination) {
      Alert.alert(
        'Destination requise',
        'Veuillez choisir un lieu d’arrivée sur la carte ou via la recherche.'
      );
      return;
    }

    let currentUser = user;
    if (!currentUser) {
      currentUser = await getUser();
      setUser(currentUser);
    }
    if (!currentUser?.id) {
      Alert.alert('Connexion requise', 'Votre session a expiré. Veuillez vous reconnecter.');
      return;
    }

    const roundedDistance = Math.round(effectiveDistance * 10) / 10;
    if (roundedDistance > 150) {
      Alert.alert('Distance excessive', 'La distance maximale autorisée pour une course Zem est de 150 km.');
      return;
    }
    console.log('[ZEM PASSENGER] request ride', roundedDistance, 'km', effectivePrice, 'FCFA');

    try {
      setRequestingRide(true);
      const res = await api('/zem/request', 'POST', {
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        distanceKm: roundedDistance,
        priceFcfa: effectivePrice,
      });

      if (res?.ride) {
        console.log('[ZEM PASSENGER] course créée:', res.ride.id, res.ride.status);
        setActiveRide(res.ride);
      }
    } catch (err: any) {
      console.warn('[ZEM PASSENGER] Erreur commande:', err);
      Alert.alert(
        'Demande Zem',
        err.message || 'Aucun conducteur Zem disponible dans un rayon de 5 km pour le moment.'
      );
    } finally {
      setRequestingRide(false);
    }
  };

  // ─── Actions passager ─────────────────────────────────────
  const handlePassengerAction = async (action: string) => {
    if (!activeRide?.id) return;
    try {
      setActionLoading(true);
      const res = await api(`/zem/rides/${activeRide.id}/action`, 'POST', { action });
      if (res?.ride) {
        setActiveRide(res.ride);
      }
    } catch (err: any) {
      Alert.alert('Action impossible', err.message || 'La transition d’état a été refusée.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetRideState = () => {
    setActiveRide(null);
    setZemLocation(null);
    setDestination(null);
    setDestinationName('');
    setSearchQuery('');
    setRouteData(null);
    setRouteError(false);
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Préparation du service Zem...</Text>
      </View>
    );
  }

  const mapCenterLat = origin?.lat || DEFAULT_COORDS.latitude;
  const mapCenterLng = origin?.lng || DEFAULT_COORDS.longitude;

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <BackButton color={colors.text} />
          <Text style={styles.headerTitle}>Commander un Zem</Text>
        </View>

        {/* Barre de recherche (si aucune course active) */}
        {!activeRide && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher une destination..."
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
                  <Text style={styles.searchClear}>x</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Résultats Nominatim */}
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

            {isSearching && (
              <View style={styles.searchingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.searchingText}>Recherche d’adresses...</Text>
              </View>
            )}
          </View>
        )}

        {/* Alerte position GPS manquante */}
        {!origin && (
          <View style={styles.noGpsBanner}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={styles.noGpsText}>
              Point de départ non défini. Touchez la carte pour le placer.
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* Carte native */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: mapCenterLat,
          longitude: mapCenterLng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation={hasRealGps}
        showsMyLocationButton={false}
        onRegionChangeComplete={(region: any) => setCurrentRegion(region)}
        onPress={handleMapPress}
        onMapReady={() => setMapReady(true)}
      >
        <UrlTile />

        {origin && (
          <Marker
            coordinate={{ latitude: origin.lat, longitude: origin.lng }}
            title={originName || 'Départ'}
            description={originSource === 'gps' ? 'Ma position GPS' : 'Point de départ sélectionné'}
            pinColor="#1565D8"
          />
        )}

        {destination && (
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title={destinationName || 'Destination'}
            pinColor="#D32F2F"
          />
        )}

        {/* Tracé routier OSRM ou ligne indicative si hors ligne */}
        {origin && destination && (
          <Polyline
            coordinates={routeData ? routeData.coordinates : [
              { latitude: origin.lat, longitude: origin.lng },
              { latitude: destination.lat, longitude: destination.lng }
            ]}
            strokeColor={routeData ? colors.primary : colors.textLight}
            strokeWidth={4}
            lineDashPattern={routeData ? undefined : [6, 6]}
          />
        )}

        {/* Marqueur moto Zem */}
        {zemLocation && (
          <Marker
            coordinate={{ latitude: zemLocation.lat, longitude: zemLocation.lng }}
            title="Votre conducteur Zem"
            pinColor="#2E7D32"
          />
        )}
      </MapView>

      {/* Boutons flottants de contrôle de carte */}
      <View style={styles.mapControls}>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={handleRecenter}
          activeOpacity={0.8}
          accessibilityLabel="Recentrer"
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={handleZoomIn}
          activeOpacity={0.8}
          accessibilityLabel="Zoomer"
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={handleZoomOut}
          activeOpacity={0.8}
          accessibilityLabel="Dézoomer"
        >
          <Ionicons name="remove" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Panneau inférieur */}
      <View style={styles.bottomPanel}>
        {!activeRide ? (
          <>
            <View style={styles.tripSummary}>
              <View style={styles.pointRow}>
                <Ionicons name="radio-button-on" size={16} color={colors.primary} />
                <Text style={styles.pointText} numberOfLines={1}>
                  {origin ? originName || 'Point de départ défini' : 'Départ non défini (touchez la carte)'}
                </Text>
              </View>
              <View style={styles.pointRow}>
                <Ionicons name="location" size={16} color={colors.danger} />
                <Text style={styles.pointText} numberOfLines={1}>
                  {destination ? destinationName || 'Destination sélectionnée' : 'Destination non choisie'}
                </Text>
              </View>
            </View>

            {routeError && origin && destination && (
              <Text style={styles.routeWarning}>
                Itinéraire routier temporairement indisponible. Distance approximative affichée.
              </Text>
            )}

            {origin && destination && (
              <View style={styles.estimateBox}>
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Distance</Text>
                  <Text style={styles.estimateValue}>
                    {Math.round(effectiveDistance * 10) / 10} km
                  </Text>
                </View>
                <View style={styles.estimateDivider} />
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Tarif garanti</Text>
                  <Text style={styles.priceText}>{effectivePrice} FCFA</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.btn,
                {
                  backgroundColor:
                    origin && destination && !requestingRide
                      ? colors.primary
                      : colors.border,
                },
              ]}
              onPress={requestZem}
              disabled={!origin || !destination || requestingRide}
              activeOpacity={0.8}
            >
              {requestingRide ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.btnText, { marginLeft: 10 }]}>Recherche d’un conducteur...</Text>
                </View>
              ) : (
                <Text style={styles.btnText}>
                  {!origin
                    ? 'Définir un départ'
                    : !destination
                    ? 'Choisir une destination'
                    : `Commander le Zem (${effectivePrice} FCFA)`}
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          /* État d'une course active */
          <View style={styles.activeRideBox}>
            <View style={styles.rideHeaderRow}>
              <View>
                <Text style={styles.rideTitle}>
                  {activeRide.status === 'searching'
                    ? 'Recherche en cours'
                    : activeRide.status === 'offered'
                    ? 'Proposition envoyée'
                    : activeRide.status === 'accepted'
                    ? 'Conducteur trouvé'
                    : activeRide.status === 'driver_en_route'
                    ? 'Conducteur en approche'
                    : activeRide.status === 'driver_arrived'
                    ? 'Conducteur sur place'
                    : activeRide.status === 'ready_to_start'
                    ? 'Prêt au départ'
                    : activeRide.status === 'in_progress'
                    ? 'Trajet en cours'
                    : activeRide.status === 'driver_completed'
                    ? 'Arrivée signalée'
                    : activeRide.status === 'completed'
                    ? 'Course terminée'
                    : activeRide.status === 'expired'
                    ? 'Aucun conducteur disponible'
                    : 'Course ' + activeRide.status}
                </Text>
                <Text style={styles.ridePrice}>
                  {activeRide.price_fcfa} FCFA · {activeRide.distance_km} km
                </Text>
              </View>

              <TouchableOpacity
                style={styles.detailLink}
                onPress={() => navigation.navigate('RideDetail', { rideId: activeRide.id })}
              >
                <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
                <Text style={styles.detailLinkText}>Suivi & Chat</Text>
              </TouchableOpacity>
            </View>

            {/* Instruction contextuelle selon l'état */}
            <Text style={styles.statusInfo}>
              {activeRide.status === 'searching' || activeRide.status === 'offered'
                ? 'Transmission de la proposition aux conducteurs proches...'
                : activeRide.status === 'accepted' || activeRide.status === 'driver_en_route'
                ? 'Votre conducteur a accepté et se dirige vers votre position.'
                : activeRide.status === 'driver_arrived'
                ? 'Le conducteur vous attend au point de départ. Indiquez quand vous êtes prêt.'
                : activeRide.status === 'ready_to_start'
                ? 'Vous êtes prêt. Le conducteur va démarrer le trajet.'
                : activeRide.status === 'in_progress'
                ? 'En route vers votre destination.'
                : activeRide.status === 'driver_completed'
                ? 'Le conducteur est arrivé. Veuillez confirmer la fin de course.'
                : activeRide.status === 'completed'
                ? 'Merci d’avoir utilisé LOTISEC Zem !'
                : activeRide.status === 'expired'
                ? 'Aucun conducteur n’a pu répondre dans les délais impartis.'
                : 'Suivi de course actif.'}
            </Text>

            {/* Boutons d'action passager */}
            {activeRide.status === 'driver_arrived' && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.success, marginBottom: 8 }]}
                onPress={() => handlePassengerAction('passenger_ready')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>Je suis prêt</Text>
                )}
              </TouchableOpacity>
            )}

            {activeRide.status === 'driver_completed' && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.success, marginBottom: 8 }]}
                onPress={() => handlePassengerAction('confirm_complete')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>Confirmer l’arrivée</Text>
                )}
              </TouchableOpacity>
            )}

            {['completed', 'expired', 'canceled', 'no_show'].includes(activeRide.status) ? (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={resetRideState}
              >
                <Text style={styles.btnText}>Nouvelle commande</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.danger }]}
                onPress={() => handlePassengerAction('cancel')}
                disabled={actionLoading}
              >
                <Text style={styles.btnText}>Annuler la course</Text>
              </TouchableOpacity>
            )}
          </View>
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
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
  headerTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, marginLeft: 15 },
  map: { width: '100%', height: '100%', flex: 1 },

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
  searchClear: { fontSize: 20, color: colors.textLight, paddingHorizontal: 6, fontWeight: 'bold' },

  resultsContainer: {
    maxHeight: 180,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  resultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultIcon: { marginRight: 10 },
  resultText: { flex: 1 },
  resultName: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.text },
  resultAddress: { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 2 },
  searchingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  searchingText: { fontSize: fontSizes.xs, color: colors.textSecondary, marginLeft: 8 },

  noGpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  noGpsText: { fontSize: fontSizes.xs, color: '#92400E', marginLeft: 8, flex: 1 },

  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  tripSummary: { marginBottom: 12 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pointText: { fontSize: fontSizes.sm, color: colors.text, fontWeight: '600', flex: 1 },
  routeWarning: { fontSize: fontSizes.xs, color: colors.warning, marginBottom: 8, fontStyle: 'italic' },

  estimateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  estimateItem: { alignItems: 'center' },
  estimateLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, marginBottom: 2 },
  estimateValue: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.text },
  estimateDivider: { width: 1, height: 28, backgroundColor: colors.border },
  priceText: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.primary },

  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnText: { color: colors.white, fontSize: fontSizes.md, fontFamily: fonts.bold },

  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  centerText: { marginTop: 12, fontSize: fontSizes.sm, color: colors.textSecondary },

  activeRideBox: { gap: 8 },
  rideHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  rideTitle: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.text },
  ridePrice: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '700', marginTop: 2 },
  detailLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.surface, borderRadius: 8 },
  detailLinkText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: '700' },
  statusInfo: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: 10, lineHeight: 20 },
  mapControls: {
    position: 'absolute',
    right: 16,
    bottom: 240,
    gap: 10,
    zIndex: 9,
  },
  mapControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});

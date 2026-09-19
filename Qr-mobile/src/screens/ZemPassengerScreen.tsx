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
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchTarget, setSearchTarget] = useState<'origin' | 'destination'>('destination');

  // Destination
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');

  // Itinéraire & distance
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

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
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setGpsCoords(coords);
        setOrigin(coords);
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
        mapRef.current?.animateToRegion({
          latitude: DEFAULT_COORDS.latitude,
          longitude: DEFAULT_COORDS.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 800);
        Alert.alert(
          'Position hors zone',
          'LOTISEC Zem est actuellement disponible au Togo. Vous pouvez sélectionner manuellement un point de départ sur la carte au Togo.'
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
      setRouteData({
        coordinates: [startCoords, endCoords],
        distanceKm: fb.distanceKm,
        durationMin: fb.durationMin,
      });

      mapRef.current?.fitToCoordinates([startCoords, endCoords], {
        edgePadding: { top: 70, right: 30, bottom: 170, left: 30 },
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

    const clicked = { lat, lng };
    const name = getShortName(result) || result.display_name;
    setOrderError(null);
    setShowResults(false);
    setSearchResults([]);
    setSearchQuery('');
    Keyboard.dismiss();

    if (searchTarget === 'origin') {
      setOrigin(clicked);
      setOriginSource('manual');
      setOriginName(name);
      setSearchTarget('destination');

      if (destination) {
        await calculateItinerary(clicked, destination);
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
    } else {
      setDestination(clicked);
      setDestinationName(name);

      if (origin) {
        await calculateItinerary(origin, clicked);
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
    }
  };

  // ─── Clic sur la carte ────────────────────────────────────
  const handleMapPress = async (e: any) => {
    if (activeRide) return;

    const rawCoord = e?.nativeEvent?.coordinate;
    if (!rawCoord) {
      console.warn('[ZEM PASSENGER] Clic carte sans coordonnées valides:', e);
      return;
    }

    const lat = Number(rawCoord.latitude);
    const lng = Number(rawCoord.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('[ZEM PASSENGER] Coordonnées reçues non finies:', lat, lng);
      return;
    }

    const clicked = { lat, lng };

    if (!isInsideTogo(clicked.lat, clicked.lng)) {
      Alert.alert('Zone non couverte', 'LOTISEC Zem est actuellement disponible au Togo.');
      return;
    }

    setOrderError(null);
    setShowResults(false);
    Keyboard.dismiss();

    if (searchTarget === 'origin' || (!origin && !originSource)) {
      setOrigin(clicked);
      setOriginSource('manual');
      setOriginName('Point de départ sélectionné');
      setSearchTarget('destination');

      reverseGeocode(clicked.lat, clicked.lng)
        .then((rev) => {
          if (rev) setOriginName(getShortName(rev));
        })
        .catch(() => {});

      if (destination) {
        await calculateItinerary(clicked, destination);
      }
      return;
    }

    // Sinon le clic définit la destination
    setDestination(clicked);
    setDestinationName('Destination sélectionnée');

    reverseGeocode(clicked.lat, clicked.lng)
      .then((rev) => {
        if (rev) {
          const name = getShortName(rev);
          setDestinationName(name);
        } else {
          const name = `${clicked.lat.toFixed(4)}, ${clicked.lng.toFixed(4)}`;
          setDestinationName(name);
        }
      })
      .catch(() => {
        setDestinationName(`${clicked.lat.toFixed(4)}, ${clicked.lng.toFixed(4)}`);
      });

    if (origin) {
      await calculateItinerary(origin, clicked);
    }
  };

  const handleUseGpsAsOrigin = () => {
    if (gpsCoords) {
      setOrigin(gpsCoords);
      setOriginSource('gps');
      setOriginName('Ma position (GPS)');
      setSearchTarget('destination');
      setShowResults(false);
      setSearchQuery('');
      if (destination) {
        calculateItinerary(gpsCoords, destination);
      } else {
        handleRecenter();
      }
    } else {
      acquireGps();
    }
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
  const effectiveDuration = routeData?.durationMin ?? fallbackGeodesic.durationMin;
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
      setOrderError(null);
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
      const rawMsg = err?.message;
      const msg =
        typeof rawMsg === 'string' && rawMsg.trim().length > 0
          ? rawMsg.trim()
          : 'Aucun conducteur Zem disponible dans un rayon de 5 km pour le moment.';
      setOrderError(msg);
      Alert.alert('Demande Zem', msg);
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
      {/* Header compact & Sélecteur Départ / Arrivée (style dark navy) */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={20} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Commander un Zem</Text>
        </View>

        {!activeRide && (
          <View style={styles.topControlCard}>
            {/* Onglets Départ / Destination */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[
                  styles.tabItem,
                  searchTarget === 'origin' && styles.tabItemActiveOrigin,
                ]}
                onPress={() => {
                  setSearchTarget('origin');
                  setSearchQuery('');
                  setShowResults(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="location" size={15} color="#10B981" />
                <View style={styles.tabTextCol}>
                  <Text style={styles.tabLabel}>DÉPART</Text>
                  <Text style={styles.tabValue} numberOfLines={1}>
                    {origin ? originName || 'Point défini' : 'Choisir départ'}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.tabDivider} />

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  searchTarget === 'destination' && styles.tabItemActiveDest,
                ]}
                onPress={() => {
                  setSearchTarget('destination');
                  setSearchQuery('');
                  setShowResults(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="location" size={15} color="#EF4444" />
                <View style={styles.tabTextCol}>
                  <Text style={styles.tabLabel}>DESTINATION</Text>
                  <Text style={styles.tabValue} numberOfLines={1}>
                    {destination ? destinationName || 'Destination définie' : 'Choisir arrivée'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Bouton rapide GPS si onglet Départ actif */}
            {searchTarget === 'origin' && hasRealGps && (
              <TouchableOpacity
                style={styles.gpsQuickBtn}
                onPress={handleUseGpsAsOrigin}
                activeOpacity={0.7}
              >
                <Ionicons name="navigate" size={13} color="#71D4F5" />
                <Text style={styles.gpsQuickText}>Utiliser ma position GPS actuelle</Text>
              </TouchableOpacity>
            )}

            {/* Barre de recherche compacte */}
            <View style={styles.searchBar}>
              <Ionicons
                name="search"
                size={15}
                color={searchTarget === 'origin' ? '#10B981' : '#EF4444'}
                style={{ marginLeft: 6 }}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  searchTarget === 'origin'
                    ? 'Rechercher le lieu de départ...'
                    : 'Rechercher votre destination...'
                }
                placeholderTextColor="rgba(255,255,255,0.4)"
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
                  style={styles.clearBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Résultats auto-complétion Nominatim */}
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
                      <Ionicons
                        name="location-outline"
                        size={17}
                        color={searchTarget === 'origin' ? '#10B981' : '#EF4444'}
                        style={styles.resultIcon}
                      />
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
                <ActivityIndicator size="small" color="#71D4F5" />
                <Text style={styles.searchingText}>Recherche d’adresses...</Text>
              </View>
            )}
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
            id="zem-origin"
            coordinate={{ latitude: origin.lat, longitude: origin.lng }}
            title={originName || 'Départ'}
            description={originSource === 'gps' ? 'Ma position GPS' : 'Point de départ sélectionné'}
            pinColor="#10B981"
          />
        )}

        {destination && (
          <Marker
            id="zem-destination"
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title={destinationName || 'Destination'}
            pinColor="#EF4444"
          />
        )}

        {/* Tracé routier OSRM ou ligne indicative si hors ligne */}
        {origin && destination && (
          <Polyline
            id={`zem-route_${routeData ? 'solid' : 'dash'}`}
            coordinates={routeData ? routeData.coordinates : [
              { latitude: origin.lat, longitude: origin.lng },
              { latitude: destination.lat, longitude: destination.lng }
            ]}
            strokeColor={colors.primary}
            strokeWidth={4}
            lineDashPattern={routeData ? undefined : [6, 6]}
          />
        )}

        {/* Marqueur moto Zem */}
        {zemLocation && (
          <Marker
            id="zem-driver"
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
          <Ionicons name="locate" size={18} color="#71D4F5" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={handleZoomIn}
          activeOpacity={0.8}
          accessibilityLabel="Zoomer"
        >
          <Ionicons name="add" size={20} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={handleZoomOut}
          activeOpacity={0.8}
          accessibilityLabel="Dézoomer"
        >
          <Ionicons name="remove" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Panneau inférieur compact & profilé (Dark Navy) */}
      <View style={styles.bottomPanel}>
        {!activeRide ? (
          <>
            <View style={styles.destHeaderRow}>
              <Ionicons name="navigate" size={15} color="#1565D8" />
              <Text style={styles.destHeaderTitle} numberOfLines={1}>
                {destination ? destinationName : 'Sélectionnez votre destination'}
              </Text>
            </View>

            {origin && destination && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Distance</Text>
                  <Text style={styles.statValue}>
                    {Math.round(effectiveDistance * 10) / 10} km
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Temps</Text>
                  <Text style={styles.statValue}>
                    {effectiveDuration} min
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Prix Estimé</Text>
                  <Text style={[styles.statValue, styles.priceValue]}>
                    {effectivePrice} FCFA
                  </Text>
                </View>
              </View>
            )}

            {routeError && origin && destination && (
              <Text style={styles.routeWarning}>
                Itinéraire routier direct approximatif affiché.
              </Text>
            )}

            {orderError && (
              <View style={styles.orderErrorBanner}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                <Text style={styles.orderErrorText}>{orderError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.btn,
                {
                  backgroundColor:
                    origin && destination && !requestingRide
                      ? '#1565D8'
                      : 'rgba(255,255,255,0.15)',
                },
              ]}
              onPress={requestZem}
              disabled={!origin || !destination || requestingRide}
              activeOpacity={0.8}
            >
              {requestingRide ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.btnText, { marginLeft: 8 }]}>Recherche d’un conducteur...</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="car" size={17} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.btnText}>
                    {!origin
                      ? 'Définir un départ'
                      : !destination
                      ? 'Choisir une destination'
                      : `Commander un Lotisec Zem (${effectivePrice} FCFA)`}
                  </Text>
                </View>
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
                <Ionicons name="chatbubbles-outline" size={18} color="#71D4F5" />
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
  container: { flex: 1, backgroundColor: '#061322' },
  headerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 4,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#07182C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.white,
    marginLeft: 10,
  },
  topControlCard: {
    marginHorizontal: 10,
    marginTop: 2,
    backgroundColor: '#0A192F',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F263E',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 6,
    borderRadius: 10,
  },
  tabItemActiveOrigin: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  tabItemActiveDest: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  tabTextCol: {
    flex: 1,
  },
  tabLabel: {
    fontSize: 8,
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabValue: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  tabDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  gpsQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(21, 101, 216, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(21, 101, 216, 0.4)',
    borderRadius: 7,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 5,
  },
  gpsQuickText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: '#71D4F5',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#071322',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 5,
    paddingHorizontal: 6,
    height: 34,
  },
  searchInput: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.white,
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  clearBtn: {
    padding: 3,
  },
  resultsContainer: {
    maxHeight: 160,
    backgroundColor: '#0A192F',
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  resultIcon: { marginRight: 8 },
  resultText: { flex: 1 },
  resultName: { fontSize: 11.5, fontFamily: fonts.bold, color: colors.white },
  resultAddress: { fontSize: 9.5, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  searchingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  searchingText: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginLeft: 6 },

  map: { width: '100%', height: '100%', flex: 1 },
  mapControls: {
    position: 'absolute',
    right: 12,
    bottom: 155,
    gap: 8,
    zIndex: 9,
  },
  mapControlButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0A192F',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A192F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  destHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  destHeaderTitle: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: colors.white,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F263E',
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 8.5,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: colors.white,
    marginTop: 1,
  },
  priceValue: {
    color: '#10B981',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  routeWarning: { fontSize: 10, color: colors.warning, marginBottom: 4, fontStyle: 'italic' },
  orderErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1115',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    gap: 6,
  },
  orderErrorText: {
    flex: 1,
    fontSize: 10.5,
    fontFamily: fonts.regular,
    color: '#FF8A80',
  },
  btn: {
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: colors.white,
    fontSize: 12.5,
    fontFamily: fonts.bold,
  },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  centerText: { marginTop: 12, fontSize: fontSizes.sm, color: colors.textSecondary },

  activeRideBox: { gap: 6 },
  rideHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  rideTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.white },
  ridePrice: { fontSize: 12, color: '#10B981', fontWeight: '700', marginTop: 1 },
  detailLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 6, backgroundColor: '#0F263E', borderRadius: 6 },
  detailLinkText: { fontSize: 10.5, color: '#71D4F5', fontWeight: '700' },
  statusInfo: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6, lineHeight: 16 },
});

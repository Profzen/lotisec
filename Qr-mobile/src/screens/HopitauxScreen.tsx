import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, Linking, RefreshControl,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';
import { BackButton } from '../components/BackButton';

// ─── Types ────────────────────────────────────────────────────
interface Hopital {
  id:        string;
  name:      string;
  type:      TypeEtablissement;
  address:   string;
  phone?:    string;
  distance:  number;
  minutes:   number;
  latitude:  number;
  longitude: number;
  urgences:  boolean;
}

type TypeEtablissement = 'hopital' | 'clinique' | 'dispensaire' | 'cs';

const TYPE_CONFIG: Record<TypeEtablissement, {
  label: string; icon: string; color: string; bg: string;
}> = {
  hopital:     { label: 'Hôpital',         icon: '🏥', color: '#1565C0', bg: '#E3F2FD' },
  clinique:    { label: 'Clinique',         icon: '🏪', color: '#2E7D32', bg: '#E8F5E9' },
  dispensaire: { label: 'Dispensaire',      icon: '💊', color: '#6A1B9A', bg: '#F3E5F5' },
  cs:          { label: 'Centre de santé',  icon: '➕', color: '#E65100', bg: '#FBE9E7' },
};

const FILTRES = [
  { key: 'tous',        label: 'Tous',             icon: '📋' },
  { key: 'hopital',     label: 'Hôpitaux',         icon: '🏥' },
  { key: 'clinique',    label: 'Cliniques',         icon: '🏪' },
  { key: 'dispensaire', label: 'Dispensaires',      icon: '💊' },
  { key: 'cs',          label: 'Centres de santé',  icon: '➕' },
  { key: 'urgences',    label: 'Urgences 24h',      icon: '🚨' },
];

// ─── Haversine ────────────────────────────────────────────────
const calculerDistance = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const estimerMinutes = (km: number): number =>
  Math.round((km / 30) * 60);

// ─── Données démo ─────────────────────────────────────────────
const HOPITAUX_DEMO: Omit<Hopital, 'distance' | 'minutes'>[] = [
  { id: '1',  name: 'CHU Sylvanus Olympio',       type: 'hopital',     address: 'Bd du 13 Janvier, Lomé',          phone: '+22822212501', latitude: 6.1375, longitude: 1.2124, urgences: true  },
  { id: '2',  name: 'Hôpital de Bè',              type: 'hopital',     address: 'Quartier Bè, Lomé',               phone: '+22822253344', latitude: 6.1201, longitude: 1.2244, urgences: true  },
  { id: '3',  name: "Clinique de l'Espoir",        type: 'clinique',    address: 'Avenue du 24 Janvier, Lomé',      phone: '+22891000001', latitude: 6.1420, longitude: 1.2050, urgences: false },
  { id: '4',  name: 'Clinique Biasa',              type: 'clinique',    address: 'Nyékonakpoè, Lomé',               phone: '+22891000002', latitude: 6.1480, longitude: 1.2180, urgences: true  },
  { id: '5',  name: 'Dispensaire de Tokoin',       type: 'dispensaire', address: 'Tokoin, Lomé',                    phone: '+22891000003', latitude: 6.1550, longitude: 1.2300, urgences: false },
  { id: '6',  name: 'Centre de Santé Adidogomé',   type: 'cs',          address: 'Adidogomé, Lomé',                 phone: '+22891000004', latitude: 6.1680, longitude: 1.1980, urgences: false },
  { id: '7',  name: 'Hôpital Militaire de Lomé',   type: 'hopital',     address: 'Camp Gnassingbé Eyadéma, Lomé',  phone: '+22822214455', latitude: 6.1320, longitude: 1.2400, urgences: true  },
  { id: '8',  name: 'Clinique Ambroise Paré',      type: 'clinique',    address: 'Quartier Hédzranawoé, Lomé',     phone: '+22891000005', latitude: 6.1600, longitude: 1.2100, urgences: false },
  { id: '9',  name: 'Dispensaire Saint-Joseph',    type: 'dispensaire', address: 'Agoè, Lomé',                     phone: '+22891000006', latitude: 6.1780, longitude: 1.2050, urgences: false },
  { id: '10', name: 'Centre de Santé Kodjoviakopé',type: 'cs',          address: 'Kodjoviakopé, Lomé',             phone: '+22891000007', latitude: 6.1250, longitude: 1.2200, urgences: false },
];

export default function HospitauxScreen({ navigation }: any) {
  const [location,   setLocation]   = useState<Location.LocationObject | null>(null);
  const [hopitaux,   setHopitaux]   = useState<Hopital[]>([]);
  const [filtreActif,setFiltreActif]= useState<string>('tous');
  const [recherche,  setRecherche]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur,     setErreur]     = useState<string | null>(null);

  // ─── Charger position ─────────────────────────────────────
  const chargerPosition = useCallback(async () => {
    try {
      setErreur(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErreur('Permission de localisation refusée.\nActivez-la dans les paramètres.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc);
      calculerEtTrier(loc.coords.latitude, loc.coords.longitude);
    } catch {
      setErreur('Impossible de récupérer votre position.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const calculerEtTrier = (lat: number, lon: number) => {
    const liste = HOPITAUX_DEMO.map(h => {
      const d = calculerDistance(lat, lon, h.latitude, h.longitude);
      return { ...h, distance: Math.round(d * 10) / 10, minutes: estimerMinutes(d) };
    }).sort((a, b) => a.distance - b.distance);
    setHopitaux(liste);
  };

  useEffect(() => { chargerPosition(); }, []);

  const onRefresh = () => { setRefreshing(true); chargerPosition(); };

  // ─── Filtrage ─────────────────────────────────────────────
  const hopitauxFiltres = hopitaux.filter(h => {
    const matchR = recherche === '' ||
      h.name.toLowerCase().includes(recherche.toLowerCase()) ||
      h.address.toLowerCase().includes(recherche.toLowerCase());
    const matchF =
      filtreActif === 'tous' ||
      (filtreActif === 'urgences' && h.urgences) ||
      h.type === filtreActif;
    return matchR && matchF;
  });

  // ─── Actions ──────────────────────────────────────────────
  const ouvrirItineraire = (h: Hopital) => {
    const dest   = `${h.latitude},${h.longitude}`;
    const origin = location
      ? `${location.coords.latitude},${location.coords.longitude}`
      : '';
    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`geo:${dest}?q=${encodeURIComponent(h.name)}`)
    );
  };

  const couleurMinutes = (min: number) => {
    if (min <= 5)  return '#2E7D32';
    if (min <= 15) return '#F57F17';
    return colors.danger;
  };

  // ─── Compteur par filtre ───────────────────────────────────
  const compterFiltre = (key: string) => {
    if (key === 'tous')     return hopitaux.length;
    if (key === 'urgences') return hopitaux.filter(h => h.urgences).length;
    return hopitaux.filter(h => h.type === key).length;
  };

  // ─── Rendu carte ──────────────────────────────────────────
  const renderHopital = ({ item, index }: { item: Hopital; index: number }) => {
    const config = TYPE_CONFIG[item.type];
    return (
      <View style={styles.card}>
        {/* Rang */}
        <View style={[styles.rang, { backgroundColor: index === 0 ? colors.primary : '#F5F5F5' }]}>
          <Text style={[styles.rangText, { color: index === 0 ? '#fff' : colors.textSecondary }]}>
            #{index + 1}
          </Text>
        </View>

        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: config.bg }]}>
            <Text style={{ fontSize: 22 }}>{config.icon}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardName} numberOfLines={2}>
                {item.name}
              </Text>
              {item.urgences && (
                <View style={styles.urgenceBadge}>
                  <Text style={styles.urgenceText}>24h</Text>
                </View>
              )}
            </View>
            <View style={styles.badgesRow}>
              <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
                <Text style={[styles.typeBadgeText, { color: config.color }]}>
                  {config.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Adresse */}
        <View style={styles.addressRow}>
          <Text style={styles.addressIcon}>📍</Text>
          <Text style={styles.address} numberOfLines={1}>
            {item.address}
          </Text>
        </View>

        {/* Distance + temps */}
        <View style={styles.distanceRow}>
          <View style={styles.distanceBlock}>
            <Text style={styles.distanceValue}>{item.distance} km</Text>
            <Text style={styles.distanceLabel}>distance</Text>
          </View>
          <View style={styles.distanceDivider} />
          <View style={styles.distanceBlock}>
            <Text style={[styles.minutesValue, { color: couleurMinutes(item.minutes) }]}>
              {item.minutes} min
            </Text>
            <Text style={styles.distanceLabel}>en voiture</Text>
          </View>
          <View style={styles.distanceDivider} />
          <View style={styles.distanceBlock}>
            <Text style={[styles.minutesValue, { color: couleurMinutes(Math.round(item.minutes / 2)) }]}>
              {Math.round(item.minutes / 2)} min
            </Text>
            <Text style={styles.distanceLabel}>à moto</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {item.phone && (
            <TouchableOpacity
              style={styles.actionCall}
              onPress={() => Linking.openURL(`tel:${item.phone}`)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14 }}>📞</Text>
              <Text style={styles.actionCallText}>Appeler</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionMaps, !item.phone && { flex: 1 }]}
            onPress={() => ouvrirItineraire(item)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14 }}>🗺️</Text>
            <Text style={styles.actionMapsText}>Itinéraire</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Header commun ────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.flagBar}>
        <View style={[styles.flagStripe, { backgroundColor: colors.green }]} />
        <View style={[styles.flagStripe, { backgroundColor: colors.yellow }]} />
        <View style={[styles.flagStripe, { backgroundColor: colors.red }]} />
      </View>
      <View style={styles.headerContent}>
        <BackButton color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Centres de santé</Text>
          <Text style={styles.headerSub}>
            {hopitauxFiltres.length} centre{hopitauxFiltres.length > 1 ? 's' : ''} trouvé{hopitauxFiltres.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un centre de santé..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={recherche}
          onChangeText={setRecherche}
        />
        {recherche !== '' && (
          <TouchableOpacity onPress={() => setRecherche('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.searchClear}>×</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ─── États loading / erreur ───────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
        {renderHeader()}
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Localisation en cours...</Text>
          <Text style={styles.centerSub}>Merci de patienter</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (erreur) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
        {renderHeader()}
        <View style={styles.centerState}>
          <Text style={{ fontSize: 48 }}>📍</Text>
          <Text style={styles.centerText}>{erreur}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={chargerPosition}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── RENDU PRINCIPAL ──────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right'] as any}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {renderHeader()}

      {/* ── FILTRES — ScrollView horizontal ── */}
      <View style={styles.filtresWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtresContent}
          bounces={false}
        >
          {FILTRES.map(f => {
            const actif = filtreActif === f.key;
            const count = compterFiltre(f.key);
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filtre, actif && styles.filtreActif]}
                onPress={() => setFiltreActif(f.key)}
                activeOpacity={0.75}
              >
                <Text style={styles.filtreIcon}>{f.icon}</Text>
                <Text style={[styles.filtreText, actif && styles.filtreTextActif]}>
                  {f.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filtreBadge, actif && styles.filtreBadgeActif]}>
                    <Text style={[styles.filtreBadgeText, actif && { color: colors.primary }]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── LISTE ── */}
      <FlatList
        data={hopitauxFiltres}
        keyExtractor={item => item.id}
        renderItem={renderHopital}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🏥</Text>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptySub}>
              Essayez un autre filtre ou terme de recherche
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header:         { backgroundColor: colors.primaryDark },
  flagBar:        { flexDirection: 'row', height: 3 },
  flagStripe:     { flex: 1 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 8,
    gap: 8,
  },
  headerTitle: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  headerSub: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },

  // Recherche
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: '#fff',
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
    paddingHorizontal: 4,
  },

  // Filtres — la correction principale
  filtresWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtresContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  filtre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filtreActif: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filtreIcon:     { fontSize: 13 },
  filtreText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  filtreTextActif: { color: '#fff' },
  filtreBadge: {
    backgroundColor: colors.border,
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  filtreBadgeActif:  { backgroundColor: 'rgba(255,255,255,0.3)' },
  filtreBadgeText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },

  // Liste
  listContent: { padding: 14, paddingBottom: 32, gap: 10 },

  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 14,
    position: 'relative',
  },
  rang: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangText: { fontSize: fontSizes.xs, fontFamily: fonts.bold },

  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  typeIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flex: 1,
    paddingRight: 32,
  },
  cardName: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  urgenceBadge: {
    backgroundColor: '#D32F2F',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  urgenceText: { fontSize: 9, fontFamily: fonts.bold, color: '#fff' },
  badgesRow:   { flexDirection: 'row', gap: 6, marginTop: 4 },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  typeBadgeText: { fontSize: fontSizes.xs, fontFamily: fonts.semiBold },

  // Adresse
  addressRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  addressIcon:  { fontSize: 12 },
  address: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    flex: 1,
  },

  // Distance
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  distanceBlock:   { flex: 1, alignItems: 'center' },
  distanceValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  minutesValue:  { fontSize: fontSizes.md, fontFamily: fonts.bold },
  distanceLabel: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginTop: 1,
  },
  distanceDivider: { width: 1, height: 32, backgroundColor: colors.border },

  // Actions
  actions: { flexDirection: 'row', gap: 8 },
  actionCall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
    borderWidth: 0.5,
    borderColor: '#A5D6A7',
  },
  actionCallText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  actionMaps: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  actionMapsText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.semiBold,
    color: '#fff',
  },

  // États
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  centerText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.semiBold,
    color: colors.text,
    textAlign: 'center',
  },
  centerSub: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  retryText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  emptySub: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
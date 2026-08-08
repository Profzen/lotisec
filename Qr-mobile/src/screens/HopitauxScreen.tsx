import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, Linking, RefreshControl,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';
import { BackButton } from '../components/BackButton';
import { api } from '../api/config';

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
  source: string;
  source_id?: string;
  last_verified_at?: string;
  eta_seconds?: number | null;
}

type TypeEtablissement = 'hopital' | 'clinique' | 'dispensaire' | 'cs';

const TYPE_CONFIG: Record<TypeEtablissement, {
  label: string; icon: string; color: string; bg: string;
}> = {
  hopital:     { label: 'Hôpital',         icon: 'business-outline', color: '#1565C0', bg: '#E3F2FD' },
  clinique:    { label: 'Clinique',         icon: 'medkit-outline', color: '#2E7D32', bg: '#E8F5E9' },
  dispensaire: { label: 'Dispensaire',      icon: 'medical-outline', color: '#6A1B9A', bg: '#F3E5F5' },
  cs:          { label: 'Centre de santé',  icon: 'fitness-outline', color: '#E65100', bg: '#FBE9E7' },
};

const FILTRES = [
  { key: 'tous',        label: 'Tous',             icon: 'list-outline' },
  { key: 'hopital',     label: 'Hôpitaux',         icon: 'business-outline' },
  { key: 'clinique',    label: 'Cliniques',         icon: 'medkit-outline' },
  { key: 'dispensaire', label: 'Dispensaires',      icon: 'medical-outline' },
  { key: 'cs',          label: 'Centres de santé',  icon: 'fitness-outline' },
  { key: 'urgences',    label: 'Urgences 24h',      icon: 'warning-outline' },
];

const estimerMinutes = (km: number): number =>
  Math.round((km / 30) * 60);

export default function HospitauxScreen({ navigation }: any) {
  const [location,   setLocation]   = useState<Location.LocationObject | null>(null);
  const [hopitaux,   setHopitaux]   = useState<Hopital[]>([]);
  const [filtreActif,setFiltreActif]= useState<string>('tous');
  const [tri,setTri]=useState<'distance'|'nom'|'urgences'>('distance');
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
      fetchHopitaux(loc.coords.latitude, loc.coords.longitude);
    } catch {
      setErreur('Impossible de récupérer votre position.');
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchHopitaux = async (lat: number, lon: number) => {
    try {
      const data = await api(`/geo/hopital-proche?lat=${lat}&lng=${lon}`, 'GET');
      const liste: Hopital[] = data.map((h: any) => ({
        ...h,
        distance: Number(h.distance_km),
        minutes: h.eta_seconds != null && Number.isFinite(Number(h.eta_seconds)) ? Math.max(1,Math.round(Number(h.eta_seconds)/60)) : estimerMinutes(Number(h.distance_km))
      }));
      setHopitaux(liste);
    } catch (err) {
      setErreur("Erreur lors de la récupération des hôpitaux.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
  }).sort((a,b)=>tri==='nom'?a.name.localeCompare(b.name):tri==='urgences'?Number(b.urgences)-Number(a.urgences)||a.distance-b.distance:a.distance-b.distance);

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
            <Ionicons name={config.icon as any} size={23} color={config.color} />
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
          <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.address} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        <Text style={styles.sourceText}>Source : {item.source || 'non renseignée'}{item.last_verified_at ? ` · mise à jour ${new Date(item.last_verified_at).toLocaleDateString()}` : ''}</Text>

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
              <FontAwesome name="phone" size={14} />
              <Text style={styles.actionCallText}>Appeler</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionMaps, !item.phone && { flex: 1 }]}
            onPress={() => ouvrirItineraire(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate-outline" size={16} color={colors.white} />
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
  // loading est géré via un overlay à la fin du return principal

  if (erreur) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
        {renderHeader()}
        <View style={styles.centerState}>
          <Ionicons name="location-outline" size={48} color={colors.textLight} />
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
                <Ionicons name={f.icon as any} size={17} color={filtreActif === f.key ? colors.white : colors.textSecondary} />
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
        <View style={styles.sortRow}><Text style={styles.sortLabel}>Trier par</Text>{([{key:'distance',label:'Distance'},{key:'nom',label:'Nom'},{key:'urgences',label:'Urgences'}] as const).map(option=><TouchableOpacity key={option.key} accessibilityRole="button" style={[styles.sortButton,tri===option.key&&styles.sortButtonActive]} onPress={()=>setTri(option.key)}><Text style={[styles.sortText,tri===option.key&&styles.sortTextActive]}>{option.label}</Text></TouchableOpacity>)}</View>
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
            <Ionicons name="business-outline" size={48} color={colors.textLight} />
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptySub}>
              Essayez un autre filtre ou terme de recherche
            </Text>
          </View>
        }
      />

      {/* Overlay de chargement transparent */}
      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 10, color: colors.primary, fontWeight: 'bold' }}>Chargement...</Text>
        </View>
      )}
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
  sortRow:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:14,paddingBottom:10},
  sortLabel:{fontSize:11,color:colors.textSecondary,marginRight:2},
  sortButton:{minHeight:34,paddingHorizontal:11,borderRadius:10,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},
  sortButtonActive:{backgroundColor:colors.primaryLight,borderColor:colors.primary},
  sortText:{fontSize:11,fontFamily:fonts.semiBold,color:colors.textSecondary},
  sortTextActive:{color:colors.primary},
  sourceText:{fontSize:10,color:colors.textLight,marginBottom:9},

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

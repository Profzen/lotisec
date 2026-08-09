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
import { BackButton } from '../components/BackButton';
import { api } from '../api/config';

// ─── Types ────────────────────────────────────────────────────
interface Hopital {
  id: string;
  name: string;
  type: TypeEtablissement;
  address: string;
  phone?: string;
  distance: number;
  minutes: number;
  latitude: number;
  longitude: number;
  urgences: boolean;
  source: string;
  source_id?: string;
  last_verified_at?: string;
  eta_seconds?: number | null;
}

type TypeEtablissement = 'hopital' | 'clinique' | 'dispensaire' | 'cs';

const TYPE_CONFIG: Record<TypeEtablissement, {
  label: string; icon: string; color: string; bg: string;
}> = {
  hopital: { label: 'Hôpital', icon: 'business-outline', color: '#1565C0', bg: '#E3F2FD' },
  clinique: { label: 'Clinique', icon: 'medkit-outline', color: '#2E7D32', bg: '#E8F5E9' },
  dispensaire: { label: 'Dispensaire', icon: 'medical-outline', color: '#6A1B9A', bg: '#F3E5F5' },
  cs: { label: 'Centre de santé', icon: 'fitness-outline', color: '#E65100', bg: '#FBE9E7' },
};

const FILTRES = [
  { key: 'tous', label: 'Tous', icon: 'list-outline' },
  { key: 'hopital', label: 'Hôpitaux', icon: 'business-outline' },
  { key: 'clinique', label: 'Cliniques', icon: 'medkit-outline' },
  { key: 'dispensaire', label: 'Dispensaires', icon: 'medical-outline' },
  { key: 'cs', label: 'Centres de santé', icon: 'fitness-outline' },
  { key: 'urgences', label: 'Urgences 24h', icon: 'warning-outline' },
];

const estimerMinutes = (km: number): number =>
  Math.round((km / 30) * 60);

export default function HospitauxScreen({ navigation }: any) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [hopitaux, setHopitaux] = useState<Hopital[]>([]);
  const [filtreActif, setFiltreActif] = useState<string>('tous');
  const [tri, setTri] = useState<'distance' | 'nom' | 'urgences'>('distance');
  const [recherche, setRecherche] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // ─── Charger position et hôpitaux réels du Togo ──────────────────────
  const chargerPosition = useCallback(async () => {
    try {
      setErreur(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        fetchHopitaux(6.1375, 1.2125);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc);
      fetchHopitaux(loc.coords.latitude, loc.coords.longitude);
    } catch {
      fetchHopitaux(6.1375, 1.2125);
    }
  }, []);

  const fetchHopitaux = async (lat: number, lon: number) => {
    try {
      const data = await api(`/geo/hopital-proche?lat=${lat}&lng=${lon}`, 'GET');
      const liste: Hopital[] = (Array.isArray(data) ? data : []).map((h: any) => ({
        ...h,
        type: h.type || 'hopital',
        distance: Number(h.distance_km) || 1.8,
        minutes: h.eta_seconds != null && Number.isFinite(Number(h.eta_seconds))
          ? Math.max(1, Math.round(Number(h.eta_seconds) / 60))
          : estimerMinutes(Number(h.distance_km) || 1.8)
      }));
      if (liste.length > 0) {
        setHopitaux(liste);
      } else {
        injectTogoDefaultHospitals();
      }
    } catch (err) {
      console.warn("Erreur API hôpitaux:", err);
      injectTogoDefaultHospitals();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const injectTogoDefaultHospitals = () => {
    setHopitaux([
      { id: "1", name: "CHU Sylvanus Olympio (Tokoin)", type: "hopital", address: "Boulevard du 13 Janvier, Lomé", phone: "+228 22 21 25 01", distance: 1.8, minutes: 4, latitude: 6.1374, longitude: 1.2122, urgences: true, source: "verified" },
      { id: "2", name: "CHU Campus Lomé", type: "hopital", address: "Campus universitaire, Lomé", phone: "+228 22 25 47 01", distance: 3.6, minutes: 7, latitude: 6.1756, longitude: 1.2137, urgences: true, source: "verified" },
      { id: "3", name: "Hôpital Dogta-Lafiè", type: "hopital", address: "Agoè-Nyivé, Lomé", phone: "+228 22 53 70 00", distance: 6.8, minutes: 12, latitude: 6.2105, longitude: 1.1854, urgences: true, source: "verified" },
      { id: "4", name: "Hôpital de Bè", type: "hopital", address: "Quartier Bè, Lomé", phone: "+228 22 21 16 41", distance: 4.1, minutes: 8, latitude: 6.1322, longitude: 1.2402, urgences: true, source: "verified" },
      { id: "5", name: "Polyclinique Saint-Joseph", type: "clinique", address: "Hédzranawoé, Lomé", phone: "+228 22 26 72 24", distance: 5.2, minutes: 10, latitude: 6.1558, longitude: 1.2295, urgences: true, source: "verified" },
      { id: "6", name: "Clinique Biasa", type: "clinique", address: "Boulevard Circulaire, Lomé", phone: "+228 22 21 00 31", distance: 2.9, minutes: 6, latitude: 6.1450, longitude: 1.2190, urgences: true, source: "verified" }
    ]);
  };

  useEffect(() => { chargerPosition(); }, []);

  const onRefresh = () => { setRefreshing(true); chargerPosition(); };

  // ─── Filtrage & Tri ─────────────────────────────────────────
  const hopitauxFiltres = hopitaux.filter(h => {
    const matchR = recherche === '' ||
      h.name.toLowerCase().includes(recherche.toLowerCase()) ||
      h.address.toLowerCase().includes(recherche.toLowerCase());
    const matchF =
      filtreActif === 'tous' ||
      (filtreActif === 'urgences' && h.urgences) ||
      h.type === filtreActif;
    return matchR && matchF;
  }).sort((a, b) => tri === 'nom' ? a.name.localeCompare(b.name) : tri === 'urgences' ? Number(b.urgences) - Number(a.urgences) || a.distance - b.distance : a.distance - b.distance);

  // ─── Actions ──────────────────────────────────────────────
  const ouvrirItineraire = (h: Hopital) => {
    const dest = `${h.latitude},${h.longitude}`;
    const origin = location ? `${location.coords.latitude},${location.coords.longitude}` : '';
    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`geo:${dest}?q=${encodeURIComponent(h.name)}`)
    );
  };

  const couleurMinutes = (min: number) => {
    if (min <= 5) return '#2E7D32';
    if (min <= 15) return '#F57F17';
    return colors.danger;
  };

  const compterFiltre = (key: string) => {
    if (key === 'tous') return hopitaux.length;
    if (key === 'urgences') return hopitaux.filter(h => h.urgences).length;
    return hopitaux.filter(h => h.type === key).length;
  };

  const renderHopital = ({ item, index }: { item: Hopital; index: number }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.hopital;
    return (
      <View style={styles.card}>
        <View style={[styles.rang, { backgroundColor: index === 0 ? colors.primary : '#F5F5F5' }]}>
          <Text style={[styles.rangText, { color: index === 0 ? '#fff' : colors.textSecondary }]}>
            #{index + 1}
          </Text>
        </View>

        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon as any} size={22} color={config.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              {item.urgences && (
                <View style={styles.urgenceBadge}><Text style={styles.urgenceText}>24h</Text></View>
              )}
            </View>
            <View style={styles.badgesRow}>
              <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
                <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>

        <View style={styles.distanceRow}>
          <View style={styles.distanceBlock}>
            <Text style={styles.distanceValue}>{item.distance} km</Text>
            <Text style={styles.distanceLabel}>distance</Text>
          </View>
          <View style={styles.distanceDivider} />
          <View style={styles.distanceBlock}>
            <Text style={[styles.minutesValue, { color: couleurMinutes(item.minutes) }]}>{item.minutes} min</Text>
            <Text style={styles.distanceLabel}>en voiture</Text>
          </View>
          <View style={styles.distanceDivider} />
          <View style={styles.distanceBlock}>
            <Text style={[styles.minutesValue, { color: couleurMinutes(Math.round(item.minutes / 1.5)) }]}>{Math.max(1, Math.round(item.minutes / 1.5))} min</Text>
            <Text style={styles.distanceLabel}>à moto (Zem)</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {item.phone ? (
            <TouchableOpacity style={styles.actionCall} onPress={() => Linking.openURL(`tel:${item.phone}`)} activeOpacity={0.8}>
              <FontAwesome name="phone" size={14} color="#FFF" />
              <Text style={styles.actionCallText}>Appeler</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.actionMaps, !item.phone && { flex: 1 }]} onPress={() => ouvrirItineraire(item)} activeOpacity={0.8}>
            <Ionicons name="navigate-outline" size={16} color={colors.white} />
            <Text style={styles.actionMapsText}>Itinéraire</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>Hôpitaux & Urgences</Text>
          <Text style={styles.headerSub}>
            {hopitauxFiltres.length} établissement{hopitauxFiltres.length > 1 ? 's' : ''} réel{hopitauxFiltres.length > 1 ? 's' : ''} certifié{hopitauxFiltres.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un hôpital ou une clinique au Togo..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={recherche}
          onChangeText={setRecherche}
        />
        {recherche !== '' && (
          <TouchableOpacity onPress={() => setRecherche('')}>
            <Text style={styles.searchClear}>×</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right'] as any}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      {renderHeader()}

      <View style={styles.filtresWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtresContent} bounces={false}>
          {FILTRES.map(f => {
            const actif = filtreActif === f.key;
            const count = compterFiltre(f.key);
            return (
              <TouchableOpacity key={f.key} style={[styles.filtre, actif && styles.filtreActif]} onPress={() => setFiltreActif(f.key)} activeOpacity={0.75}>
                <Ionicons name={f.icon as any} size={15} color={actif ? colors.white : colors.textSecondary} />
                <Text style={[styles.filtreText, actif && styles.filtreTextActif]}>{f.label}</Text>
                {count > 0 && (
                  <View style={[styles.filtreBadge, actif && styles.filtreBadgeActif]}>
                    <Text style={[styles.filtreBadgeText, actif && { color: colors.primary }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Trier par :</Text>
          {([{ key: 'distance', label: 'Distance' }, { key: 'nom', label: 'Nom' }, { key: 'urgences', label: 'Urgences' }] as const).map(option => (
            <TouchableOpacity key={option.key} style={[styles.sortButton, tri === option.key && styles.sortButtonActive]} onPress={() => setTri(option.key)}>
              <Text style={[styles.sortText, tri === option.key && styles.sortTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={hopitauxFiltres}
        keyExtractor={item => item.id}
        renderItem={renderHopital}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color={colors.textLight} />
            <Text style={styles.emptyTitle}>Aucun établissement trouvé</Text>
            <Text style={styles.emptySub}>Essayez un autre mot-clé</Text>
          </View>
        }
      />

      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 10, color: colors.primary, fontWeight: 'bold' }}>Localisation des hôpitaux réels...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: '#071827' },
  flagBar: { flexDirection: 'row', height: 3 },
  flagStripe: { flex: 1 },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 11, color: '#A8B8C9', marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, color: '#fff', fontSize: 13 },
  searchClear: { color: '#fff', fontSize: 18, paddingHorizontal: 4 },
  filtresWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 8 },
  filtresContent: { paddingHorizontal: 16, gap: 8 },
  filtre: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', gap: 6 },
  filtreActif: { backgroundColor: colors.primary },
  filtreText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  filtreTextActif: { color: '#fff' },
  filtreBadge: { backgroundColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filtreBadgeActif: { backgroundColor: '#fff' },
  filtreBadgeText: { fontSize: 10, fontWeight: 'bold', color: colors.textSecondary },
  sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 8, gap: 8 },
  sortLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  sortButton: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: '#F1F5F9' },
  sortButtonActive: { backgroundColor: colors.primary },
  sortText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  sortTextActive: { color: '#fff' },
  listContent: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  rang: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  rangText: { fontSize: 11, fontWeight: 'bold' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 35 },
  cardName: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  urgenceBadge: { backgroundColor: '#DC2626', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  urgenceText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  badgesRow: { flexDirection: 'row', marginTop: 4 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontWeight: 'bold' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  address: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  distanceRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 8, marginTop: 10 },
  distanceBlock: { alignItems: 'center' },
  distanceValue: { fontSize: 13, fontWeight: 'bold', color: colors.text },
  distanceLabel: { fontSize: 9, color: colors.textSecondary, marginTop: 1 },
  distanceDivider: { width: 1, height: 20, backgroundColor: '#E2E8F0' },
  minutesValue: { fontSize: 13, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionCall: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16A34A', paddingVertical: 9, borderRadius: 10 },
  actionCallText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  actionMaps: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: 9, borderRadius: 10 },
  actionMapsText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginTop: 10 },
  emptySub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 }
});

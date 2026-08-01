import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { supabase } from '../api/supabase';
import { api } from '../api/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

export default function RidesScreen({ navigation }: any) {
  const [rides, setRides] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [zemLocation, setZemLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem('lotisec_user');
      if (!raw) return;
      const user = JSON.parse(raw);
      
      const res = await api(`/zem/history/${user.id}`, 'GET');
      if (res.rides) {
        setRides(res.rides);
        const currentActive = res.rides.find((r: any) => ['requested', 'accepted', 'in_progress'].includes(r.status));
        setActiveRide(currentActive || null);
        if (currentActive) {
          fetchZemLoc(currentActive.zem_id);
        }
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchZemLoc = async (zemId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('zem_locations').select('*').eq('zem_id', zemId).single();
    if (data) {
      setZemLocation({ lat: data.latitude, lng: data.longitude });
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (!supabase || !activeRide) return;

    const rideChannel = supabase
      .channel('ride_updates_mobile')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${activeRide.id}` }, payload => {
        setActiveRide(payload.new);
        setRides(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
        if (['completed', 'canceled', 'declined'].includes(payload.new.status)) {
          setActiveRide(null);
          setZemLocation(null);
        }
      })
      .subscribe();

    const locChannel = supabase
      .channel('zem_tracking_mobile')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'zem_locations', filter: `zem_id=eq.${activeRide.zem_id}` }, payload => {
        setZemLocation({ lat: payload.new.latitude, lng: payload.new.longitude });
      })
      .subscribe();

    return () => {
      supabase?.removeChannel(rideChannel);
      supabase?.removeChannel(locChannel);
    };
  }, [activeRide]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Trajets</Text>
        <TouchableOpacity onPress={fetchHistory}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={{ flex: 1 }}>
            {activeRide && (
              <View style={[styles.card, { marginBottom: 20, borderWidth: 2, borderColor: colors.primary }]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Course {activeRide.status === 'requested' ? 'en attente' : 'en cours'}</Text>
                  <Text style={styles.cardSub}>{activeRide.price_fcfa} FCFA • {activeRide.distance_km} km</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.statusText}>
                    {activeRide.status === 'requested' && "Recherche d'un conducteur..."}
                    {activeRide.status === 'accepted' && "Le conducteur est en route !"}
                    {activeRide.status === 'in_progress' && "Trajet en cours vers la destination !"}
                  </Text>
                  <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('ZemPassenger')}>
                    <Text style={styles.btnText}>Ouvrir la Carte</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.historyTitle}>Historique</Text>
            {rides.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={64} color={colors.border} />
                <Text style={styles.emptyTitle}>Aucune course</Text>
                <Text style={styles.emptySub}>Vous n'avez pas encore effectué de trajet.</Text>
                <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('ZemPassenger')}>
                  <Text style={styles.btnText}>Commander un Zem</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ paddingBottom: 20 }}>
                {rides.filter(r => r.id !== activeRide?.id).map((ride, idx) => (
                  <View key={idx} style={styles.historyItem}>
                    <View style={[styles.historyIcon, { backgroundColor: ride.status === 'completed' ? colors.success : ride.status === 'canceled' || ride.status === 'declined' ? colors.danger : colors.warning }]}>
                      {ride.status === 'completed' ? <Ionicons name="checkmark" size={24} color="white" /> : ride.status === 'canceled' || ride.status === 'declined' ? <Ionicons name="close" size={24} color="white" /> : <Ionicons name="time" size={24} color="white" />}
                    </View>
                    <View style={styles.historyContent}>
                      <Text style={styles.historyItemTitle}>Trajet ZEM</Text>
                      <Text style={styles.historyItemSub}>{new Date(ride.created_at).toLocaleDateString()} • {ride.distance_km} km</Text>
                    </View>
                    <Text style={styles.historyItemPrice}>{ride.price_fcfa} FCFA</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  content: { flex: 1, padding: 20 },
  card: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  cardHeader: { backgroundColor: colors.primary, padding: 15 },
  cardTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  cardSub: { color: 'white', opacity: 0.9, marginTop: 5 },
  cardBody: { padding: 20, alignItems: 'center' },
  statusText: { fontSize: 16, color: colors.textSecondary, marginBottom: 20, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingBottom: 50 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  historyTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  historyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  historyContent: { flex: 1 },
  historyItemTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
  historyItemSub: { fontSize: 12, color: colors.textSecondary },
  historyItemPrice: { fontSize: 16, fontWeight: 'bold', color: colors.text }
});

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar,
  Animated, Vibration, Alert, Linking, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';
import ProfilePanel from './ProfilePanel';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome } from '@expo/vector-icons';
import { api } from '../api/config';
import { hydrateSession } from '../services/session';

import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface ScanHistorique {
  id: string;
  date: string;
  lieu?: string;
  niveau: string;
  authority?: string;
}

// --- COMPOSANTS INTERNES ---
const ProfileIconSVG = () => (
  <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.9)', marginBottom: 2 }} />
    <View style={{ width: 18, height: 7, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: 'rgba(255,255,255,0.9)' }} />
  </View>
);

const CONTACTS = [
  {
    id: '0',
    name: 'Sapeurs-Pompiers',
    phone: '118',
    isPompiers: true,
    service: 'fire' as const,
    avatarBg: '#fab41cc5',
    avatarColor: '#FF6B6B',
    initial: 'fire-extinguisher',
  },
  {
    id: 'ambulance', name: 'Service ambulancier', phone: '8200', isPompiers: false,
    service: 'ambulance' as const, avatarBg: '#EAF2FF', avatarColor: '#1565D8', initial: 'ambulance',
  },
  {
    id: '1',
    name: 'A prevenir',
    phone: '+22891127584',
    isPompiers: false,
    service: null,
    avatarBg: '#fa1c1cc5',
    avatarColor: colors.primary,
    initial: 'user',
  },
  {
    id: '2',
    name: 'A prevenir',
    phone: '+22898000493',
    isPompiers: false,
    service: null,
    avatarBg: '#fab41cc5',
    avatarColor: colors.primary,
    initial: 'user',
  },
];

export default function HomeScreen({ navigation }: Props) {
  const [sosActif, setSosActif] = useState(false);
  const [alerteEnvoyee, setAlerteEnvoyee] = useState(false);
  const [assignedUnit, setAssignedUnit] = useState<any>(null);
  const [assignedHospital, setAssignedHospital] = useState<any>(null);
  const [dispatchStatus, setDispatchStatus] = useState<'assigned'|'recommended'|'awaiting_dispatch'>('awaiting_dispatch');
  const [sosIncidentId, setSosIncidentId] = useState<string | null>(null);
  const [sosClientEventId, setSosClientEventId] = useState<string | null>(null);
  const [complementModalVisible, setComplementModalVisible] = useState(false);
  const [complementType, setComplementType] = useState('Accident routier');
  const [complementVictims, setComplementVictims] = useState('Je ne sais pas');
  const [complementDangers, setComplementDangers] = useState<string[]>([]);
  const [complementVehicles, setComplementVehicles] = useState('Je ne sais pas');
  const [complementLoading, setComplementLoading] = useState(false);
  const [complementDone, setComplementDone] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [scans, setScans] = useState<ScanHistorique[]>([]);
  const [qrState,setQrState]=useState<'loading'|'ready'|'missing'|'error'>('loading');
  const [showScans, setShowScans] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const pulseRing1 = useRef(new Animated.Value(1)).current;
  const pulseRing2 = useRef(new Animated.Value(1)).current;
  const pulseOpacity1 = useRef(new Animated.Value(0.4)).current;
  const pulseOpacity2 = useRef(new Animated.Value(0.4)).current;

  const th = {
    bg: isDark ? '#061322' : colors.background,
    cardBg: isDark ? '#0D2238' : colors.white,
    cardBorder: isDark ? '#1C3854' : colors.border,
    text: isDark ? '#F4F8FC' : colors.text,
    text2: isDark ? '#A8B8C9' : colors.textSecondary,
    text3: isDark ? '#7890A8' : colors.textLight,
    avatarBg: isDark ? '#12385C' : colors.primaryLight,
    avatarColor: isDark ? '#71D4F5' : colors.primary,
    actionCall: isDark ? '#12385C' : colors.primaryLight,
    actionWA: isDark ? '#14362F' : colors.successSoft,
    divider: isDark ? '#1C3854' : colors.border,
  };

  // Reprise hors-ligne
  const PENDING_QUEUE_KEY = 'pending_incidents';
  const queuePendingIncident = async (payload: any) => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.push({ payload, created_at: new Date().toISOString(), attempts: 0 });
      await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(list));
    } catch {}
  };

  const flushPendingIncidents = async (token?: string) => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list) || list.length === 0) return;
      const remaining: any[] = [];
      for (const item of list) {
        try {
          await api('/api/v1/incidents', 'POST', item.payload, token);
        } catch {
          remaining.push({ ...item, attempts: (item.attempts || 0) + 1 });
        }
      }
      await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
    } catch {}
  };

  // Polling du statut réel côté supervision LOTISEC
  useEffect(() => {
    if (!sosActif || !sosIncidentId) return;
    const interval = setInterval(async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const res = await api('/api/v1/incidents/' + sosIncidentId + '/status', 'GET', undefined, token || undefined);
        if (res?.incident) {
          if (res.incident.status === 'cancelled' || res.incident.status === 'rejected') {
            setSosActif(false);
            setAlerteEnvoyee(false);
            setSosIncidentId(null);
          } else if (res.incident.status === 'assigned') {
            setDispatchStatus('assigned');
          }
        }
        if (res?.intervention?.unit_name) {
          setAssignedUnit({
            name: res.intervention.unit_name,
            phone: res.intervention.unit_phone || '118',
            status: 'assigned'
          });
          setDispatchStatus('assigned');
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [sosActif, sosIncidentId]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const session = await hydrateSession(true);
        if (!session) { setQrState('error'); return; }
        
        let token = session.user?.qr_token;
        let currentUser = session.user;

        if (!token && session.token) {
          try {
            const me = await api('/auth/me', 'GET', undefined, session.token);
            if (me?.user?.qr_token) {
              token = me.user.qr_token;
              currentUser = me.user;
            }
          } catch (e) {
            console.warn('Erreur auto-récupération /auth/me:', e);
          }
        }

        setProfile(currentUser);
        setQrToken(token || null);
        setQrState(token ? 'ready' : 'missing');
        void flushPendingIncidents(session.token);

        const history = await api('/scans/me?page_size=10', 'GET', undefined, session.token).catch(() => ({ items: [] }));
        setScans((history.items || []).map((item: any) => ({
          id: item.id,
          date: new Date(item.created_at).toLocaleString(),
          niveau: item.access_level || 'professionnel',
          authority: item.authority,
          lieu: item.latitude != null ? `${Number(item.latitude).toFixed(3)}, ${Number(item.longitude).toFixed(3)}` : undefined
        })));
      } catch (e) {
        console.log('Erreur chargement données:', e);
        setQrState('error');
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseRing1, { toValue: 1.18, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseOpacity1, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseRing1, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity1, { toValue: 0.18, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(400),
      ])
    ).start();

    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseRing2, { toValue: 1.30, duration: 1400, useNativeDriver: true }),
            Animated.timing(pulseOpacity2, { toValue: 0, duration: 1400, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseRing2, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(pulseOpacity2, { toValue: 0.1, duration: 0, useNativeDriver: true }),
          ]),
          Animated.delay(400),
        ])
      ).start();
    }, 500);
  }, []);

  const envoyerSOS = async () => {
    Vibration.vibrate([0, 500, 100, 500]);
    let coords: { latitude: number; longitude: number; accuracy: number } | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Position GPS requise',
          'L’accès à votre géolocalisation est indispensable pour que LOTISEC transmette votre position exacte aux services de secours.',
          [
            { text: 'Appeler le 118', onPress: () => Linking.openURL('tel:118') },
            { text: 'Réessayer', onPress: envoyerSOS },
            { text: 'Annuler', style: 'cancel' }
          ]
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 10
      };
    } catch {
      Alert.alert(
        'Signal GPS indisponible',
        'Impossible d’obtenir votre position satellite actuelle. Vérifiez que votre GPS est actif ou appelez directement le 118.',
        [
          { text: 'Appeler le 118', onPress: () => Linking.openURL('tel:118') },
          { text: 'Réessayer', onPress: envoyerSOS },
          { text: 'Annuler', style: 'cancel' }
        ]
      );
      return;
    }

    if (!coords) return;

    const token = await AsyncStorage.getItem('token');
    const storedUser = await AsyncStorage.getItem('user');
    const currentUser = storedUser ? JSON.parse(storedUser) : null;
    const clientEventId = `mobile-${currentUser?.id || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const payload = {
      source: 'mobile',
      type: 'Urgence citoyenne',
      severity: 'unknown',
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      address: 'Position GPS mobile',
      victims: 0,
      vehicles: 0,
      flags: ['details_pending', 'victims_unknown', 'vehicles_unknown'],
      qr_token: currentUser?.qr_token,
      client_event_id: clientEventId
    };

    try {
      const res = await api('/api/v1/incidents', 'POST', payload, token || undefined);
      const incId = res?.incident?.id || null;
      setSosIncidentId(incId);
      setSosClientEventId(clientEventId);
      setAssignedUnit(res?.closest_unit || null);
      setAssignedHospital(res?.closest_hospital || null);
      setDispatchStatus(res?.dispatch_status || 'awaiting_dispatch');
      setSosActif(true);
      setAlerteEnvoyee(true);
      setComplementModalVisible(true);
    } catch {
      await queuePendingIncident(payload);
      setSosActif(true);
      setAlerteEnvoyee(true);
      Alert.alert(
        'Alerte enregistrée en local',
        'Réseau indisponible. Votre alerte d’urgence a été sauvegardée et sera transmise dès le rétablissement de la connexion.',
        [
          { text: 'Appeler le 118', onPress: () => Linking.openURL('tel:118') },
          { text: 'OK' }
        ]
      );
    }
  };

  const annulerAlerte = () => {
    Alert.alert(
      "Annuler l'alerte ?",
      "Confirmez-vous l'annulation de l'alerte d'urgence ?",
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            const token = await AsyncStorage.getItem('token');
            if (sosIncidentId) {
              try {
                await api('/api/v1/incidents/' + sosIncidentId + '/status', 'PATCH', {
                  status: 'cancelled',
                  client_event_id: sosClientEventId
                }, token || undefined);
              } catch (e) {
                console.log('Erreur annulation alerte:', e);
              }
            }
            setSosActif(false);
            setAlerteEnvoyee(false);
            setComplementModalVisible(false);
            setSosIncidentId(null);
            setSosClientEventId(null);
          }
        }
      ]
    );
  };

  const submitComplement = async (skip: boolean = false) => {
    setComplementLoading(true);
    try {
      if (!skip && sosIncidentId) {
        const token = await AsyncStorage.getItem('token');
        const flags = [...complementDangers];
        if (complementVictims === 'Je ne sais pas') flags.push('victims_unknown');
        if (complementVehicles === 'Je ne sais pas') flags.push('vehicles_unknown');

        let victimsCount = 0;
        if (complementVictims === '1') victimsCount = 1;
        else if (complementVictims === '2 à 5') victimsCount = 3;
        else if (complementVictims === '+ de 5') victimsCount = 6;

        let vehiclesCount = 0;
        if (complementVehicles === '1') vehiclesCount = 1;
        else if (complementVehicles === '2') vehiclesCount = 2;
        else if (complementVehicles === 'Plusieurs') vehiclesCount = 3;

        await api('/api/v1/incidents/' + sosIncidentId + '/report', 'PATCH', {
          type: complementType,
          victims: victimsCount,
          vehicles: vehiclesCount,
          flags
        }, token || undefined);
      }
    } catch (e) {
      console.log('Erreur envoi complément:', e);
    } finally {
      setComplementLoading(false);
      setComplementModalVisible(false);
      setComplementDone(true);
    }
  };

  const handleSOS = () => {
    if (sosActif) {
      annulerAlerte();
    } else {
      void envoyerSOS();
    }
  };

  const contactService = (contact: any) => {
    Linking.openURL('tel:' + contact.phone);
  };

  const generatePDF = async () => {
    if(!qrToken) return Alert.alert("Erreur", "Token introuvable.");
    const html = `
      <html><body style="text-align:center;font-family:Helvetica;padding:40px;">
        <h1 style="color:#D21034;">LOTISEC</h1> 
        <h2>Fiche d'urgence</h2>
        <hr/>
        <div style="margin:30px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://lotisec-frontend.vercel.app/scan/${qrToken}" width="250" height="250" />
        </div>
        
      </body></html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: th.bg }]} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={sosActif ? colors.danger : colors.primaryDark} />

      <View style={[styles.header, { backgroundColor: sosActif ? colors.danger : colors.primaryDark }]}>
        <View style={styles.flagBar}>
          <View style={[styles.flagStripe, { backgroundColor: colors.green }]} />
          <View style={[styles.flagStripe, { backgroundColor: colors.yellow }]} />
          <View style={[styles.flagStripe, { backgroundColor: colors.red }]} />
        </View>

        <View style={styles.topRow}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoSave}>LOTI</Text>
            <Text style={styles.logoMe}>SEC</Text>
          </View>
          <TouchableOpacity style={styles.profileIcon} onPress={() => setPanelVisible(true)}>
            <ProfileIconSVG />
          </TouchableOpacity>
        </View>

        <View style={styles.sosSection}>
          
          <View style={styles.sosContainer}>
            <Animated.View style={[styles.sosRipple2, { transform: [{ scale: pulseRing2 }], opacity: pulseOpacity2, backgroundColor: sosActif ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.9)' }]} />
            <Animated.View style={[styles.sosRipple1, { transform: [{ scale: pulseRing1 }], opacity: pulseOpacity1, backgroundColor: sosActif ? 'rgba(255,80,80,0.4)' : 'rgba(255,255,255,0.9)' }]} />
            <View style={[styles.sosRing1, sosActif && styles.sosRing1Active]}>
              <View style={[styles.sosRing2, sosActif && styles.sosRing2Active]}>
                <TouchableOpacity onPress={handleSOS} activeOpacity={0.85} style={[styles.sosCore, sosActif && styles.sosCoreActive]}>
                  <Text style={styles.sosLabel}>SOS</Text>
                  <Text style={styles.sosSub}>{sosActif ? 'ANNULER' : 'URGENCE'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={styles.sosStatus}>
            
            <Text style={styles.sosHint}>{sosActif ? 'APPUYER POUR ANNULER' : 'DÉCLENCHER LE SOS'}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        
        {sosActif && (
          <View style={[styles.card, { backgroundColor: '#0D2033', borderColor: '#DC2626', borderWidth: 1.5, padding: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' }} />
              <Text style={{ color: '#F87171', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 }}>{dispatchStatus === 'assigned' ? 'UNITÉ DE SECOURS AFFECTÉE' : 'ALERTE TRANSMISE · AFFECTATION EN ATTENTE'}</Text>
            </View>
            <View style={{ backgroundColor: '#11273C', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <Text style={{ color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', fontWeight: '600' }}>{dispatchStatus === 'assigned' ? 'Unité affectée' : 'Unité recommandée'}</Text>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: 'bold', marginVertical: 2 }}>{assignedUnit?.name || 'Sapeurs-Pompiers Lomé (118)'}</Text>
              <Text style={{ color: dispatchStatus === 'assigned' ? '#4ADE80' : '#FBBF24', fontSize: 12, fontWeight: '600' }}>{dispatchStatus === 'assigned' ? 'Mission reçue par le service' : 'Disponibilité et départ à confirmer'} · ETA indicative : ~{assignedUnit?.eta_minutes || 5} min</Text>
            </View>
            <View style={{ backgroundColor: '#11273C', borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <Text style={{ color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', fontWeight: '600' }}>Hôpital récepteur d'urgence</Text>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold', marginVertical: 2 }}>{assignedHospital?.name || 'CHU Sylvanus Olympio'}</Text>
              <Text style={{ color: '#388BFD', fontSize: 11 }}>Service d'urgences 24h/24 prêt à vous accueillir</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
              onPress={() => Linking.openURL(`tel:${assignedUnit?.phone || '118'}`)}
            >
              <FontAwesome name="phone" size={16} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Appel direct des secours ({assignedUnit?.phone || '118'})</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: th.cardBg, borderColor: th.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: th.text2 }]}>CENTRE DE SÉCURITÉ</Text>
          
          <TouchableOpacity style={[styles.alertRow, { backgroundColor: colors.primaryLight }]} onPress={() => navigation.navigate('Assistant' as any)}>
            <View style={[styles.alertIcon, { backgroundColor: colors.primary }]}><FontAwesome name="comments-o" size={19} color={colors.white}/></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: colors.primary }]}>Assistant IA LOTISEC</Text>
              <Text style={[styles.alertSub, { color: colors.primary, opacity: 0.7 }]}>Questions sur le code de la route</Text>
            </View>
            <Text style={[styles.chevron, { color: th.text3 }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.alertRow} onPress={handleSOS}>
            <View style={[styles.alertIcon, { backgroundColor: colors.danger }]}><FontAwesome name="exclamation-triangle" size={18} color={colors.white}/></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: isDark ? '#FF6B6B' : colors.danger }]}>Alerter mes contacts</Text>
              <Text style={[styles.alertSub, { color: isDark ? '#FF6B6B' : colors.danger, opacity: 0.6 }]}>WhatsApp + Position GPS</Text>
            </View>
            <Text style={[styles.chevron, { color: th.text3 }]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: th.cardBg, borderColor: th.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: th.text2 }]}>DÉPLACEMENT & ZEM</Text>
          <TouchableOpacity style={styles.alertRow} onPress={() => navigation.navigate('ZemPassenger' as any)}>
            <View style={[styles.alertIcon, { backgroundColor: colors.primary }]}><FontAwesome name="motorcycle" size={19} color={colors.white}/></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: th.text }]}>Commander un Zem</Text>
              <Text style={[styles.alertSub, { color: th.text3 }]}>Trouvez un conducteur à proximité</Text>
            </View>
            <Text style={[styles.chevron, { color: th.text3 }]}>›</Text>
          </TouchableOpacity>

          {profile?.is_zem && (
            <TouchableOpacity style={[styles.alertRow, { backgroundColor: 'rgba(0,200,83,0.05)' }]} onPress={() => navigation.navigate('ZemDriver' as any)}>
              <View style={[styles.alertIcon, { backgroundColor: colors.success }]}><FontAwesome name="road" size={19} color={colors.white}/></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: colors.success }]}>Mode Conducteur</Text>
                <Text style={[styles.alertSub, { color: colors.success, opacity: 0.7 }]}>Recevoir des courses</Text>
              </View>
              <Text style={[styles.chevron, { color: th.text3 }]}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: th.cardBg, borderColor: th.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: th.text2 }]}>CONTACTS D'URGENCE</Text>
          {CONTACTS.map((c, i) => (
            <View key={c.id} style={[styles.contactRow, { borderBottomColor: th.divider }, i === CONTACTS.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.avatar, { backgroundColor: isDark && !c.isPompiers ? th.avatarBg : c.avatarBg }]}>
                <FontAwesome name={c.initial as any} size={17} color={isDark && !c.isPompiers ? th.avatarColor : c.avatarColor}/>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: th.text }]}>{c.name}</Text>
                <Text style={[styles.contactPhone, { color: th.text3 }]}>{c.phone}</Text>
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: th.actionCall }]} onPress={() => contactService(c)}>
                  <FontAwesome name="phone" size={20} color={isDark ? "white" : "black"} />
                </TouchableOpacity>
                {!c.isPompiers && <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e2f5ea' }]} onPress={() => Linking.openURL(`whatsapp://send?phone=${c.phone}`)}>
                  <FontAwesome name="whatsapp" size={24} color="#128c7e" />
                </TouchableOpacity>}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.card, styles.qrCard, { backgroundColor: th.cardBg, borderColor: th.cardBorder }]} onPress={() => setQrModalVisible(true)}>
          <View style={[styles.qrPreview, { borderColor: colors.primary, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }]}>
            {qrState==='ready'&&qrToken ? (
              <QRCode value={`https://lotisec-frontend.vercel.app/scan/${qrToken}`} size={34} color={colors.primary} />
            ) : qrState==='loading' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ):<FontAwesome name="exclamation-circle" size={24} color={colors.warning}/>} 
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.qrTitle, { color: th.text }]}>Mon QR code</Text>
            <Text style={[styles.qrSub, { color: th.text3 }]}>Agrandir ou télécharger le PDF</Text>
          </View>
          <Text style={[styles.chevron, { color: th.text3 }]}>›</Text>
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: th.cardBg, borderColor: th.cardBorder }]}>
          <TouchableOpacity style={styles.scanHeader} onPress={() => setShowScans(!showScans)}>
            <Text style={[styles.cardTitle, { color: th.text2, marginBottom: 0 }]}>HISTORIQUE DES SCANS</Text>
            <Text style={[styles.scanToggle, { color: th.text3 }]}>{showScans ? '∧' : '∨'}</Text>
          </TouchableOpacity>
          {showScans && (
            <View style={styles.scanList}>
              {scans.length===0?<Text style={[styles.scanDate,{color:th.text3}]}>Aucune consultation enregistrée.</Text>:scans.map((scan, i) => (
                <View key={scan.id} style={[styles.scanRow, { borderBottomColor: th.divider }, i === scans.length - 1 && { borderBottomWidth: 0 }]}>
                   <View style={styles.scanIcon}><FontAwesome name={scan.niveau === 'professionnel' ? 'lock' : 'eye'} size={17} color={colors.primary}/></View>
                   <Text style={[styles.scanDate, { color: th.text, flex: 1 }]}>{scan.date}</Text>
                   <View style={[styles.scanBadge, { backgroundColor: scan.niveau === 'professionnel' ? colors.primaryLight : '#f0f0f0' }]}>
                     <Text style={styles.scanBadgeText}>{scan.niveau}</Text>
                   </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODALS */}
      <Modal visible={panelVisible} animationType="slide">
        <ProfilePanel isDark={isDark} onClose={() => setPanelVisible(false)} onToggleTheme={(val) => setIsDark(val)} onOpenProfile={()=>{setPanelVisible(false);navigation.navigate('CitizenProfile' as any);}} />
      </Modal>

      <Modal visible={qrModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: th.cardBg }]}>
            <Text style={[styles.modalTitle, { color: th.text }]}>Mon Code QR</Text>
            <View style={styles.qrContainer}>
               {qrState === 'ready' && qrToken ? (
                 <QRCode value={`https://lotisec-frontend.vercel.app/scan/${qrToken}`} size={220} />
               ) : qrState === 'loading' ? (
                 <ActivityIndicator size="large" color={colors.primary} />
               ) : (
                 <View style={{alignItems:'center',gap:10,padding:20}}>
                   <FontAwesome name="exclamation-circle" size={34} color={colors.danger}/>
                   <Text style={{color:th.text2,textAlign:'center'}}>Le code QR n’est pas encore disponible. Fermez puis rouvrez cet écran après avoir vérifié votre connexion.</Text>
                 </View>
               )}
            </View>
            <TouchableOpacity style={styles.pdfBtn} onPress={generatePDF} disabled={!qrToken}>
              <FontAwesome name="file-pdf-o" size={17} color={colors.white}/>
              <Text style={styles.pdfBtnText}>Télécharger la fiche PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setQrModalVisible(false)} style={{ marginTop: 20 }}>
              <Text style={{ color: th.text2 }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL COMPLÉMENT D'ALERTE */}
      <Modal visible={complementModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: th.cardBg, maxHeight: '85%', width: '92%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <FontAwesome name="check-circle" size={24} color="#DC2626" />
                </View>
                <Text style={{ fontSize: 17, fontFamily: fonts.bold, color: th.text, textAlign: 'center' }}>
                  Précisions d'urgence
                </Text>
                <Text style={{ fontSize: 12, color: th.text2, textAlign: 'center', marginTop: 4 }}>
                  Alerte transmise aux secours. Vous pouvez affiner la situation si vous êtes en sécurité.
                </Text>
              </View>

              <Text style={{ fontSize: 12, fontFamily: fonts.semiBold, color: th.text2, textTransform: 'uppercase', marginBottom: 6 }}>
                Type de situation
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['Accident routier', 'Malaise / Inconscience', 'Incendie', 'Chute / Traumatisme', 'Autre'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 14,
                      backgroundColor: complementType === t ? colors.primary : (isDark ? '#162F4A' : '#F1F5F9'),
                      borderWidth: 1,
                      borderColor: complementType === t ? colors.primary : th.cardBorder,
                    }}
                    onPress={() => setComplementType(t)}
                  >
                    <Text style={{ fontSize: 12, color: complementType === t ? '#FFF' : th.text, fontWeight: '600' }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 12, fontFamily: fonts.semiBold, color: th.text2, textTransform: 'uppercase', marginBottom: 6 }}>
                Nombre de victimes
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['Je ne sais pas', '1', '2 à 5', '+ de 5'].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 14,
                      backgroundColor: complementVictims === v ? colors.primary : (isDark ? '#162F4A' : '#F1F5F9'),
                      borderWidth: 1,
                      borderColor: complementVictims === v ? colors.primary : th.cardBorder,
                    }}
                    onPress={() => setComplementVictims(v)}
                  >
                    <Text style={{ fontSize: 12, color: complementVictims === v ? '#FFF' : th.text, fontWeight: '600' }}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 12, fontFamily: fonts.semiBold, color: th.text2, textTransform: 'uppercase', marginBottom: 6 }}>
                Véhicules impliqués
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['Aucun', '1', '2', 'Plusieurs', 'Je ne sais pas'].map((vh) => (
                  <TouchableOpacity
                    key={vh}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 14,
                      backgroundColor: complementVehicles === vh ? colors.primary : (isDark ? '#162F4A' : '#F1F5F9'),
                      borderWidth: 1,
                      borderColor: complementVehicles === vh ? colors.primary : th.cardBorder,
                    }}
                    onPress={() => setComplementVehicles(vh)}
                  >
                    <Text style={{ fontSize: 12, color: complementVehicles === vh ? '#FFF' : th.text, fontWeight: '600' }}>{vh}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 12, fontFamily: fonts.semiBold, color: th.text2, textTransform: 'uppercase', marginBottom: 6 }}>
                Dangers immédiats constatés
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {[
                  { label: 'Inconscience', flag: 'inconscience' },
                  { label: 'Saignement grave', flag: 'saignement' },
                  { label: 'Victime coincée', flag: 'coince' },
                  { label: 'Feu / Fumée', flag: 'feu' },
                ].map((d) => {
                  const active = complementDangers.includes(d.flag);
                  return (
                    <TouchableOpacity
                      key={d.flag}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 14,
                        backgroundColor: active ? '#DC2626' : (isDark ? '#162F4A' : '#F1F5F9'),
                        borderWidth: 1,
                        borderColor: active ? '#DC2626' : th.cardBorder,
                      }}
                      onPress={() => {
                        if (active) {
                          setComplementDangers(complementDangers.filter((f) => f !== d.flag));
                        } else {
                          setComplementDangers([...complementDangers, d.flag]);
                        }
                      }}
                    >
                      <Text style={{ fontSize: 12, color: active ? '#FFF' : th.text, fontWeight: '600' }}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
                disabled={complementLoading}
                onPress={() => void submitComplement(false)}
              >
                {complementLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Valider les précisions</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingVertical: 10, alignItems: 'center' }}
                onPress={() => void submitComplement(true)}
              >
                <Text style={{ color: th.text2, fontSize: 13, fontWeight: '500' }}>Passer cette étape</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingBottom: 28, paddingTop: 18, borderBottomLeftRadius:28, borderBottomRightRadius:28 },
  flagBar: { flexDirection: 'row', height: 3, marginBottom: 15, marginHorizontal:18, borderRadius:3, overflow:'hidden', opacity:0.85 },
  flagStripe: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 15 },
  logoWrap: { flexDirection: 'row', alignItems: 'baseline' },
  logoSave: { fontSize: 24, fontFamily: fonts.bold, color: '#fff', letterSpacing:1.5 },
  logoMe: { fontSize: 24, fontFamily: fonts.bold, color: colors.accent, letterSpacing:1.5 },
  profileIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  sosSection: { alignItems: 'center', paddingHorizontal: 18 },
  sosHint: { fontSize: 13, fontFamily: fonts.medium, color: '#fff', letterSpacing: 1.2, marginBottom: 10 },
  sosContainer: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  sosRipple2: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
  sosRipple1: { position: 'absolute', width: 160, height: 160, borderRadius: 80 },
  sosRing1: { width: 130, height: 130, borderRadius: 65, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sosRing1Active: { borderColor: '#fff' },
  sosRing2: { width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  sosRing2Active: { borderColor: '#fff' },
  sosCore: { width: 120, height: 120, borderRadius: 65, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  sosCoreActive: { backgroundColor: '#B71C1C' },
  sosLabel: { fontSize: 30, fontFamily: fonts.bold, color: '#fff' },
  sosSub: { fontSize: 8, fontFamily: fonts.medium, color: '#fff', marginTop: 2 },
  sosStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 15 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C853' },
  statusLabel: { fontSize: 13, color: '#fff' },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingTop:20 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 14, shadowColor:'#071A2E',shadowOffset:{width:0,height:6},shadowOpacity:0.07,shadowRadius:16,elevation:2 },
  cardTitle: { fontSize: 11, fontFamily: fonts.semiBold, letterSpacing: 1, marginBottom: 10 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, backgroundColor: colors.surfaceRaised, marginBottom: 8, borderWidth:1,borderColor:colors.border },
  alertIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: fontSizes.sm, fontFamily: fonts.bold },
  alertSub: { fontSize: fontSizes.xs, opacity: 0.7 },
  chevron: { fontSize: 18, marginLeft: 5 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontFamily: fonts.bold },
  contactName: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold },
  contactPhone: { fontSize: fontSizes.xs, marginTop: 2 },
  contactActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',borderWidth:1,borderColor:colors.border },
  qrCard: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  qrPreview: { width: 50, height: 50, borderRadius: 10, borderWidth: 1, padding: 4 },
  qrTitle: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold },
  qrSub: { fontSize: fontSizes.xs, marginTop: 2 },
  scanHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scanToggle: { fontSize: 16 },
  scanList: { marginTop: 10 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5 },
  scanIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  scanDate: { fontSize: fontSizes.sm },
  scanBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  scanBadgeText: { fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 25, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontFamily: fonts.bold, marginBottom: 20 },
  qrContainer: { padding: 15, backgroundColor: '#fff', borderRadius: 20 },
  pdfBtn: { backgroundColor: colors.primary, width: '100%', padding: 16, borderRadius: 15, marginTop: 25, alignItems: 'center', justifyContent:'center', flexDirection:'row', gap:8 },
  pdfBtnText: { color: '#fff', fontWeight: 'bold' },
});

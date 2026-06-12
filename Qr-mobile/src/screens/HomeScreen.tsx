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
  niveau: 'public' | 'professionnel';
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
    avatarBg: '#fab41cc5',
    avatarColor: '#FF6B6B',
    initial: '🚒',
  },
  {
    id: '1',
    name: 'A prevenir',
    phone: '+22891127584',
    isPompiers: false,
    avatarBg: '#fa1c1cc5',
    avatarColor: colors.primary,
    initial: '👨🏽‍🦱',
  },
  {
    id: '2',
    name: 'A prevenir',
    phone: '+22898000493',
    isPompiers: false,
    avatarBg: '#fab41cc5',
    avatarColor: colors.primary,
    initial: '👨🏽‍🦱',
  },
];

const DEMO_SCANS: ScanHistorique[] = [
  { id: '1', date: "Aujourd'hui · 10h32", lieu: 'Université de Lomé', niveau: 'professionnel' },
  { id: '2', date: '17 Avr · 09h15', lieu: 'Lomé, Bè', niveau: 'professionnel' },
  { id: '3', date: '10 Avr · 17h40', lieu: 'Lomé, Tokoin', niveau: 'public' },
];

export default function HomeScreen({ navigation }: Props) {
  const [sosActif, setSosActif] = useState(false);
  const [alerteEnvoyee, setAlerteEnvoyee] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [scans, setScans] = useState<ScanHistorique[]>(DEMO_SCANS);
  const [showScans, setShowScans] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const pulseRing1 = useRef(new Animated.Value(1)).current;
  const pulseRing2 = useRef(new Animated.Value(1)).current;
  const pulseOpacity1 = useRef(new Animated.Value(0.4)).current;
  const pulseOpacity2 = useRef(new Animated.Value(0.4)).current;

  const th = {
    bg: isDark ? '#0D0D0D' : colors.background,
    cardBg: isDark ? '#181818' : colors.white,
    cardBorder: isDark ? '#252525' : colors.border,
    text: isDark ? '#EFEFEF' : colors.text,
    text2: isDark ? '#888888' : colors.textSecondary,
    text3: isDark ? '#555555' : colors.textLight,
    avatarBg: isDark ? '#1B3A2D' : '#E8F5E9',
    avatarColor: isDark ? '#69F0AE' : colors.primary,
    actionCall: isDark ? '#1B3A2D' : '#E8F5E9',
    actionWA: isDark ? '#2C2A00' : '#FFFDE7',
    divider: isDark ? '#252525' : colors.border,
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('qrToken');
        const storedProfile = await AsyncStorage.getItem('profile');
        if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile);
        setProfile(parsedProfile);
        
        // On adapte ici : si l'API a renvoyé le token dans l'objet profil
        if (parsedProfile.qr_token) {
          setQrToken(parsedProfile.qr_token);
        }
      }
      } catch (e) {
        console.log('Erreur chargement données:', e);
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
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("GPS requis", "La position est nécessaire pour le SOS.");
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const mapsUrl = `https://www.google.com/maps?q=${location.coords.latitude},${location.coords.longitude}`;
      const message = `🚨 *URGENCE SOS - LOTISEC* 🚨\n\n` +
                      `Bonjour! Je suis en danger. J'ai besoin d'aide immédiatement, s'il vous plaît !\n\n` +
                      `📍 Voici ma position actuelle : ${mapsUrl}`;

      const phone = CONTACTS[1].phone.replace(/[^\d+]/g, ""); 
      await Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`);
      setSosActif(true);
      setAlerteEnvoyee(true);
    } catch (e) {
      Alert.alert("Erreur", "Vérifiez que WhatsApp est installé.");
    }
  };

  const handleSOS = () => {
    if (sosActif) {
      Alert.alert('Annuler l\'alerte ?', 'Les secours ont déjà été notifiés.', [
        { text: 'Garder l\'alerte', style: 'cancel' },
        { text: 'Annuler', style: 'destructive', onPress: () => { setSosActif(false); setAlerteEnvoyee(false); }},
      ]);
    } else {
      Alert.alert('🚨 SOS IMMÉDIAT', 'Votre position sera envoyée à votre contact d\'urgence via WhatsApp.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'CONFIRMER', style: 'destructive', onPress: envoyerSOS },
      ]);
    }
  };

  const generatePDF = async () => {
    if(!qrToken) return Alert.alert("Erreur", "Token introuvable.");
    const html = `
      <html><body style="text-align:center;font-family:Helvetica;padding:40px;">
        <h1 style="color:#D21034;">Lotisec</h1> 
        <h2>Fiche d'urgence</h2>
        <hr/>
        <div style="margin:30px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://qr-web-dbap.vercel.app/scan/${qrToken}" width="250" height="250" />
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
            <Text style={styles.logoSave}>Safe</Text>
            <Text style={styles.logoMe}>Life</Text>
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
          <View style={[styles.card, { backgroundColor: th.cardBg, borderColor: colors.danger, borderWidth: 1 }]}>
             <Text style={[styles.cardTitle, { color: colors.danger }]}>ACTIONS RECOMMANDÉES</Text>
             <TouchableOpacity style={styles.alertRow} onPress={() => Linking.openURL('https://www.google.com/maps/search/hopital')}>
                <View style={[styles.alertIcon, { backgroundColor: colors.primary }]}><Text>🏥</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: colors.primary }]}>Hôpital le plus proche</Text>
                  <Text style={[styles.alertSub, { color: th.text3 }]}>Afficher l'itinéraire GPS</Text>
                </View>
                <Text style={[styles.chevron, { color: th.text3 }]}>›</Text>
             </TouchableOpacity>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: th.cardBg, borderColor: th.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: th.text2 }]}>ALERTES RAPIDES</Text>
          <TouchableOpacity style={styles.alertRow} onPress={handleSOS}>
            <View style={[styles.alertIcon, { backgroundColor: colors.danger }]}><Text>🚨</Text></View>
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
            <View style={[styles.alertIcon, { backgroundColor: colors.primary }]}><Text>🛵</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: th.text }]}>Commander un Zem</Text>
              <Text style={[styles.alertSub, { color: th.text3 }]}>Trouvez un conducteur à proximité</Text>
            </View>
            <Text style={[styles.chevron, { color: th.text3 }]}>›</Text>
          </TouchableOpacity>

          {profile?.is_zem && (
            <TouchableOpacity style={[styles.alertRow, { backgroundColor: 'rgba(0,200,83,0.05)' }]} onPress={() => navigation.navigate('ZemDriver' as any)}>
              <View style={[styles.alertIcon, { backgroundColor: colors.success }]}><Text>🛣️</Text></View>
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
                <Text style={[styles.avatarText, { color: isDark && !c.isPompiers ? th.avatarColor : c.avatarColor }]}>{c.initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: th.text }]}>{c.name}</Text>
                <Text style={[styles.contactPhone, { color: th.text3 }]}>{c.phone}</Text>
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: th.actionCall }]} onPress={() => Linking.openURL(`tel:${c.phone}`)}><Text>📞</Text></TouchableOpacity>
                {!c.isPompiers && <TouchableOpacity style={[styles.actionBtn, { backgroundColor: th.actionWA }]} onPress={() => Linking.openURL(`whatsapp://send?phone=${c.phone}`)}><Text>💬</Text></TouchableOpacity>}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.card, styles.qrCard, { backgroundColor: th.cardBg, borderColor: th.cardBorder }]} onPress={() => setQrModalVisible(true)}>
          <View style={[styles.qrPreview, { borderColor: colors.primary, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }]}>
            {qrToken ? (
              <QRCode value={`https://qr-web-dbap.vercel.app/scan/${qrToken}`} size={34} color={colors.primary} />
            ) : (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
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
              {scans.map((scan, i) => (
                <View key={scan.id} style={[styles.scanRow, { borderBottomColor: th.divider }, i === scans.length - 1 && { borderBottomWidth: 0 }]}>
                   <View style={styles.scanIcon}><Text>{scan.niveau === 'professionnel' ? '🔐' : '👁️'}</Text></View>
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
        <ProfilePanel isDark={isDark} onClose={() => setPanelVisible(false)} onToggleTheme={(val) => setIsDark(val)} />
      </Modal>

      <Modal visible={qrModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: th.cardBg }]}>
            <Text style={[styles.modalTitle, { color: th.text }]}>Mon Code QR</Text>
            <View style={styles.qrContainer}>
               {qrToken ? (
                 <QRCode value={`https://qr-web-dbap.vercel.app/scan/${qrToken}`} size={220} />
               ) : (
                 <ActivityIndicator size="large" color={colors.primary} />
               )}
            </View>
            <TouchableOpacity style={styles.pdfBtn} onPress={generatePDF}>
              <Text style={styles.pdfBtnText}>📄 Télécharger la fiche PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setQrModalVisible(false)} style={{ marginTop: 20 }}>
              <Text style={{ color: th.text2 }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingBottom: 30, paddingTop: 30 },
  flagBar: { flexDirection: 'row', height: 3, marginBottom: 15 },
  flagStripe: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 15 },
  logoWrap: { flexDirection: 'row', alignItems: 'baseline' },
  logoSave: { fontSize: 26, fontFamily: fonts.bold, color: '#fff' },
  logoMe: { fontSize: 26, fontFamily: fonts.bold, color: colors.yellow },
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
  bodyContent: { padding: 15 },
  card: { borderRadius: 15, borderWidth: 0.5, padding: 15, marginBottom: 12 },
  cardTitle: { fontSize: 11, fontFamily: fonts.semiBold, letterSpacing: 1, marginBottom: 10 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(210,16,52,0.05)', marginBottom: 8 },
  alertIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: fontSizes.sm, fontFamily: fonts.bold },
  alertSub: { fontSize: fontSizes.xs, opacity: 0.7 },
  chevron: { fontSize: 18, marginLeft: 5 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontFamily: fonts.bold },
  contactName: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold },
  contactPhone: { fontSize: fontSizes.xs, marginTop: 2 },
  contactActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
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
  pdfBtn: { backgroundColor: colors.primary, width: '100%', padding: 16, borderRadius: 15, marginTop: 25, alignItems: 'center' },
  pdfBtnText: { color: '#fff', fontWeight: 'bold' },
});
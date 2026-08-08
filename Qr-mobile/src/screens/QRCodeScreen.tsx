import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, 
  StatusBar, Image, Alert, Share, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme/colors';


export default function QRCodeScreen() {
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('qrToken');
        const storedProfile = await AsyncStorage.getItem('profile');
        
        if (storedToken) setQrToken(storedToken);
        if (storedProfile) setProfile(JSON.parse(storedProfile));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, []);

  const generatePDF = async () => {
    if (!qrToken) return Alert.alert("Erreur", "Données non disponibles");

    const html = `
      <html>
        <body style="text-align:center; padding: 50px; font-family: sans-serif;">
          <h1 style="font-size: 40px; font-weight: bold; font-family: sans-serif;">
            <span style="color: #D21034;">Safe</span><span style="color: #FFCD00;">Life</span>
          </h1>
          <p style="font-size: 20px;">Fiche d'urgence officielle</p>
          <div style="margin: 40px auto; padding: 20px; border: 2px solid #EEE; display: inline-block; border-radius: 20px;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://qr-web-dbap.vercel.app/scan/${qrToken}" />
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de générer le PDF");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Code QR</Text>
        <Text style={styles.headerSub}>Télécharger, imprimer et plastifier avant usage </Text>
      </View>

      <View style={styles.content}>
        {/* CARTE QR CODE */}
        <View style={styles.qrCard}>
          <View style={styles.qrWrapper}>
            {qrToken ? (
              <QRCode 
                value={`https://qr-web-dbap.vercel.app/scan/${qrToken}`}
                size={220}
                color="black"
                backgroundColor="white"
              />
            ) : (
              <Ionicons name="alert-circle-outline" size={80} color="#DDD" />
            )}
          </View>
          
        </View>

        {/* ACTIONS */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.mainAction} onPress={generatePDF}>
            <Ionicons name="document-text" size={24} color="white" />
            <Text style={styles.mainActionText}>TÉLÉCHARGER MON CODE QR</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <TouchableOpacity 
              style={styles.secondaryAction} 
              onPress={() => Share.share({ message: `Lien vers ma fiche LOTISEC : https://qr-web-dbap.vercel.app/scan/${qrToken}` })}
            >
              <Ionicons name="share-social" size={20} color={colors.text} />
              <Text style={styles.secondaryText}>Partager le lien</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} onPress={() => Alert.alert("Aide", "Ce QR Code contient vos informations d'urgence.")}>
              <Ionicons name="help-circle" size={20} color={colors.text} />
              <Text style={styles.secondaryText}>Aide</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          <Text style={styles.infoBoxText}>
            En cas d'accident, une simple lecture de ce code permettra aux secouristes d'avoir accès à vos informations d'urgence.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 25, backgroundColor: colors.primaryDark, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  headerSub: { fontSize: 14, color: '#ffffff', marginTop: 4 },
  content: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  qrCard: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 30,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    width: '100%',
    marginBottom: 30,
  },
  qrWrapper: {
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  userName: { fontSize: 20, fontWeight: 'bold', marginTop: 20, color: '#222' },
  bloodBadge: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 10, marginTop: 10 },
  bloodText: { fontWeight: 'bold', fontSize: 13 },
  actionContainer: { width: '100%' },
  mainAction: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
  },
  mainActionText: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  secondaryAction: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 15,
    width: '48%',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  secondaryText: { marginLeft: 8, fontSize: 13, color: '#333', fontWeight: '500' },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 15,
    marginTop: 30,
    alignItems: 'center',
  },
  infoBoxText: { flex: 1, marginLeft: 10, fontSize: 12, color: '#2E7D32', lineHeight: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, 
  StatusBar, Alert, Share, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';
import { hydrateSession } from '../services/session';
import { api } from '../api/config';

export default function QRCodeScreen() {
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 1. Essayer via hydrateSession
      const session = await hydrateSession(true);
      let token = session?.user?.qr_token;
      let userProfile = session?.user;

      // 2. Si non présent, appeler directement /auth/me
      if (!token && session?.token) {
        try {
          const meData = await api('/auth/me', 'GET', undefined, session.token);
          if (meData?.user?.qr_token) {
            token = meData.user.qr_token;
            userProfile = meData.user;
          }
        } catch (e) {
          console.warn('Erreur /auth/me dans QRCodeScreen:', e);
        }
      }

      // 3. Fallback AsyncStorage
      if (!token) {
        token = await AsyncStorage.getItem('qrToken');
      }
      if (!userProfile) {
        const stored = await AsyncStorage.getItem('profile');
        if (stored) userProfile = JSON.parse(stored);
      }

      if (token) {
        setQrToken(token);
        await AsyncStorage.setItem('qrToken', token);
      }
      if (userProfile) {
        setProfile(userProfile);
      }

      if (!token) {
        setError("Votre code QR n'a pas pu être chargé. Vérifiez votre connexion.");
      }
    } catch (e: any) {
      console.error('Erreur chargement QR Code:', e);
      setError(e?.message || 'Erreur lors de la récupération du code QR');
    } finally {
      setLoading(false);
    }
  };

  const scanUrl = qrToken ? `https://lotisec-frontend.vercel.app/scan/${qrToken}` : '';

  const generatePDF = async () => {
    if (!qrToken) return Alert.alert("Erreur", "Code QR non disponible");

    const userName = profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : 'Citoyen LOTISEC';
    const bloodType = profile?.blood_type && profile.blood_type !== 'NC' ? profile.blood_type : 'Non spécifié';
    const phone = profile?.phone || 'Non renseigné';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center; padding: 40px; color: #071A2E; }
            .header { margin-bottom: 20px; }
            .logo { font-size: 32px; font-weight: 900; color: #1565D8; letter-spacing: 2px; }
            .title { font-size: 18px; color: #5B7289; margin-top: 4px; }
            .card { margin: 30px auto; padding: 25px; border: 2px solid #E1E8F0; border-radius: 20px; max-width: 340px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .qr-img { width: 240px; height: 240px; border-radius: 12px; }
            .token-text { font-size: 16px; font-weight: bold; color: #1565D8; margin-top: 15px; letter-spacing: 1.5px; }
            .info-table { margin: 20px auto; text-align: left; width: 100%; border-collapse: collapse; }
            .info-table td { padding: 6px 0; font-size: 14px; }
            .info-label { color: #5B7289; font-weight: 500; }
            .info-val { font-weight: bold; color: #071A2E; text-align: right; }
            .footer { font-size: 12px; color: #5B7289; margin-top: 30px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">LOTISEC</div>
            <div class="title">Fiche d'Urgence Médicale Officielle</div>
          </div>
          <div class="card">
            <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scanUrl)}" />
            <div class="token-text">ID: ${qrToken}</div>
            <table class="info-table">
              <tr>
                <td class="info-label">Titulaire :</td>
                <td class="info-val">${userName}</td>
              </tr>
              <tr>
                <td class="info-label">Groupe sanguin :</td>
                <td class="info-val">${bloodType}</td>
              </tr>
              <tr>
                <td class="info-label">Téléphone :</td>
                <td class="info-val">${phone}</td>
              </tr>
            </table>
          </div>
          <div class="footer">
            En cas d'accident, scannez ce code pour accéder instantanément aux données médicales d'urgence et alerter les proches.<br/>
            Plateforme Nationale de Secours Routier — Togo
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
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Génération de votre code QR...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Code QR</Text>
        <Text style={styles.headerSub}>Télécharger, imprimer et coller sur votre casque ou véhicule</Text>
      </View>

      <View style={styles.content}>
        {/* CARTE QR CODE */}
        <View style={styles.qrCard}>
          <View style={styles.qrWrapper}>
            {qrToken ? (
              <QRCode 
                value={scanUrl}
                size={220}
                color="#071A2E"
                backgroundColor="white"
              />
            ) : (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={60} color={colors.warning} />
                <Text style={styles.errorText}>{error || 'Code QR indisponible'}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadUserData}>
                  <Text style={styles.retryBtnText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {qrToken && (
            <View style={styles.tokenContainer}>
              <Text style={styles.tokenLabel}>IDENTIFIANT SECURISE</Text>
              <Text style={styles.tokenValue}>{qrToken}</Text>
            </View>
          )}
        </View>

        {/* ACTIONS */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.mainAction, !qrToken && styles.actionDisabled]} 
            onPress={generatePDF}
            disabled={!qrToken}
          >
            <Ionicons name="document-text" size={22} color="white" />
            <Text style={styles.mainActionText}>TÉLÉCHARGER MA FICHE PDF</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <TouchableOpacity 
              style={[styles.secondaryAction, !qrToken && styles.actionDisabled]} 
              onPress={() => {
                if (scanUrl) {
                  Share.share({ message: `Fiche d'urgence médicale LOTISEC : ${scanUrl}` });
                }
              }}
              disabled={!qrToken}
            >
              <Ionicons name="share-social" size={18} color={colors.text} />
              <Text style={styles.secondaryText}>Partager le lien</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryAction} 
              onPress={() => Alert.alert(
                "Protection & Sécurité", 
                "Ce code QR permet à tout témoin ou secouriste d'accéder instantanément à vos données médicales et de contacter vos proches en cas d'accident."
              )}
            >
              <Ionicons name="help-circle" size={18} color={colors.text} />
              <Text style={styles.secondaryText}>Comment ça marche ?</Text>
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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#071A2E',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSizes.xl, fontFamily: fonts.bold, color: '#ffffff' },
  headerSub: { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: '#A8B8C9', marginTop: 4, textAlign: 'center' },
  content: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  qrCard: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: '100%',
    maxWidth: 340,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  tokenContainer: { marginTop: 14, alignItems: 'center' },
  tokenLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 1 },
  tokenValue: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.primary, marginTop: 2, letterSpacing: 2 },
  errorBox: { alignItems: 'center', padding: 15, gap: 8 },
  errorText: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: 8 },
  retryBtnText: { color: 'white', fontFamily: fonts.semiBold, fontSize: fontSizes.xs },
  actionContainer: { width: '100%', maxWidth: 340 },
  mainAction: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 12,
  },
  mainActionText: { color: 'white', fontFamily: fonts.bold, marginLeft: 8, fontSize: fontSizes.sm },
  actionDisabled: { opacity: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  secondaryAction: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { marginLeft: 6, fontSize: fontSizes.xs, color: colors.text, fontFamily: fonts.medium },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EAF2FF',
    padding: 14,
    borderRadius: 14,
    marginTop: 15,
    alignItems: 'center',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#C8D9F2',
  },
  infoBoxText: { flex: 1, marginLeft: 10, fontSize: fontSizes.xs, color: colors.primary, lineHeight: 17 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: fontSizes.sm, color: colors.textSecondary },
});

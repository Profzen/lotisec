import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme/colors';
import { fontSizes, fonts } from '../../theme/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { createProfil } from '../../api/profil';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Step5'>;
  route: RouteProp<RootStackParamList, 'Step5'>;
};

export default function Step5Review({ navigation, route }: Props) {
  const { profile } = route.params;
  const [confirmed, setConfirmed] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const handleGenerate = async () => {
    if (!confirmed) return;

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
        navigation.navigate('Login');
        return;
      }

      const result = await createProfil(profile, token);

      if (result.qr_token) {
        await AsyncStorage.setItem('qrToken', result.qr_token);
      }

      // Sauvegarde sous les DEUX clés pour compatibilité HomeScreen
      await AsyncStorage.setItem('profile',     JSON.stringify(result));
      await AsyncStorage.setItem('userProfile', JSON.stringify(result));

      // Reset complet de la navigation vers Home
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });

    } catch (err: any) {
      console.log('Erreur Step5:', JSON.stringify(err));
      const message = err?.message || err?.detail || 'Erreur lors de la création du profil';
      Alert.alert('Erreur', message);
    } finally {
      setLoading(false);
    }
  };

  const Row = ({ label, value }: { label: string; value?: string | null }) => {
    if (!value || value === '' || value === 'N/A') return null;
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    );
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <View style={styles.progressBar}>
          {[1,2,3,4,5].map(i => (
            <View key={i} style={[styles.progressStep, styles.progressActive]} />
          ))}
        </View>

        <Text style={styles.title}>Vérification</Text>
        <Text style={styles.subtitle}>Étape 5 sur 5 — Vérifiez vos informations</Text>

        <Section title="Identité">
          <Row label="Prénom"      value={profile.firstName} />
          <Row label="Nom"         value={profile.lastName} />
          <Row label="Naissance"   value={profile.birthDate} />
          <Row label="Sexe"        value={profile.gender} />
          <Row label="Nationalité" value={profile.nationality} />
        </Section>

        <Section title="Informations médicales">
          <Row label="Groupe sanguin" value={profile.bloodType} />
          <Row label="Allergies"      value={profile.allergies} />
          <Row label="Maladies"       value={profile.conditions} />
          <Row label="Médicaments"    value={profile.medications} />
          <Row label="Handicap"       value={profile.disabilities} />
        </Section>

        <Section title="Contacts d'urgence">
          {profile.emergencyContacts?.length > 0
            ? profile.emergencyContacts.map((c: any, i: number) => (
              <View key={i} style={i > 0 ? styles.contactDivider : {}}>
                <Row label={`Contact ${i + 1}`} value={c.name} />
                <Row label="Téléphone"           value={c.phone} />
                <Row label="Relation"            value={c.relation} />
              </View>
            ))
            : <Text style={styles.noData}>Aucun contact renseigné</Text>
          }
        </Section>

        {profile.profileType === 'student' && profile.schoolInfo && (
          <Section title="École">
            <Row label="École"      value={profile.schoolInfo.schoolName} />
            <Row label="Classe"     value={profile.schoolInfo.className} />
            <Row label="Directeur"  value={profile.schoolInfo.directorName} />
            <Row label="Tél. directeur" value={profile.schoolInfo.directorPhone} />
            <Row label="Parent"     value={profile.schoolInfo.parentName} />
            <Row label="Tél. parent" value={profile.schoolInfo.parentPhone} />
          </Section>
        )}

        {profile.vehicle?.hasVehicle && (
          <Section title="Véhicule">
            <Row label="Type"            value={profile.vehicle.type} />
            <Row label="Immatriculation" value={profile.vehicle.plate} />
            <Row label="Marque"          value={profile.vehicle.brand} />
            <Row label="Modèle"          value={profile.vehicle.model} />
            <Row label="Couleur"         value={profile.vehicle.color} />
          </Section>
        )}

        {/* Note sécurité */}
        <View style={styles.securityBox}>
          <Text style={styles.securityText}>
            🔒 Vos données sont chiffrées. Seuls les professionnels avec un code accrédité peuvent accéder aux données complètes.
          </Text>
        </View>

        {/* Case à cocher */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setConfirmed(!confirmed)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
            {confirmed && <Ionicons name="checkmark" size={17} color={colors.white} />}
          </View>
          <Text style={styles.checkLabel}>
            Je confirme que toutes mes informations sont correctes.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnPrimary, (!confirmed || loading) && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={!confirmed || loading}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnText}>Générer mon QR code</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.background },
  scroll:         { flexGrow: 1, padding: 24, paddingBottom: 40 },
  back:           { marginBottom: 16 },
  backText:       { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.primary },
  progressBar:    { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressStep:   { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressActive: { backgroundColor: colors.primary },
  title:          { fontSize: fontSizes.xxl, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  subtitle:       { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 24 },
  section: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 12, gap: 8,
  },
  sectionTitle:   { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.primary, marginBottom: 4 },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  rowLabel:       { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.textSecondary, flex: 1 },
  rowValue:       { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, color: colors.text, flex: 2, textAlign: 'right' },
  contactDivider: { marginTop: 8, borderTopWidth: 0.5, borderColor: colors.border, paddingTop: 8 },
  noData:         { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.textLight, textAlign: 'center', paddingVertical: 8 },
  securityBox:    { backgroundColor: colors.primaryLight, borderRadius: 14, borderWidth: 1, borderColor: '#C8D9F2', padding: 14, marginBottom: 16 },
  securityText:   { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: colors.primary, lineHeight: 18 },
  checkRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, marginTop: 8 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked:{ borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark:      { color: colors.white, fontSize: 14, fontFamily: fonts.bold },
  checkLabel:     { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.text, flex: 1 },
  btnPrimary:     { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:    { backgroundColor: colors.border },
  btnText:        { color: colors.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
});

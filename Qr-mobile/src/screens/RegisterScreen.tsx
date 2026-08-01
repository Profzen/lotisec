import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';
import { emptyProfile, ProfileType } from '../types/profile';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

const profileTypes = [
  {
    type: 'adult' as ProfileType,
    icon: '👤',
    title: 'Adulte',
    desc: 'Conducteur, piéton, tout usager majeur',
  },
  {
    type: 'student' as ProfileType,
    icon: '🎒',
    title: 'Élève',
    desc: 'Enfant scolarisé, mineur',
  },
];

export default function RegisterScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<ProfileType | null>(null);
  const [accountType, setAccountType] = useState<'citizen' | 'zem_driver'>('citizen');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [identityDocument, setIdentityDocument] = useState('');
  const [motorcycleMake, setMotorcycleMake] = useState('');
  const [plate, setPlate] = useState('');
  const [workZone, setWorkZone] = useState('Lomé');

  const handleContinue = () => {
    if (!selected) {
      Alert.alert('Erreur', 'Veuillez choisir un type de profil');
      return;
    }
    if (accountType === 'zem_driver' && (!identityDocument || !licenseNumber || !motorcycleMake || !plate || !workZone)) {
      Alert.alert('Informations requises', 'Renseignez le permis, la moto, l’immatriculation et la zone d’activité.');
      return;
    }
    navigation.navigate('Step1', {
      profile: { ...emptyProfile, profileType: selected, accountType,
        ...(accountType === 'zem_driver' ? { zemApplication: { identityDocument, licenseNumber, motorcycleMake, plate, workZone } } : {}) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Retour</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Créer mon profil</Text>
        <Text style={styles.subtitle}>
          Choisissez votre type de profil pour commencer
        </Text>

        <View style={styles.optionRow}>
          <TouchableOpacity style={[styles.optionBtn, accountType === 'citizen' && styles.cardSelected]} onPress={() => setAccountType('citizen')}><Text style={styles.cardTitle}>Utilisateur</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.optionBtn, accountType === 'zem_driver' && styles.cardSelected]} onPress={() => setAccountType('zem_driver')}><Text style={styles.cardTitle}>Conducteur Zem</Text></TouchableOpacity>
        </View>
        {accountType === 'zem_driver' && <View style={styles.zemFields}>
          <Text style={styles.cardDesc}>Votre compte conducteur sera activé après validation LOTISEC.</Text>
          <TextInput style={styles.input} placeholder="Pièce d’identité" value={identityDocument} onChangeText={setIdentityDocument} />
          <TextInput style={styles.input} placeholder="Numéro de permis" value={licenseNumber} onChangeText={setLicenseNumber} />
          <TextInput style={styles.input} placeholder="Marque de la moto" value={motorcycleMake} onChangeText={setMotorcycleMake} />
          <TextInput style={styles.input} placeholder="Immatriculation" value={plate} onChangeText={setPlate} />
          <TextInput style={styles.input} placeholder="Zone d’activité" value={workZone} onChangeText={setWorkZone} />
        </View>}

        <View style={styles.cards}>
          {profileTypes.map((item) => (
            <TouchableOpacity
              key={item.type}
              style={[styles.card, selected === item.type && styles.cardSelected]}
              onPress={() => setSelected(item.type)}
              activeOpacity={0.85}
            >
              <Text style={styles.cardIcon}>{item.icon}</Text>
              <Text style={[styles.cardTitle, selected === item.type && styles.cardTitleSelected]}>
                {item.title}
              </Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
              {selected === item.type && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btnPrimary, !selected && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Continuer →</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>
            Déjà un compte ? <Text style={styles.link}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.background, padding: 24 },
  back:              { marginBottom: 24 },
  backText:          { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.primary },
  content:           { flex: 1, justifyContent: 'center', gap: 20 },
  title:             { fontSize: fontSizes.xxl, fontFamily: fonts.bold, color: colors.text },
  subtitle:          { fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.textSecondary },
  cards:             { gap: 12 },
  optionRow:         { flexDirection: 'row', gap: 10 },
  optionBtn:         { flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: 12, padding: 12, alignItems: 'center' },
  zemFields:         { gap: 8 },
  input:             { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 },
  card:              { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: colors.border, padding: 20, alignItems: 'center', position: 'relative' },
  cardSelected:      { borderColor: colors.primary, backgroundColor: '#F0F9F4' },
  cardIcon:          { fontSize: 40, marginBottom: 10 },
  cardTitle:         { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  cardTitleSelected: { color: colors.primary },
  cardDesc:          { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center' },
  checkBadge:        { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkText:         { color: colors.white, fontSize: 14, fontFamily: fonts.bold },
  btnPrimary:        { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:       { backgroundColor: colors.border },
  btnText:           { color: colors.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
  linkText:          { textAlign: 'center', fontSize: fontSizes.sm, color: colors.textSecondary, fontFamily: fonts.regular },
  link:              { color: colors.primary, fontFamily: fonts.semiBold },
});

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';
import { emptyProfile, ProfileType } from '../types/profile';
import { Ionicons } from '@expo/vector-icons';
import { ActionButton, SectionHeading, StatusPill, SurfaceCard } from '../components/ui';

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SectionHeading eyebrow="Inscription LOTISEC" title="Quel usage vous correspond ?" description="Votre parcours sera adapté à votre activité. Vous pourrez compléter vos informations médicales ensuite."/>

        <View style={styles.optionRow}>
          <TouchableOpacity style={[styles.optionBtn, accountType === 'citizen' && styles.cardSelected]} onPress={() => setAccountType('citizen')}><Ionicons name="person-outline" size={24} color={accountType==='citizen'?colors.primary:colors.textSecondary}/><Text style={styles.optionTitle}>Utilisateur</Text><Text style={styles.optionDescription}>Sécurité, SOS et mobilité</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.optionBtn, accountType === 'zem_driver' && styles.cardSelected]} onPress={() => setAccountType('zem_driver')}><Ionicons name="bicycle-outline" size={24} color={accountType==='zem_driver'?colors.primary:colors.textSecondary}/><Text style={styles.optionTitle}>Conducteur Zem</Text><Text style={styles.optionDescription}>Courses après validation</Text></TouchableOpacity>
        </View>
        {accountType === 'zem_driver' && <SurfaceCard style={styles.zemFields}>
          <StatusPill label="Accréditation requise" tone="warning"/><Text style={styles.cardDesc}>Votre compte conducteur sera activé après contrôle de ces justificatifs.</Text>
          <TextInput style={styles.input} placeholder="Pièce d’identité" value={identityDocument} onChangeText={setIdentityDocument} />
          <TextInput style={styles.input} placeholder="Numéro de permis" value={licenseNumber} onChangeText={setLicenseNumber} />
          <TextInput style={styles.input} placeholder="Marque de la moto" value={motorcycleMake} onChangeText={setMotorcycleMake} />
          <TextInput style={styles.input} placeholder="Immatriculation" value={plate} onChangeText={setPlate} />
          <TextInput style={styles.input} placeholder="Zone d’activité" value={workZone} onChangeText={setWorkZone} />
        </SurfaceCard>}

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
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <ActionButton label="Continuer" onPress={handleContinue} disabled={!selected}/>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>
            Déjà un compte ? <Text style={styles.link}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  back:              { marginTop:8,marginBottom: 12,alignSelf:'flex-start',backgroundColor:colors.white,borderWidth:1,borderColor:colors.border,borderRadius:12,paddingHorizontal:12,paddingVertical:9 },
  backText:          { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.primary },
  content:           { gap: 18,paddingBottom:32 },
  title:             { fontSize: fontSizes.xxl, fontFamily: fonts.bold, color: colors.text },
  subtitle:          { fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.textSecondary },
  cards:             { gap: 12 },
  optionRow:         { flexDirection: 'row', gap: 10 },
  optionBtn:         { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap:6, backgroundColor:colors.white },optionTitle:{fontFamily:fonts.bold,fontSize:fontSizes.sm,color:colors.text},optionDescription:{fontFamily:fonts.regular,fontSize:10,color:colors.textSecondary,textAlign:'center'},
  zemFields:         { gap: 10 },
  input:             { backgroundColor: colors.surfaceRaised, borderRadius: 13, borderWidth: 1, borderColor: colors.borderStrong, padding: 14,color:colors.text },
  card:              { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, alignItems: 'center', position: 'relative' },
  cardSelected:      { borderColor: colors.primary, backgroundColor: colors.primaryLight },
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

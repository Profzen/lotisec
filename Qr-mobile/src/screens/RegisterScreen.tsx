import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
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

  const handleContinue = () => {
    if (!selected) {
      Alert.alert('Erreur', 'Veuillez choisir un type de profil');
      return;
    }
    navigation.navigate('Step1', {
      profile: { ...emptyProfile, profileType: selected },
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
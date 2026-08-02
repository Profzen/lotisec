import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme/colors';
import { fontSizes, fonts } from '../../theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Step3'>;
  route:      RouteProp<RootStackParamList, 'Step3'>;
};

const bloodTypes = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

export default function Step3Medical({ navigation, route }: Props) {
  const { profile } = route.params;

  const [bloodType,       setBloodType]       = useState(profile.bloodType);

  const isValid = bloodType !== '';

  const [disabilities, setDisabilities] = useState(profile.disabilities ?? '');

  const handleNext = () => {
    if (!isValid) return;
    navigation.navigate('Step4', {
      profile: {
        ...profile,
        bloodType,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>

          <View style={styles.progressBar}>
            {[1, 2, 3, 4, 5].map(i => (
              <View key={i} style={[
                styles.progressStep,
                i <= 3 && styles.progressActive,
              ]} />
            ))}
          </View>


          <Text style={styles.title}>Informations médicales</Text>
          <Text style={styles.subtitle}>Étape 3 sur 5</Text>
          <Text style={styles.requiredNote}>* Champ obligatoire</Text>

          <View style={styles.form}>

            {/* Groupe sanguin */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Groupe sanguin <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.bloodGrid}>
                {bloodTypes.map(bt => (
                  <TouchableOpacity
                    key={bt}
                    style={[
                      styles.bloodBtn,
                      bloodType === bt && styles.bloodBtnSelected,
                    ]}
                    onPress={() => setBloodType(bt)}
                  >
                    <Text style={[
                      styles.bloodText,
                      bloodType === bt && styles.bloodTextSelected,
                    ]}>
                      {bt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Handicap */}
            <View style={styles.field}>
              <Text style={styles.label}>Handicap ou condition particulière</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex : Porteur de pacemaker..."
                placeholderTextColor={colors.textLight}
                value={disabilities}
                onChangeText={setDisabilities}
              />
            </View>


            {/* Note confidentialité */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                <Ionicons name="lock-closed-outline" size={15} color={colors.primary}/> Ces informations sont accessibles uniquement aux professionnels de santé autorisés avec un code institutionnel.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, !isValid && styles.btnDisabled]}
              onPress={handleNext}
              disabled={!isValid}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Continuer →</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: colors.background },
  scroll:              { flexGrow: 1, padding: 24 },
  back:                { marginBottom: 16 },
  backText:            { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.primary },
  progressBar:         { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressStep:        { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressActive:      { backgroundColor: colors.primary },
  title:               { fontSize: fontSizes.xxl, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  subtitle:            { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.textSecondary },
  requiredNote:        { fontSize: fontSizes.xs, color: colors.danger, fontFamily: fonts.regular, marginBottom: 20, marginTop: 4 },
  form:                { gap: 20 },
  field:               { gap: 6 },
  label:               { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, color: colors.text },
  hint:                { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: colors.textLight },
  required:            { color: colors.danger },
  optional:            { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: colors.textLight },
  bloodGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bloodBtn: {
    width: 68, height: 48, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  bloodBtnSelected:    { borderColor: colors.danger, backgroundColor: '#FFF0F0' },
  bloodText:           { fontSize: fontSizes.md, fontFamily: fonts.semiBold, color: colors.textSecondary },
  bloodTextSelected:   { color: colors.danger },
  electroGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  electroBtn: {
    width: 56, height: 44, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  electroBtnSelected:  { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  electroText:         { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, color: colors.textSecondary },
  electroTextSelected: { color: colors.primary },
  input: {
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.text,
  },
  infoBox:   { backgroundColor: colors.primaryLight, borderRadius: 14, borderWidth: 1, borderColor: '#C8D9F2', padding: 14 },
  infoText:  { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: colors.primary, lineHeight: 18 },
  btnPrimary:  { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: colors.border },
  btnText:     { color: colors.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
});

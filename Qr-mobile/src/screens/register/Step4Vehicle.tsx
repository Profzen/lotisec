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

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Step4'>;
  route:      RouteProp<RootStackParamList, 'Step4'>;
};

const vehicleTypes = ['Moto', 'Voiture', 'Vélo', 'Camion', 'Autre'];

export default function Step4Vehicle({ navigation, route }: Props) {
  const { profile } = route.params;

  const [hasVehicle, setHasVehicle] = useState(profile.vehicle.hasVehicle);
  const [type,       setType]       = useState(profile.vehicle.type  ?? '');
  const [plate,      setPlate]      = useState(profile.vehicle.plate ?? '');
  const [brand,      setBrand]      = useState(profile.vehicle.brand ?? '');
  const [model,      setModel]      = useState(profile.vehicle.model ?? '');
  const [color,      setColor]      = useState(profile.vehicle.color ?? '');

  const isValid = !hasVehicle || (hasVehicle && plate.trim() !== '' && type !== '');

  const handleNext = () => {
    if (!isValid) return;
    navigation.navigate('Step5', {
      profile: {
        ...profile,
        vehicle: hasVehicle
          ? { hasVehicle: true, type, plate, brand, model, color }
          : { hasVehicle: false },
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.progressBar}>
            {[1, 2, 3, 4, 5].map(i => (
              <View key={i} style={[styles.progressStep, i <= 4 && styles.progressActive]} />
            ))}
          </View>

          <Text style={styles.title}>Véhicule</Text>
          <Text style={styles.subtitle}>Étape 4 sur 5</Text>

          <View style={styles.form}>

            {/* Possède un véhicule ? */}
            <View style={styles.field}>
              <Text style={styles.label}>Possédez-vous un véhicule ?</Text>
              <View style={styles.toggleRow}>
                {[
                  { value: true,  label: 'Oui' },
                  { value: false, label: 'Non' },
                ].map(opt => (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.toggleBtn, hasVehicle === opt.value && styles.toggleBtnSelected]}
                    onPress={() => setHasVehicle(opt.value)}
                  >
                    <Text style={[styles.toggleText, hasVehicle === opt.value && styles.toggleTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Détails véhicule */}
            {hasVehicle && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Type de véhicule <Text style={styles.required}>*</Text></Text>
                  <View style={styles.optionRow}>
                    {vehicleTypes.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.optionBtn, type === t && styles.optionBtnSelected]}
                        onPress={() => setType(t)}
                      >
                        <Text style={[styles.optionText, type === t && styles.optionTextSelected]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Marque</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Yamaha"
                      placeholderTextColor={colors.textLight}
                      value={brand}
                      onChangeText={setBrand}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Modèle</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="DT125"
                      placeholderTextColor={colors.textLight}
                      value={model}
                      onChangeText={setModel}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>
                    Immatriculation <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="TG-1234-AB"
                    placeholderTextColor={colors.textLight}
                    value={plate}
                    onChangeText={setPlate}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Couleur</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Rouge"
                    placeholderTextColor={colors.textLight}
                    value={color}
                    onChangeText={setColor}
                  />
                </View>
              </>
            )}

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
  container:          { flex: 1, backgroundColor: colors.background },
  scroll:             { flexGrow: 1, padding: 24 },
  back:               { marginBottom: 16 },
  backText:           { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.primary },
  progressBar:        { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressStep:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressActive:     { backgroundColor: colors.primary },
  title:              { fontSize: fontSizes.xxl, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  subtitle:           { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 20 },
  form:               { gap: 16 },
  row:                { flexDirection: 'row', gap: 12 },
  field:              { gap: 6 },
  label:              { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, color: colors.text },
  required:           { color: colors.danger },
  backArrow: { fontSize: 28, fontFamily: fonts.regular, color: colors.primary, lineHeight: 30 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.text,
  },
  toggleRow:          { flexDirection: 'row', gap: 12 },
  toggleBtn:          { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  toggleBtnSelected:  { borderColor: colors.primary, backgroundColor: '#F0F9F4' },
  toggleText:         { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.textSecondary },
  toggleTextSelected: { color: colors.primary, fontFamily: fonts.semiBold },
  optionRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn:          { borderWidth: 1.5, borderColor: colors.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionBtnSelected:  { borderColor: colors.primary, backgroundColor: '#F0F9F4' },
  optionText:         { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.textSecondary },
  optionTextSelected: { color: colors.primary, fontFamily: fonts.semiBold },
  btnPrimary:         { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:        { backgroundColor: colors.border },
  btnText:            { color: colors.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
});
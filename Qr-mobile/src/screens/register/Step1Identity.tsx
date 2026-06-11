import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme/colors';
import { fontSizes, fonts } from '../../theme/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { 
  formatPhoneDisplay, 
  cleanPhone, 
  SUPPORTED_COUNTRIES 
} from '../../utils/validators';
import { useAuth } from '../../hooks/useAuth';

interface Country {
  label: string;
  value: string;
  dialCode: string;
  flag: string;
  format: string;
}

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Step1'>;
  route: RouteProp<RootStackParamList, 'Step1'>;
};

const genders = ['Masculin', 'Féminin'];

const isDateValid = (dateStr: string) => {
  if (dateStr.length !== 10) return false;
  const [day, month, year] = dateStr.split('/').map(Number);
  const currentYear = new Date().getFullYear();
  if (month < 1 || month > 12) return false;
  if (year > currentYear || year < currentYear - 120) return false;
  const dateObj = new Date(year, month - 1, day);
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
};

export default function Step1Identity({ navigation, route }: Props) {
  const { profile } = route.params;
  const { register, loading: authLoading } = useAuth();

  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate || '');
  const [dateError, setDateError] = useState(false);
  const [gender, setGender] = useState(profile?.gender || 'Masculin');
  const [nationality, setNationality] = useState(profile?.nationality || 'Togolaise');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<{message: string, isExists?: boolean} | null>(null);

  const [selectedCountry, setSelectedCountry] = useState<Country>(
    (SUPPORTED_COUNTRIES as Country[]).find((c: Country) => c.value === nationality) || (SUPPORTED_COUNTRIES[0] as Country)
  );

  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const handleBirthDateChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    if (formatted.length <= 10) {
      setBirthDate(formatted);
      if (formatted.length === 10) setDateError(!isDateValid(formatted));
      else setDateError(false);
    }
  };

  const handleNext = async () => {
    setApiError(null);
    if (!isDateValid(birthDate)) {
      setApiError({ message: "La date de naissance n'est pas correcte." });
      setDateError(true);
      return;
    }

    if (!hasMinLength || !hasUpperCase || !hasNumber) {
      setApiError({ message: "Veuillez respecter les critères de sécurité du mot de passe." });
      return;
    }

    const fullPhone = selectedCountry.dialCode + cleanPhone(phone);
    
    try {
      const result = await register(fullPhone, password);
      const token = result?.token || result?.access_token;
      if (token) {
        await AsyncStorage.setItem('token', token);
      }

      navigation.navigate('Step2', {
        profile: { ...profile, firstName, lastName, birthDate, gender, nationality, phone: fullPhone }
      });
    } catch (err: any) {
      if (err.message?.includes("déjà") || err.message?.includes("exists")) {
        setApiError({ message: "Ce numéro de téléphone est déjà utilisé.", isExists: true });
      } else {
        setApiError({ message: err.message || "Une erreur est survenue lors de l'inscription." });
      }
    }
  };

  const Required = () => <Text style={styles.required}> *</Text>;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.title}>Identité</Text>
          <Text style={styles.subtitle}>Informations personnelles pour votre fiche de secours.</Text>

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Prénom<Required/></Text>
                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Jean" />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Nom<Required/></Text>
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Dupont" />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Date de naissance<Required/></Text>
              <TextInput 
                style={[styles.input, dateError && styles.inputError]} 
                value={birthDate} 
                onChangeText={handleBirthDateChange} 
                placeholder="JJ/MM/AAAA" 
                keyboardType="number-pad" 
                maxLength={10} 
              />
              {dateError && <Text style={styles.errorText}>Date invalide ou inexistante</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Genre<Required/></Text>
              <View style={styles.optionRow}>
                {genders.map(g => (
                  <TouchableOpacity 
                    key={g} 
                    style={[styles.optionBtn, gender === g && styles.optionBtnSelected]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.optionText, gender === g && styles.optionTextSelected]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nationalité</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countryScroll}>
                {(SUPPORTED_COUNTRIES as Country[]).map((c: Country) => (
                  <TouchableOpacity 
                    key={c.value} 
                    style={[styles.countryBadge, nationality === c.value && styles.activeBadge]}
                    onPress={() => {
                      setNationality(c.value);
                      setSelectedCountry(c);
                    }}
                  >
                    <Text style={styles.badgeText}>{c.flag} {c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.separator}>
              <View style={styles.separatorLine} /><Text style={styles.separatorText}>SÉCURITÉ</Text><View style={styles.separatorLine} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Téléphone<Required/></Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryPrefix}>
                  <Text style={styles.prefixText}>{selectedCountry.flag} {selectedCountry.dialCode}</Text>
                </View>
                <TextInput
                  style={styles.flexInput}
                  value={phone}
                  onChangeText={(t) => setPhone(formatPhoneDisplay(t))}
                  keyboardType="phone-pad"
                  placeholder={selectedCountry.format}
                  maxLength={11}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe<Required/></Text>
              <View style={styles.phoneInputRow}>
                <TextInput
                  style={styles.flexInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Votre mot de passe"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.passwordRules}>
                <Text style={[styles.ruleText, hasMinLength ? styles.ruleValid : styles.ruleInvalid]}>{hasMinLength ? '●' : '○'} 8 caractères minimum</Text>
                <Text style={[styles.ruleText, hasUpperCase ? styles.ruleValid : styles.ruleInvalid]}>{hasUpperCase ? '●' : '○'} Une majuscule</Text>
                <Text style={[styles.ruleText, hasNumber ? styles.ruleValid : styles.ruleInvalid]}>{hasNumber ? '●' : '○'} Un chiffre</Text>
              </View>
            </View>

            {apiError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{apiError.message}</Text>
                {apiError.isExists && (
                  <TouchableOpacity style={styles.errorActionBtn} onPress={() => navigation.navigate('Login' as any)}>
                    <Text style={styles.errorActionText}>Se connecter</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity 
              style={[styles.btnPrimary, (authLoading || !firstName || dateError || !hasMinLength) && styles.btnDisabled]} 
              onPress={handleNext}
              disabled={authLoading}
            >
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Suivant</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 40 },
  title: { fontSize: fontSizes.xl, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: fontSizes.md, color: colors.textSecondary, marginBottom: 24 },
  form: { gap: 20 },
  row: { flexDirection: 'row', gap: 12 },
  field: { gap: 8 },
  label: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, color: colors.text },
  required: { color: 'red', fontWeight: 'bold' },
  input: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, fontSize: fontSizes.md, color: colors.text },
  inputError: { borderColor: '#E53935', borderWidth: 1.5 },
  errorText: { color: '#E53935', fontSize: 10, marginTop: -4, marginLeft: 4 },
  optionRow: { flexDirection: 'row', gap: 10 },
  optionBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  optionBtnSelected: { borderColor: colors.primary, backgroundColor: '#F0F9F4' },
  optionText: { color: colors.textSecondary, fontFamily: fonts.medium },
  optionTextSelected: { color: colors.primary, fontFamily: fonts.bold },
  countryScroll: { flexDirection: 'row', marginTop: 4 },
  countryBadge: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginRight: 8, backgroundColor: colors.surface },
  activeBadge: { borderColor: colors.primary, backgroundColor: '#F0F9F4' },
  badgeText: { fontSize: 13, fontFamily: fonts.medium },
  phoneInputRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  countryPrefix: { paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: '#F9F9F9' },
  prefixText: { fontFamily: fonts.bold, fontSize: 14 },
  flexInput: { flex: 1, padding: 14, fontSize: fontSizes.md, color: colors.text },
  eyeBtn: { padding: 14, justifyContent: 'center' },
  passwordRules: { marginTop: 4, gap: 2, paddingLeft: 4 },
  ruleText: { fontSize: 11, fontFamily: fonts.medium },
  ruleInvalid: { color: colors.textSecondary },
  ruleValid: { color: '#2E7D32' },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { fontSize: 10, color: colors.textSecondary, fontFamily: fonts.bold },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 18, alignItems: 'center', marginTop: 10 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: fontSizes.md, fontFamily: fonts.bold },
  errorBox: { backgroundColor: '#FDECEA', padding: 16, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#F5C6CB', alignItems: 'center' },
  errorBoxText: { color: '#721C24', fontFamily: fonts.medium, fontSize: fontSizes.sm, textAlign: 'center' },
  errorActionBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#721C24', borderRadius: 8 },
  errorActionText: { color: '#fff', fontFamily: fonts.bold, fontSize: fontSizes.sm },
});
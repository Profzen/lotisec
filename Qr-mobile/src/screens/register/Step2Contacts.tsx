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
import { EmergencyContact, SchoolInfo } from '../../types/profile';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Step2'>;
  route:      RouteProp<RootStackParamList, 'Step2'>;
};

const relations = ['Parent', 'Conjoint', 'Ami(e)', 'Médecin', 'Autre'];

export default function Step2Contacts({ navigation, route }: Props) {
  const { profile } = route.params;
  const isStudent = profile.profileType === 'student';

  const [contacts, setContacts] = useState<EmergencyContact[]>(
    profile.emergencyContacts.length > 0
      ? profile.emergencyContacts
      : [{ name: '', phone: '', relation: '' }]
  );

  const [school, setSchool] = useState<SchoolInfo>(
    profile.schoolInfo ?? {
      schoolName: '', className: '',
      directorName: '', directorPhone: '',
      parentName: '', parentPhone: '',
    }
  );

  const updateContact = (index: number, field: keyof EmergencyContact, value: string) => {
    setContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const addContact = () => {
    if (contacts.length >= 3) return;
    setContacts(prev => [...prev, { name: '', phone: '', relation: '' }]);
  };

  const removeContact = (index: number) => {
    if (contacts.length === 1) return;
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  const isValid =
    contacts[0].name.trim() !== '' &&
    contacts[0].phone.trim() !== '' &&
    (!isStudent || (
      school.schoolName.trim() !== '' &&
      school.parentName.trim() !== '' &&
      school.parentPhone.trim() !== ''
    ));

  const handleNext = () => {
    if (!isValid) return;
    navigation.navigate('Step3', {
      profile: {
        ...profile,
        emergencyContacts: contacts.filter(c => c.name.trim() !== ''),
        schoolInfo: isStudent ? school : undefined,
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
              <View key={i} style={[
                styles.progressStep,
                i <= 2 && styles.progressActive,
              ]} />
            ))}
          </View>

          <Text style={styles.title}>Contacts d'urgence</Text>
          <Text style={styles.subtitle}>Étape 2 sur 5</Text>
          <Text style={styles.requiredNote}>* Champs obligatoires</Text>

          {contacts.map((contact, index) => (
            <View key={index} style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <Text style={styles.contactTitle}>
                  Contact {index + 1} {index === 0 && <Text style={styles.required}>*</Text>}
                </Text>
                {index > 0 && (
                  <TouchableOpacity onPress={() => removeContact(index)}>
                    <Text style={styles.removeText}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Nom complet {index === 0 && <Text style={styles.required}>*</Text>}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex : Ama Mensah"
                  placeholderTextColor={colors.textLight}
                  value={contact.name}
                  onChangeText={v => updateContact(index, 'name', v)}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  Téléphone {index === 0 && <Text style={styles.required}>*</Text>}
                </Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryPrefix}>
                    <Text style={styles.prefixText}>🇹🇬 +228</Text>
                  </View>
                  <TextInput
                    style={styles.flexInput}
                    placeholder="90 00 00 00"
                    placeholderTextColor={colors.textLight}
                    value={contact.phone}
                    onChangeText={v => updateContact(index, 'phone', v)}
                    keyboardType="phone-pad"
                    maxLength={8}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Lien de parenté</Text>
                <View style={styles.optionRow}>
                  {relations.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.optionBtn, contact.relation === r && styles.optionBtnSelected]}
                      onPress={() => updateContact(index, 'relation', r)}
                    >
                      <Text style={[styles.optionText, contact.relation === r && styles.optionTextSelected]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          ))}

          {contacts.length < 3 && (
            <TouchableOpacity style={styles.addBtn} onPress={addContact}>
              <Text style={styles.addBtnText}>+ Ajouter un contact</Text>
            </TouchableOpacity>
          )}

          {isStudent && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations scolaires</Text>
              
              <View style={styles.field}><Text style={styles.label}>Nom de l'école</Text>
                <TextInput style={styles.input} placeholder="Ex : Lycée Sainte-Marie" value={school.schoolName} onChangeText={v => setSchool(prev => ({ ...prev, schoolName: v }))} />
              </View>
              
              <View style={styles.field}><Text style={styles.label}>Classe</Text>
                <TextInput style={styles.input} placeholder="Ex : CM1" value={school.className} onChangeText={v => setSchool(prev => ({ ...prev, className: v }))} />
              </View>

              <View style={styles.field}><Text style={styles.label}>Nom du parent/tuteur *</Text>
                <TextInput style={styles.input} placeholder="Ex : Kofi Mensah" value={school.parentName} onChangeText={v => setSchool(prev => ({ ...prev, parentName: v }))} />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Téléphone parent/tuteur *</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryPrefix}>
                    <Text style={styles.prefixText}>🇹🇬 +228</Text>
                  </View>
                  <TextInput
                    style={styles.flexInput}
                    placeholder="90 00 00 00"
                    value={school.parentPhone}
                    onChangeText={v => setSchool(prev => ({ ...prev, parentPhone: v }))}
                    keyboardType="phone-pad"
                    maxLength={8}
                  />
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btnPrimary, !isValid && styles.btnDisabled]}
            onPress={handleNext}
            disabled={!isValid}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Continuer →</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: 24 },
  back: { marginBottom: 16 },
  backArrow: { fontSize: 28, fontFamily: fonts.regular, color: colors.primary, lineHeight: 30 },
  progressBar: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressStep: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressActive: { backgroundColor: colors.primary },
  title: { fontSize: fontSizes.xxl, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.textSecondary },
  requiredNote: { fontSize: fontSizes.xs, color: '#E53935', fontFamily: fonts.regular, marginBottom: 20, marginTop: 4 },
  contactCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, marginBottom: 12, gap: 12 },
  contactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactTitle: { fontSize: fontSizes.md, fontFamily: fonts.semiBold, color: colors.text },
  removeText: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: '#E53935' },
  field: { gap: 6 },
  label: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, color: colors.text },
  required: { color: '#E53935' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: fontSizes.md, color: colors.text },
  phoneInputRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  countryPrefix: { paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: '#F9F9F9' },
  prefixText: { fontFamily: fonts.bold, fontSize: 14 },
  flexInput: { flex: 1, padding: 14, fontSize: fontSizes.md, color: colors.text },
  infoBox: { backgroundColor: '#EFF9F4', borderRadius: 10, borderWidth: 1, borderColor: '#C8EDD8', padding: 14 },
  optionBtn: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionBtnSelected: { borderColor: colors.primary, backgroundColor: '#F0F9F4' },
  optionText: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.textSecondary },
  optionTextSelected: { color: colors.primary, fontFamily: fonts.semiBold },
  addBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16, borderStyle: 'dashed' },
  addBtnText: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, color: colors.primary },
  section: { gap: 12, marginBottom: 16 },
  sectionTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: colors.border },
  btnText: { color: colors.white, fontSize: fontSizes.md, fontFamily: fonts.bold },
});
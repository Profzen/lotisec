import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActionButton, SectionHeading, SurfaceCard } from '../components/ui';

import { useAuth } from '../hooks/useAuth';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { login, loading } = useAuth();

  const handleLogin = async () => {
    setApiError(null);
    if (!phone || !password) {
      setApiError("Veuillez saisir votre numéro et votre mot de passe.");
      return;
    }
    try {
      const normalized=phone.replace(/\s/g,'');
      const fullPhone=normalized.startsWith('+')?normalized:`+228${normalized}`;
      await login(fullPhone, password);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Accueil' } }] });
    } catch (error: any) {
      setApiError(error.message || "Impossible de se connecter.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>

          <View style={styles.brand}><View style={styles.brandMark}><Ionicons name="shield-checkmark" size={24} color={colors.accent}/></View><View><Text style={styles.brandName}>LOTISEC</Text><Text style={styles.brandSub}>Identité · Urgence · Mobilité</Text></View></View>
          <SectionHeading eyebrow="Espace sécurisé" title="Bon retour parmi nous" description="Connectez-vous pour retrouver votre profil, vos alertes et vos trajets."/>

          <SurfaceCard style={styles.form}>
            {/* Champ Téléphone Uniformisé */}
            <View style={styles.field}>
              <Text style={styles.label}>Numéro de téléphone</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryPrefix}>
                  <Text style={styles.prefixText}>TG +228</Text>
                </View>
                <TextInput
                  style={styles.flexInput}
                  placeholder="90 00 00 00"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Champ Mot de passe */}
            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.phoneInputRow}>
                <TextInput
                  style={styles.flexInput}
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {apiError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{apiError}</Text>
              </View>
            )}

            <ActionButton label="Se connecter" icon="log-in-outline" onPress={handleLogin} loading={loading}/>

            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>Pas de compte ? <Text style={styles.link}>Créer un profil</Text></Text>
            </TouchableOpacity>
          </SurfaceCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingTop:16 },
  back: { marginBottom: 24,alignSelf:'flex-start',backgroundColor:colors.white,borderWidth:1,borderColor:colors.border,borderRadius:12,paddingHorizontal:12,paddingVertical:9 },
  backText: { fontSize: fontSizes.sm, color: colors.primary, fontFamily: fonts.medium },
  brand:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:28},brandMark:{width:48,height:48,borderRadius:15,backgroundColor:colors.primaryDark,alignItems:'center',justifyContent:'center'},brandName:{fontFamily:fonts.bold,fontSize:18,color:colors.text,letterSpacing:1},brandSub:{fontFamily:fonts.regular,fontSize:11,color:colors.textSecondary,marginTop:2},
  title: { fontSize: fontSizes.xxl, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: fontSizes.md, color: colors.textSecondary, marginBottom: 24 },
  form: { gap: 18,marginTop:6 },
  field: { gap: 8 },
  label: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold },
  phoneInputRow: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, borderRadius: 13, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden',minHeight:52 },
  countryPrefix: { paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.primaryLight },
  prefixText: { fontFamily: fonts.bold, fontSize: 14 },
  flexInput: { flex: 1, padding: 14, fontSize: fontSizes.md, color: colors.text },
  eyeBtn: { padding: 14, justifyContent: 'center' },
  linkText: { textAlign: 'center', marginTop: 16, color: colors.textSecondary },
  link: { color: colors.primary, fontFamily: fonts.bold },
  errorBox: { backgroundColor: '#FDECEA', padding: 16, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#F5C6CB', alignItems: 'center' },
  errorBoxText: { color: '#721C24', fontFamily: fonts.medium, fontSize: fontSizes.sm, textAlign: 'center' },
});

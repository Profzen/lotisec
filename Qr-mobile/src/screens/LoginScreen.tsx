import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert("Champs requis", "Veuillez saisir votre numéro et votre mot de passe.");
      return;
    }
    setLoading(true);
    try {
      const fullPhone = "+228" + phone.replace(/\s/g, ''); // Formatage pour le Togo
      const response = await fetch('https://safelife.up.railway.app/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, password: password }),
      });

      const data = await response.json();
      if (response.ok) {
        const token = data.token || data.access_token;
        if (token) {
          await AsyncStorage.setItem('token', token);
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Accueil' } }] });
        }
      } else {
        Alert.alert("Échec", data.detail || "Identifiants incorrects");
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>Accédez à votre profil SafeLife</Text>

          <View style={styles.form}>
            {/* Champ Téléphone Uniformisé */}
            <View style={styles.field}>
              <Text style={styles.label}>Numéro de téléphone</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryPrefix}>
                  <Text style={styles.prefixText}>🇹🇬 +228</Text>
                </View>
                <TextInput
                  style={styles.flexInput}
                  placeholder="90 00 00 00"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={8}
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

            <TouchableOpacity 
              style={[styles.btnPrimary, loading && { opacity: 0.7 }]} 
              onPress={handleLogin} 
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Se connecter</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>Pas de compte ? <Text style={styles.link}>Créer un profil</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24 },
  back: { marginBottom: 32 },
  backText: { fontSize: fontSizes.sm, color: colors.primary, fontFamily: fonts.medium },
  title: { fontSize: fontSizes.xxl, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: fontSizes.md, color: colors.textSecondary, marginBottom: 40 },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold },
  phoneInputRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  countryPrefix: { paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: '#F9F9F9' },
  prefixText: { fontFamily: fonts.bold, fontSize: 14 },
  flexInput: { flex: 1, padding: 14, fontSize: fontSizes.md },
  eyeBtn: { padding: 14, justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: fontSizes.md, fontFamily: fonts.bold },
  linkText: { textAlign: 'center', marginTop: 16, color: colors.textSecondary },
  link: { color: colors.primary, fontFamily: fonts.bold },
});
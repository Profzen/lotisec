import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet,StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme/colors';
import { fontSizes, fonts } from '../../theme/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Landing'>;
};

export default function LandingScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Bande décorative couleurs togolaises */}
      <View style={styles.flagBar}>
        <View style={[styles.flagStripe, { backgroundColor: colors.green }]} />
        <View style={[styles.flagStripe, { backgroundColor: colors.yellow }]} />
        <View style={[styles.flagStripe, { backgroundColor: colors.red }]} />
      </View>

      {/* Logo + slogan */}
      <View style={styles.center}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoMedi}>Safe</Text>
          <Text style={styles.logoQR}>Life</Text>
        </View>
        <Text style={styles.tagline}>
          Identifié en un scan.{'\n'}Secouru à temps.
        </Text>
        <Text style={styles.subTagline}>
          Vos informations d'urgence,{'\n'}toujours accessibles.
        </Text>
      </View>

      {/* Boutons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Créer mon profil</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>J'ai déjà un compte</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.primary },
  flagBar:      { flexDirection: 'row', height: 5 },
  flagStripe:   { flex: 1 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoContainer:{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  logoMedi:     { fontSize: 52, fontFamily: fonts.bold, color: colors.white, letterSpacing: 2 },
  logoQR:       { fontSize: 52, fontFamily: fonts.bold, color: colors.yellow, letterSpacing: 2 },
  tagline:      { fontSize: fontSizes.xl, fontFamily: fonts.semiBold, color: colors.white, textAlign: 'center', lineHeight: 30, marginBottom: 16 },
  subTagline:   { fontSize: fontSizes.md, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22 },
  buttons:      { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  btnPrimary:   { backgroundColor: colors.white, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText:  { color: colors.primary, fontSize: fontSizes.md, fontFamily: fonts.bold, letterSpacing: 0.5 },
  btnSecondary:    { backgroundColor: 'transparent', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText:{ color: colors.white, fontSize: fontSizes.md, fontFamily: fonts.medium },
  back:      { marginBottom: 16, alignSelf: 'flex-start', padding: 4 },
  backArrow: { fontSize: 28, fontFamily: fonts.regular, color: colors.primary, lineHeight: 30 },
});

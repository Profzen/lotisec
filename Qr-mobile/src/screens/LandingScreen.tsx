import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar, Image, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Landing'>;
};

const { width } = Dimensions.get('window');

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

      {/* Logo Image + slogan */}
      <View style={styles.center}>
        <View style={styles.logoContainer}>
          {/* REMPLACEMENT DU TEXTE PAR L'IMAGE */}
          <Image 
            source={require('../../assets/Lotisec-bg.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.tagline}>
          Votre identité vous protège,{'\n'}même quand vous ne le pouvez plus.
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
  container:     { flex: 1, backgroundColor: colors.primary },
  flagBar:       { flexDirection: 'row', height: 5 },
  flagStripe:    { flex: 1 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  
  logoContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 5, // Un peu plus d'espace sous le logo
  },
  logoImage: { 
    width: width * 0.65, // Taille du logo (55% de la largeur écran)
    height: width * 0.65,
  },

  tagline:       { fontSize: fontSizes.lg, fontFamily: fonts.semiBold, color: colors.white, textAlign: 'center', lineHeight: 30, marginBottom: 16 },
  buttons:       { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  btnPrimary:    { backgroundColor: colors.white, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText:   { color: colors.primary, fontSize: fontSizes.md, fontFamily: fonts.bold, letterSpacing: 0.5 },
  btnSecondary:     { backgroundColor: 'transparent', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText: { color: colors.white, fontSize: fontSizes.md, fontFamily: fonts.medium },
});
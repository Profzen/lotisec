import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, StatusBar, Dimensions, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
};

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }: Props) {

  // ── Animations ──────────────────────────────────────────────
  const logoScale     = useRef(new Animated.Value(0.3)).current;
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const taglineOffset = useRef(new Animated.Value(20)).current;
  const flagOpacity   = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(taglineOffset, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(flagOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          Animated.timing(screenOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start(() => {
            navigation.replace('Landing');
          });
        }, 1800);
      });
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      
      <StatusBar barStyle="light-content" backgroundColor="#006a4e" />

      {/* ── Cercles décoratifs (Opacité légère pour le relief) ── */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      {/* ── Centre ── */}
      <View style={styles.center}>
        <Animated.View style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Image
            source={require('../../assets/Lotisec.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

      </View>

      {/* ── BAS : Drapeau ── */}
      <Animated.View style={[styles.flagWrap, { opacity: flagOpacity }]}>
        <View style={styles.flagBar}>
          <View style={[styles.flagStripe, { backgroundColor: colors.green }]} />
          <View style={[styles.flagStripe, { backgroundColor: colors.yellow }]} />
          <View style={[styles.flagStripe, { backgroundColor: colors.red }]} />
        </View>
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#006a4e', 
    justifyContent: 'center',
  },
  circle1: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: '#006a4e', 
    left: -width * 0.1,
  },
  circle2: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: '#006a4e',
    bottom: -width * 0.2,
    right: -width * 0.2,
  },
  circle3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#006a4e', 
    top: height * 0.15,
    right: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoImage: {
    width: width * 0.7,
    height: width * 0.7,
    marginBottom: 20,
  },
  flagWrap: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 40,
    gap: 10,
  },
  flagBar: {
    flexDirection: 'row',
    width: 80,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  flagStripe: { flex: 1 },
});
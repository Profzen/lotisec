import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import {navigationRef} from './src/navigation/AppNavigator';
import * as Notifications from 'expo-notifications';

// ── Empêche le splash natif de disparaître automatiquement ────
// Il reste visible pendant le chargement des polices
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Le SplashScreen.tsx animé prend le relais
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);
  useEffect(()=>{const open=(response:Notifications.NotificationResponse|null)=>{const data=response?.notification.request.content.data as any;const rideId=data?.ride_id;if(!rideId)return;const route=data.type==='ride_message'?'RideChat':'RideDetail';const navigate=()=>navigationRef.isReady()?navigationRef.navigate(route as any,{rideId}):setTimeout(navigate,250);navigate();};const subscription=Notifications.addNotificationResponseReceivedListener(open);Notifications.getLastNotificationResponseAsync().then(open);return()=>subscription.remove();},[]);

 
  // (le splash natif vert avec le logo est toujours visible)
  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}

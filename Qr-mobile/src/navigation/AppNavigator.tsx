import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

import { ProfileData } from '../types/profile';

// Écrans
import LandingScreen   from '../screens/LandingScreen';
import LoginScreen     from '../screens/LoginScreen';
import RegisterScreen  from '../screens/RegisterScreen';
import Step1Identity   from '../screens/register/Step1Identity';
import Step2Contacts   from '../screens/register/Step2Contacts';
import Step3Medical    from '../screens/register/Step3Medical';
import Step4Vehicle    from '../screens/register/Step4Vehicle';
import Step5Review     from '../screens/register/Step5Review';
import HomeScreen      from '../screens/HomeScreen';
import HopitauxScreen from '../screens/HopitauxScreen';
import ConseilsScreen  from '../screens/ConseilsScreen';
import QRCodeScreen from '../screens/QRCodeScreen';
import ZemPassengerScreen from '../screens/ZemPassengerScreen';
import ZemDriverScreen from '../screens/ZemDriverScreen';

// 1. Mise à jour des types pour inclure toutes les routes du Stack
export type RootStackParamList = {
  Splash:    undefined;
  Landing:   undefined;
  Login:     undefined;
  Register:  undefined;
  Step1:     { profile: ProfileData };
  Step2:     { profile: ProfileData };
  Step3:     { profile: ProfileData };
  Step4:     { profile: ProfileData };
  Step5:     { profile: ProfileData };
  MainTabs:  undefined; // Route principale après connexion
  ZemPassenger: undefined;
  ZemDriver: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// 2. CONFIGURATION DES ONGLETS
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFA700', 
        tabBarInactiveTintColor: '#555',
        tabBarStyle: {
          backgroundColor: '#FFFF', 
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
      }}
    >
      <Tab.Screen 
        name="Accueil" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }} 
      />
      <Tab.Screen 
        name="Hôpitaux" 
        component={HopitauxScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "medical" : "medical-outline"} size={24} color={color} />
          ),
        }} 
      />
      <Tab.Screen 
        name="Conseils" 
        component={ConseilsScreen} 
        options={{
          tabBarLabel: 'Conseils',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bulb" : "bulb-outline"} size={24} color={color} />
          ),
        }} 
      />
      <Tab.Screen 
        name="QRCode" 
        component={QRCodeScreen} 
        options={{
          tabBarLabel: 'Mon QR',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "qr-code" : "qr-code-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// 3. NAVIGATEUR PRINCIPAL
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Landing"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Landing"  component={LandingScreen}  />
        <Stack.Screen name="Login"    component={LoginScreen}    />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Step1"    component={Step1Identity}  />
        <Stack.Screen name="Step2"    component={Step2Contacts}  />
        <Stack.Screen name="Step3"    component={Step3Medical}   />
        <Stack.Screen name="Step4"    component={Step4Vehicle}   />
        <Stack.Screen name="Step5"    component={Step5Review}    />
        <Stack.Screen name="ZemPassenger" component={ZemPassengerScreen} />
        <Stack.Screen name="ZemDriver"    component={ZemDriverScreen} />

        {/* Une fois connecté, on charge le TabNavigator. 
          Les écrans Hôpitaux, Conseils et QRCode sont déjà dedans !
        */}
        <Stack.Screen name="MainTabs" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Platform, View } from 'react-native';
import { colors, shadows } from '../theme/colors';
import { fonts } from '../theme/typography';

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
import ZemPassengerScreen from '../screens/ZemPassengerScreen';
import ZemDriverScreen from '../screens/ZemDriverScreen';
import RidesScreen from '../screens/RidesScreen';
import AssistantScreen from '../screens/AssistantScreen';
import RideDetailScreen from '../screens/RideDetailScreen';
import RideChatScreen from '../screens/RideChatScreen';
import OperationalMissionsScreen from '../screens/OperationalMissionsScreen';
import ProfessionalAccountScreen from '../screens/ProfessionalAccountScreen';
import CitizenProfileScreen from '../screens/CitizenProfileScreen';
import {hydrateSession} from '../services/session';

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
  Assistant: undefined;
  RideDetail: {rideId:string};
  RideChat: {rideId:string};
};

const Stack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef=createNavigationContainerRef<RootStackParamList>();
const Tab = createBottomTabNavigator();

// 2. CONFIGURATION DES ONGLETS
function TabNavigator() {
  const [roles,setRoles]=React.useState<string[]|null>(null);
  React.useEffect(()=>{hydrateSession(true).then(session=>setRoles(session?.user?.roles||[])).catch(()=>setRoles([]));},[]);
  if(!roles)return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={colors.primary}/></View>;
  const terrain=roles.some(role=>['admin','supervisor','dispatcher','firefighter','ambulance_driver'].includes(role));
  const hospital=roles.some(role=>['hospital_manager','hospital_agent'].includes(role));
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: { fontFamily:fonts.semiBold, fontSize:11, marginTop:2 },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 72,
          paddingTop: 9,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          ...shadows.card,
        },
        tabBarItemStyle: { borderRadius:14, marginHorizontal:2 },
      }}
    >
      {terrain ? <>
      <Tab.Screen name="Missions" component={OperationalMissionsScreen} options={{tabBarIcon:({color,focused})=><Ionicons name={focused?'navigate':'navigate-outline'} size={24} color={color}/>}}/>
      <Tab.Screen name="Hôpitaux" component={HopitauxScreen} options={{tabBarIcon:({color,focused})=><Ionicons name={focused?'medical':'medical-outline'} size={24} color={color}/>}}/>
      <Tab.Screen name="Compte" component={ProfessionalAccountScreen} options={{tabBarIcon:({color,focused})=><Ionicons name={focused?'person-circle':'person-circle-outline'} size={24} color={color}/>}}/>
      </> : hospital ? <><Tab.Screen name="Hôpitaux" component={HopitauxScreen} options={{tabBarIcon:({color,focused})=><Ionicons name={focused?'medical':'medical-outline'} size={24} color={color}/>}}/><Tab.Screen name="Compte" component={ProfessionalAccountScreen} options={{tabBarIcon:({color,focused})=><Ionicons name={focused?'person-circle':'person-circle-outline'} size={24} color={color}/>}}/></> : <>
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
        name="AssistantTab" 
        component={AssistantScreen} 
        options={{
          tabBarLabel: 'Assistant',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Rides" 
        component={RidesScreen} 
        options={{
          tabBarLabel: 'Trajets',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen name="Profil" component={CitizenProfileScreen} options={{tabBarIcon:({color,focused})=><Ionicons name={focused?'person-circle':'person-circle-outline'} size={24} color={color}/>}}/>
      </>}
    </Tab.Navigator>
  );
}

// 3. NAVIGATEUR PRINCIPAL
export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
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
        <Stack.Screen name="Assistant"    component={AssistantScreen} />
        <Stack.Screen name="RideDetail" component={RideDetailScreen}/>
        <Stack.Screen name="RideChat" component={RideChatScreen}/>

        {/* Une fois connecté, on charge le TabNavigator. 
          Les écrans Hôpitaux, Conseils et QRCode sont déjà dedans !
        */}
        <Stack.Screen name="MainTabs" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

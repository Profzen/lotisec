import React from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';

type Props={navigation:NativeStackNavigationProp<RootStackParamList,'Landing'>};
export default function LandingScreen({navigation}:Props){
  const {width,height}=useWindowDimensions();
  const compact=height<680||width<360;
  const logoSize=Math.min(width*(compact?0.38:0.46),compact?132:184);
  return <LinearGradient colors={[colors.primaryDark,'#0B3153','#0D4770']} style={styles.container}>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark}/>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
      <View style={styles.flagBar}><View style={[styles.flagStripe,{backgroundColor:colors.green}]}/><View style={[styles.flagStripe,{backgroundColor:colors.yellow}]}/><View style={[styles.flagStripe,{backgroundColor:colors.red}]}/></View>
      <View style={[styles.center,compact&&styles.centerCompact]}>
        <Image source={require('../../assets/Lotisec-bg.png')} style={{width:logoSize,height:logoSize}} resizeMode="contain"/>
        <View style={styles.badge}><View style={styles.badgeDot}/><Text style={styles.badgeText}>Protection connectée 24h/24</Text></View>
        <Text style={styles.title}>Votre sécurité,{`\n`}coordonnée en temps réel.</Text>
        <Text style={styles.tagline}>Identité médicale, SOS, secours, hôpitaux et mobilité Zem dans une seule expérience.</Text>
      </View>
      <View style={[styles.buttons,compact&&styles.buttonsCompact]}>
        <TouchableOpacity style={styles.btnPrimary} onPress={()=>navigation.navigate('Register')} activeOpacity={0.85}><Text style={styles.btnPrimaryText}>Créer mon profil</Text><Ionicons name="arrow-forward" size={19} color={colors.primary}/></TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={()=>navigation.navigate('Login')} activeOpacity={0.85}><Ionicons name="log-in-outline" size={19} color={colors.white}/><Text style={styles.btnSecondaryText}>J’ai déjà un compte</Text></TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  </LinearGradient>;
}

const styles=StyleSheet.create({
  container:{flex:1},safe:{flex:1},scrollContent:{flexGrow:1},flagBar:{flexDirection:'row',height:4},flagStripe:{flex:1},center:{flex:1,minHeight:390,alignItems:'center',justifyContent:'center',paddingHorizontal:28,paddingVertical:20},centerCompact:{minHeight:330,paddingHorizontal:20,paddingVertical:12},
  badge:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'rgba(25,181,232,0.14)',borderWidth:1,borderColor:'rgba(113,212,245,0.28)',paddingHorizontal:12,paddingVertical:7,borderRadius:99,marginTop:2,marginBottom:18},badgeDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.accent},badgeText:{fontSize:11,fontFamily:fonts.semiBold,color:'#C9F2FF',letterSpacing:0.5},
  title:{fontSize:30,fontFamily:fonts.bold,color:colors.white,textAlign:'center',lineHeight:38,marginBottom:12},tagline:{maxWidth:430,fontSize:fontSizes.sm,fontFamily:fonts.regular,color:'#B8C8D9',textAlign:'center',lineHeight:22},buttons:{width:'100%',maxWidth:520,alignSelf:'center',paddingHorizontal:24,paddingBottom:32,gap:12},buttonsCompact:{paddingHorizontal:18,paddingBottom:18,gap:9},
  btnPrimary:{backgroundColor:colors.white,borderRadius:15,paddingVertical:17,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10},btnPrimaryText:{color:colors.primary,fontSize:fontSizes.md,fontFamily:fonts.bold},btnSecondary:{backgroundColor:'rgba(255,255,255,0.06)',borderRadius:15,borderWidth:1,borderColor:'rgba(255,255,255,0.24)',paddingVertical:16,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10},btnSecondaryText:{color:colors.white,fontSize:fontSizes.md,fontFamily:fonts.medium}
});

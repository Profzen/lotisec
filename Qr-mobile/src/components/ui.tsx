import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { fonts, fontSizes } from '../theme/typography';

export function SurfaceCard({children,style}:{children:React.ReactNode;style?:StyleProp<ViewStyle>}){
  return <View style={[styles.card,style]}>{children}</View>;
}

export function SectionHeading({eyebrow,title,description}:{eyebrow?:string;title:string;description?:string}){
  return <View style={styles.heading}>{eyebrow?<Text style={styles.eyebrow}>{eyebrow}</Text>:null}<Text style={styles.title}>{title}</Text>{description?<Text style={styles.description}>{description}</Text>:null}</View>;
}

export function ActionButton({label,onPress,icon='arrow-forward',variant='primary',loading=false,disabled=false}:{label:string;onPress:()=>void;icon?:React.ComponentProps<typeof Ionicons>['name'];variant?:'primary'|'secondary'|'danger'|'ghost';loading?:boolean;disabled?:boolean}){
  const palette={primary:[colors.primary,colors.white],secondary:[colors.primaryLight,colors.primary],danger:[colors.danger,colors.white],ghost:['transparent',colors.textSecondary]}[variant];
  return <TouchableOpacity accessibilityRole="button" disabled={disabled||loading} activeOpacity={0.82} onPress={onPress} style={[styles.button,{backgroundColor:palette[0]},variant==='ghost'&&styles.ghost,(disabled||loading)&&styles.disabled]}>{loading?<ActivityIndicator color={palette[1]}/>:<><Text style={[styles.buttonText,{color:palette[1]}]}>{label}</Text><Ionicons name={icon} size={18} color={palette[1]}/></>}</TouchableOpacity>;
}

export function StatusPill({label,tone='info'}:{label:string;tone?:'info'|'success'|'warning'|'danger'}){
  const palette={info:[colors.primaryLight,colors.primary],success:[colors.successSoft,colors.success],warning:[colors.warningSoft,colors.warning],danger:[colors.dangerSoft,colors.danger]}[tone];
  return <View style={[styles.pill,{backgroundColor:palette[0]}]}><View style={[styles.dot,{backgroundColor:palette[1]}]}/><Text style={[styles.pillText,{color:palette[1]}]}>{label}</Text></View>;
}

const styles=StyleSheet.create({
  card:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:spacing.lg,...shadows.card},
  heading:{gap:4,marginBottom:spacing.md},eyebrow:{fontFamily:fonts.bold,fontSize:10,letterSpacing:1.4,color:colors.primary,textTransform:'uppercase'},title:{fontFamily:fonts.bold,fontSize:fontSizes.xl,color:colors.text},description:{fontFamily:fonts.regular,fontSize:fontSizes.sm,lineHeight:20,color:colors.textSecondary},
  button:{minHeight:52,borderRadius:radius.md,paddingHorizontal:spacing.lg,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},ghost:{borderWidth:1,borderColor:colors.border},disabled:{opacity:0.48},buttonText:{fontFamily:fonts.bold,fontSize:fontSizes.md},
  pill:{alignSelf:'flex-start',borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:6,flexDirection:'row',alignItems:'center',gap:6},dot:{width:7,height:7,borderRadius:4},pillText:{fontFamily:fonts.semiBold,fontSize:fontSizes.xs},
});

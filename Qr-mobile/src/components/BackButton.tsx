import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

interface BackButtonProps {
  onPress?: () => void;
  color?:   string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color = colors.primary,
}) => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={onPress ?? (() => navigation.goBack())}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={[styles.arrow, { color }]}>‹</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn:   { marginBottom: 16, alignSelf: 'flex-start', padding: 4 },
  arrow: { fontSize: 32, fontFamily: fonts.regular, lineHeight: 34 },
});
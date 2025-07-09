import React, {FC} from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity} from 'react-native';
import CustomText from './CustomText';
import {Fonts} from '../../utils/Constants';

import { StyleProp, ViewStyle } from 'react-native';

interface CustomButtonProps {
  onPress: () => void;
  title: string;
  disabled?: boolean; // Made optional with a default value
  loading?: boolean; // Made optional with a default value
  style?: StyleProp<ViewStyle>; // optional container style
}

const CustomButton: FC<CustomButtonProps> = ({
  onPress,
  title,
  disabled = false, // Default value
  loading = false, // Default value
  style = {},
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.btn,
        style, // external style last so it can override default
        {
          backgroundColor: disabled ? '#d3d3d3' : '#ff6347', // Example colors
        },
      ]}>
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <CustomText
          variant="h6"
          style={styles.text}
          fontFamily={Fonts.SemiBold}>
          {title}
        </CustomText>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    padding: 15,
    marginVertical: 15,
    width: '100%',
  },
  text: {
    color: '#ffffff',
  },
});

export default CustomButton;

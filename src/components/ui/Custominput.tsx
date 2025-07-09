import React, {FC} from 'react';
import {StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import {Colors, Fonts} from '../../utils/Constants';
import {RFValue} from 'react-native-responsive-fontsize';
import Icon from 'react-native-vector-icons/Ionicons';

interface InputProps {
  left: React.ReactNode;
  onClear?: () => void;
  right?: boolean;
}

const CustomInput: FC<InputProps & React.ComponentProps<typeof TextInput>> = ({
  onClear,
  left,
  right = true,
  ...props
}) => {
  return (
    <View style={styles.flexRow}>
      <View style={styles.icon}>{left}</View>
      <TextInput
        {...props}
        style={styles.inputContainer}
        placeholderTextColor="#ccc"
      />
      {props.value?.length !== 0 && right && (
        <TouchableOpacity onPress={onClear} style={styles.icon}>
          <Icon name="close-circle-sharp" size={RFValue(16)} color="#ccc" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 0.5,
    width: '100%',
    marginVertical: 10,
    backgroundColor: '#fff',
    shadowOffset: {width: 1, height: 1},
    shadowRadius: 2,
    shadowColor: Colors.border,
    borderColor: Colors.border,
  },
  inputContainer: {
    flex: 1,
    fontFamily: Fonts.SemiBold,
    fontSize: RFValue(12),
    paddingVertical: 14,
    paddingBottom: 15,
    height: '100%',
    color: Colors.text,
    marginLeft: 10,
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
});

export default CustomInput;

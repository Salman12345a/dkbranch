import React, {FC} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Switch} from 'react-native';
import {RFValue} from 'react-native-responsive-fontsize';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ToggleButtonProps {
  item: any;
  isIncluded: boolean;
  onToggle: (itemId: string, include: boolean) => void;
}

const ToggleButton: FC<ToggleButtonProps> = ({
  item,
  isIncluded,
  onToggle,
}) => {
  return (
    <View style={styles.container}>
      <Switch
        value={isIncluded}
        onValueChange={(value) => onToggle(item._id, value)}
        trackColor={{false: '#FF4D4F', true: '#007AFF'}}
        thumbColor="#FFFFFF"
      />
      <Text style={[styles.statusText, {color: isIncluded ? '#007AFF' : '#FF4D4F'}]}>
        {isIncluded ? 'Available' : 'Unavailable'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
  },
  statusText: {
    fontSize: RFValue(8),
    marginTop: 4,
    fontWeight: '600',
  },
});

export default ToggleButton;

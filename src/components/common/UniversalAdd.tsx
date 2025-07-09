import React, {FC} from 'react';
import {View, Text, StyleSheet, Pressable} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {RFValue} from 'react-native-responsive-fontsize';

interface UniversalAddProps {
  item: any;
  count: (itemId: string) => number;
  addItem: (item: any) => void;
  removeItem: (itemId: string) => void;
}

const Colors = {secondary: '#007AFF'}; // Placeholder—replace with your Constants
const Fonts = {SemiBold: 'Arial'}; // Placeholder—replace with your Constants

const UniversalAdd: FC<UniversalAddProps> = ({
  item,
  count,
  addItem,
  removeItem,
}) => {
  const currentCount = count(item._id);

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: currentCount === 0 ? '#fff' : Colors.secondary},
      ]}>
      {currentCount === 0 ? (
        <Pressable onPress={() => addItem(item)} style={styles.add}>
          <Text style={styles.adText}>Add</Text>
        </Pressable>
      ) : (
        <View style={styles.counterContainer}>
          <Pressable onPress={() => removeItem(item._id)}>
            <Icon name="minus" color="#fff" size={RFValue(13)} />
          </Pressable>
          <Text style={styles.text}>{currentCount}</Text>
          <Pressable onPress={() => addItem(item)}>
            <Icon name="plus" color="#fff" size={RFValue(13)} />
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.secondary,
    width: 65,
    borderRadius: 8,
  },
  add: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  adText: {
    color: Colors.secondary,
    fontFamily: Fonts.SemiBold,
    fontSize: RFValue(9),
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 6,
    justifyContent: 'space-between',
  },
  text: {
    color: '#fff',
    fontFamily: Fonts.SemiBold,
    fontSize: RFValue(8),
  },
});

export default UniversalAdd;

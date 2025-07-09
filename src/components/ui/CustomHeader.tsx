import {View, SafeAreaView, StyleSheet, Pressable} from 'react-native';
import React, {FC} from 'react';
import {Colors, Fonts} from '../../utils/Constants';
import Icon from 'react-native-vector-icons/Ionicons';
import {RFValue} from 'react-native-responsive-fontsize';
import {goBack} from '../../utils/NavigationUtils';
import CustomText from './CustomText';

const CustomHeader: FC<{title: string; search?: boolean; onBackPress?: () => void}> = ({
  title,
  search,
  onBackPress,
}) => {
  return (
    <SafeAreaView>
      <View style={styles.flexRow}>
        {/* Chevron Back Icon */}
        <Pressable onPress={onBackPress || (() => {})}>
          <Icon name="chevron-back" color={Colors.text} size={RFValue(16)} />
        </Pressable>

        {/* Title */}
        <CustomText
          style={styles.text}
          varient="h5"
          fontFamily={Fonts.SemiBold}>
          {title}
        </CustomText>

        {/* Search Icon */}
        <View>
          {search && (
            <Icon name="search" color={Colors.text} size={RFValue(16)} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    height: 60,
    borderBottomWidth: 0.6,
    backgroundColor: 'white',
    borderColor: Colors.border,
  },
  text: {
    textAlign: 'center',
    flex: 1, // Ensures the title takes up remaining space
  },
});

export default CustomHeader;

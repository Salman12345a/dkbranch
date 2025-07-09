import React from 'react';
import {View, StyleSheet} from 'react-native';
import {DrawerNavigationProp} from '@react-navigation/drawer';
import {DrawerParamList} from '../../navigation/Sidebar';
import InventoryItemDisplay from '../../features/inventory/screens/InventoryItemDisplay';

type InventoryScreenNavigationProp = DrawerNavigationProp<DrawerParamList>;

interface InventoryScreenProps {
  navigation: InventoryScreenNavigationProp;
}

const InventoryManagementScreen: React.FC<InventoryScreenProps> = ({
  navigation,
}) => {
  return (
    <View style={styles.container}>
      <InventoryItemDisplay />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default InventoryManagementScreen;

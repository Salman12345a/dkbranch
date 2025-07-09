import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {DrawerNavigationProp} from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StoreStatusToggle from './StoreStatusToggle';

interface HeaderProps {
  navigation: DrawerNavigationProp<any>;
  showStoreStatus?: boolean;
  socket?: any;
}

const Header: React.FC<HeaderProps> = ({
  navigation,
  showStoreStatus,
  socket,
}) => (
  <View style={styles.header}>
    <TouchableOpacity
      style={styles.menuButton}
      onPress={() => navigation.openDrawer()}>
      <Icon name="menu" size={30} color="#fff" />
    </TouchableOpacity>

    {showStoreStatus ? (
      <StoreStatusToggle socket={socket} />
    ) : (
      <Text style={styles.headerText}>SyncMart</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: '#340e5c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    position: 'absolute',
    left: 10,
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default Header;

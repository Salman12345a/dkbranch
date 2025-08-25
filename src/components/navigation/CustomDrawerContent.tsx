import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useStore} from '../../store/ordersStore';
import {storage} from '../../utils/storage';
import {useFocusEffect} from '@react-navigation/native';

type IconProps = {
  color: string;
  size: number;
  focused?: boolean;
};

const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const {navigation} = props;
  const userId = useStore(state => state.userId);

  const [userName, setUserName] = useState('Branch Manager');
  const [ownerName, setOwnerName] = useState('Owner Name');

  // Fetch branch info from storage when userId changes
  useEffect(() => {
    if (userId) {
      loadBranchInfo();
    }
  }, [userId]);

  // Refresh branch info when drawer is opened
  useFocusEffect(
    React.useCallback(() => {
      loadBranchInfo();
      return () => {};
    }, []),
  );

  // Function to load branch info from storage
  const loadBranchInfo = () => {
    const storedBranchId = storage.getString('branchId');
    const storedBranchName = storage.getString('branchName');
    const storedOwnerName = storage.getString('ownerName');

    if (storedOwnerName) {
      setOwnerName(storedOwnerName);
      console.log('Loaded owner name from storage:', storedOwnerName);
    }

    if (storedBranchName) {
      setUserName(storedBranchName);
      console.log('Loaded branch name from storage:', storedBranchName);
    }
  };

  // Customize which screens should be shown in the drawer
  const filteredRoutes = props.state.routes.filter(route => {
    // Temporarily disable wallet option
    if (route.name === 'Wallet') {
      return false;
    }
    // Show all other screens
    return true;
  });

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: () => {
            // Clear storage
            storage.delete('accessToken');
            storage.delete('refreshToken');
            storage.delete('userId');

            // Reset auth state in store if needed
            useStore.getState().setUserId(null);

            // Navigate to Authentication screen
            navigation.reset({
              index: 0,
              routes: [{name: 'Authentication'}],
            });
          },
        },
      ],
      {cancelable: false},
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header section with user info */}
      <View style={styles.drawerHeader}>
        <View style={styles.userInfoSection}>
          <View style={styles.profileIcon}>
            <Icon name="store" size={32} color="#340e5c" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.branchName}>{userName}</Text>
            <Text style={styles.userName}>{ownerName}</Text>
          </View>
        </View>
      </View>

      {/* Navigation section */}
      <ScrollView style={styles.drawerItemsContainer} showsVerticalScrollIndicator={false}>
        {filteredRoutes.map((route, index) => {
          const focused = index === props.state.index;
          const {title, drawerIcon} = props.descriptors[route.key].options;

          return (
            <TouchableOpacity
              key={route.key}
              style={[
                styles.customDrawerItem,
                focused && styles.customDrawerItemFocused,
              ]}
              onPress={() => navigation.navigate(route.name)}>
              <View style={styles.iconContainer}>
                {drawerIcon ? (
                  drawerIcon({
                    color: focused ? '#340e5c' : '#555',
                    size: 24,
                    focused,
                  })
                ) : (
                  <Icon
                    name={getIconName(route.name)}
                    size={24}
                    color={focused ? '#340e5c' : '#555'}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.customDrawerItemLabel,
                  focused && styles.customDrawerItemLabelFocused,
                ]}>
                {title || route.name}
              </Text>
              {focused && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer section */}
      <View style={styles.drawerFooter}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <View style={styles.iconContainer}>
            <Icon name="logout" size={22} color="#555" />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>Version 2.3.6</Text>
      </View>
    </SafeAreaView>
  );
};

// Helper function to get icon name based on route name
const getIconName = (routeName: string): string => {
  switch (routeName) {
    case 'Home':
      return 'home';
    case 'Wallet':
      return 'account-balance-wallet';
    case 'StoreManagement':
      return 'store';
    case 'OrderHistory':
      return 'history';
    case 'PrivacyPolicy':
      return 'privacy-tip';
    case 'TermsConditions':
      return 'description';
    case 'Help':
      return 'help';
    case 'Khata':
      return 'book';
    default:
      return 'circle';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  drawerHeader: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
  },
  userInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 10 : 0,
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: 16,
  },
  branchName: {
    color: 'rgba(34, 32, 32, 0.8)',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userName: {
    color: 'rgba(34, 32, 32, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  drawerItemsContainer: {
    flex: 1,
    paddingTop: 10,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customDrawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 20,
    marginVertical: 2,
    marginHorizontal: 6,
    borderRadius: 8,
    position: 'relative',
  },
  customDrawerItemFocused: {
    backgroundColor: '#f0e6ff',
  },
  customDrawerItemLabel: {
    fontSize: 15,
    color: '#555',
    marginLeft: 32,
    fontWeight: '500',
  },
  customDrawerItemLabelFocused: {
    color: '#340e5c',
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    backgroundColor: '#340e5c',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  drawerItem: {
    marginHorizontal: 6,
    marginVertical: 2,
    borderRadius: 8,
  },
  drawerItemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutText: {
    marginLeft: 32,
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default CustomDrawerContent;

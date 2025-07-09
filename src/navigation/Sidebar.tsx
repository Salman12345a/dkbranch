import React from 'react';
import {Platform} from 'react-native';
import {createDrawerNavigator} from '@react-navigation/drawer';
import HomeScreen from '../features/orders/screens/HomeScreen';
import WalletScreen from '../features/financial/screens/WalletScreen';
import StoreManagement from '../components/storemanage/SyncmartManagement';
import HelpScreen from '../features/common/screens/HelpScreen';
import OrderHistory from '../features/orders/screens/OrderHistory';
import PrivacyPolicyScreen from '../features/common/screens/PrivacyPolicyScreen';
import TermsConditionsScreen from '../features/common/screens/TermsConditionsScreen';
import DeliveryService from '../features/delivery/screens/DeliveryService';
import DisabledProductsScreen from '../features/inventory/screens/DisabledProductsScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CustomDrawerContent from '../components/navigation/CustomDrawerContent';

export type DrawerParamList = {
  Home: undefined;
  Wallet: undefined;
  StoreManagement: undefined;
  Help: undefined;
  OrderHistory: undefined;
  DeliveryService: undefined;
  DisabledProducts: undefined;
  PrivacyPolicy: undefined;
  TermsConditions: undefined;
  Authentication: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

const Sidebar: React.FC = () => {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerActiveBackgroundColor: '#f0e6ff',
        drawerActiveTintColor: '#340e5c',
        drawerInactiveTintColor: '#555',
        drawerLabelStyle: {
          marginLeft: 0,
          fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
          fontSize: 15,
          fontWeight: '500',
        },
        drawerItemStyle: {
          borderRadius: 8,
          paddingHorizontal: 5,
          marginHorizontal: 6,
          height: 50,
        },
        drawerStyle: {
          width: 280,
          backgroundColor: '#fff',
        },
      }}>
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          drawerIcon: ({color}) => <Icon name="home" size={24} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          headerShown: false,
          drawerIcon: ({color}) => (
            <Icon name="account-balance-wallet" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="StoreManagement"
        component={StoreManagement}
        options={{
          headerShown: false,
          title: 'Store Management',
          drawerIcon: ({color}) => (
            <Icon name="store" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Help"
        component={HelpScreen}
        options={{
          headerShown: false,
          drawerIcon: ({color}) => <Icon name="help" size={24} color={color} />,
        }}
      />
      <Drawer.Screen
        name="OrderHistory"
        component={OrderHistory}
        options={{
          headerShown: false,
          title: 'Order History',
          drawerIcon: ({color}) => (
            <Icon name="history" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="DisabledProducts"
        component={DisabledProductsScreen}
        options={{
          headerShown: false,
          title: 'Disabled Products',
          drawerIcon: ({color}) => (
            <Icon name="visibility-off" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="DeliveryService"
        component={DeliveryService}
        options={{
          headerShown: false,
          title: 'Delivery Service',
          drawerIcon: ({color}) => (
            <Icon name="local-shipping" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          title: 'Privacy Policy',
          headerShown: false,
          drawerIcon: ({color}) => (
            <Icon name="privacy-tip" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="TermsConditions"
        component={TermsConditionsScreen}
        options={{
          title: 'Terms & Conditions',
          headerShown: false,
          drawerIcon: ({color}) => (
            <Icon name="description" size={24} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

export default Sidebar;

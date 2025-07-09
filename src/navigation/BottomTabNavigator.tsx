import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import InventoryItemDisplay from '../features/inventory/screens/InventoryItemDisplay';
import Financial from '../features/financial/screens/FinancialSummaryScreen';
import AddProduct from '../features/inventory/screens/AddProduct';
import {RootStackParamList} from './AppNavigator';
import HomeScreen from '../features/orders/screens/HomeScreen';

const Tab = createBottomTabNavigator();

type NavigationProp = StackNavigationProp<RootStackParamList>;

const BottomTabNavigator: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({color, size}) => {
          const icons: {[key: string]: string} = {
            InventoryItemDisplay: 'home',
            HomeScreen: 'cart',
            Finance: 'cash',
            Add: 'add', // Add the missing Add tab
          };
          return (
            <Icon
              name={icons[route.name]}
              size={size || 24}
              color={color || '#7D3CFF'}
            />
          );
        },
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#7D3CFF',
        tabBarInactiveTintColor: '#666',
        headerShown: false, // Ensure no header from tabs
      })}>
      <Tab.Screen
        name="InventoryItemDisplay"
        component={InventoryItemDisplay}
        listeners={{
          tabPress: e => {
            e.preventDefault(); // Prevent default tab navigation
            navigation.navigate('Main'); // Go to Drawer Navigator
          },
        }}
      />
      <Tab.Screen
        name="HomeScreen"
        component={HomeScreen}
        listeners={{
          tabPress: e => {
            e.preventDefault();
            navigation.navigate('Order'); // Go to Order screen in stack
          },
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddProduct}
        options={{
          tabBarButton: () => (
            <TouchableOpacity
              style={styles.fabContainer}
              onPress={() => navigation.navigate('AddProduct')}
              activeOpacity={0.7}>
              <View style={styles.fabButton}>
                <Icon name="add" size={28} color="#fff" />
              </View>
            </TouchableOpacity>
          ),
        }}
      />
      <Tab.Screen
        name="Finance"
        component={Financial}
        listeners={{
          tabPress: e => {
            e.preventDefault();
            navigation.navigate('Finance');
          },
        }}
      />

    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    height: 70,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 3},
    shadowRadius: 5,
  },
  fabContainer: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#7D3CFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: {width: 0, height: 3},
    shadowRadius: 5,
  },
});

export default BottomTabNavigator;

// src/screens/DeliveryStatus.tsx
import React from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../../../navigation/AppNavigator';

type DeliveryStatusNavigationProp = StackNavigationProp<
  RootStackParamList,
  'DeliveryStatus'
>;

type DeliveryStatusRouteProp = RouteProp<RootStackParamList, 'DeliveryStatus'>;

interface DeliveryStatusProps {
  route: DeliveryStatusRouteProp;
  navigation: DeliveryStatusNavigationProp;
}

const DeliveryStatus: React.FC<DeliveryStatusProps> = ({route, navigation}) => {
  const {partner} = route.params; // { id, name, age, status, photoUrl }

  const handleResubmit = () => {
    navigation.navigate('DeliveryReRegister', {
      id: partner.id,
      name: partner.name,
    });
  };

  return (
    <View style={styles.container}>
      {/* Delivery Partner Photo */}
      <View style={styles.imageContainer}>
        {partner.photoUrl ? (
          <Image
            source={{uri: partner.photoUrl}}
            style={styles.partnerImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.noImageText}>No Photo Available</Text>
        )}
      </View>

      {/* Delivery Partner Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.detailText}>Name: {partner.name || 'N/A'}</Text>
        <Text style={styles.detailText}>Age: {partner.age || 'N/A'}</Text>
        <Text style={styles.detailText}>Status: {partner.status || 'N/A'}</Text>
        {partner.status === 'rejected' && (
          <TouchableOpacity
            style={styles.resubmitButton}
            onPress={handleResubmit}>
            <Text style={styles.resubmitButtonText}>Resubmit</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  partnerImage: {
    width: 200,
    height: 200,
    borderRadius: 100, // Circular image
    borderWidth: 2,
    borderColor: '#2c3e50',
  },
  noImageText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  detailsContainer: {
    backgroundColor: 'white',
    width: '100%',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  detailText: {
    fontSize: 18,
    color: '#2c3e50',
    marginBottom: 10,
    fontWeight: '500',
  },
  resubmitButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
  },
  resubmitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeliveryStatus;

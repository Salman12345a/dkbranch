import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {modifyDeliveryPartner} from '../../../services/api';

type ReUploadPartnerPhotoNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ReUploadPartnerPhoto'
>;

type ReUploadPartnerPhotoRouteProp = RouteProp<
  RootStackParamList,
  'ReUploadPartnerPhoto'
>;

interface ReUploadPartnerPhotoProps {
  navigation: ReUploadPartnerPhotoNavigationProp;
  route: ReUploadPartnerPhotoRouteProp;
}

// Define the Asset type for the image picker
interface Asset {
  uri: string;
  type: string;
  name?: string;
  size?: number;
}

const ReUploadPartnerPhoto: React.FC<ReUploadPartnerPhotoProps> = ({route, navigation}) => {
  const {id, formData, initialFiles} = route.params;
  const [deliveryPartnerPhoto, setDeliveryPartnerPhoto] = useState<Asset | null>(null);

  const pickFile = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: 50 * 1024 * 1024,
    });
    if (!result.didCancel && result.assets && result.assets[0]) {
      setDeliveryPartnerPhoto(result.assets[0] as Asset);
    }
  };

  const handleSubmit = async () => {
    if (!deliveryPartnerPhoto) {
      Alert.alert('Error', 'Please upload a delivery partner photo.');
      return;
    }

    try {
      const formDataToSend = {
        ...formData,
        licenseImage: {
          uri: initialFiles?.licenseImage?.uri,
          type: initialFiles?.licenseImage?.type,
          name: 'license.jpg',
        },
        rcImage: {
          uri: initialFiles?.rcImage?.uri,
          type: initialFiles?.rcImage?.type,
          name: 'rc.jpg',
        },
        aadhaarFront: {
          uri: initialFiles?.aadhaarFront?.uri,
          type: initialFiles?.aadhaarFront?.type,
          name: 'aadhaar_front.jpg',
        },
        aadhaarBack: {
          uri: initialFiles?.aadhaarBack?.uri,
          type: initialFiles?.aadhaarBack?.type,
          name: 'aadhaar_back.jpg',
        },
        deliveryPartnerPhoto: {
          uri: deliveryPartnerPhoto.uri,
          type: deliveryPartnerPhoto.type,
          name: 'delivery_partner.jpg',
        },
      };

      // Ensure required fields are present
      const dataToSend = {
        ...formDataToSend,
        age: formDataToSend.age || 0,
        gender: formDataToSend.gender || 'male',
        licenseNumber: formDataToSend.licenseNumber || '',
        rcNumber: formDataToSend.rcNumber || '',
        phone: formDataToSend.phone || 0,
      };

      await modifyDeliveryPartner(id, dataToSend);
      navigation.navigate('SuccessScreen', {
        partnerId: id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to submit: ${errorMessage}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Upload Partner Photo</Text>
      <Text style={styles.subheader}>
        Please upload a clear photo of the delivery partner
      </Text>

      <View style={styles.uploadContainer}>
        <TouchableOpacity
          style={[
            styles.uploadButton,
            deliveryPartnerPhoto ? styles.uploadedButton : null,
          ]}
          onPress={pickFile}>
          <Text style={styles.uploadText}>
            {deliveryPartnerPhoto ? 'Photo Selected ✓' : 'Select Photo'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, !deliveryPartnerPhoto && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={!deliveryPartnerPhoto}>
        <Text style={styles.buttonText}>Submit</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 25,
    backgroundColor: '#f8f9fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  subheader: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 30,
    textAlign: 'center',
  },
  uploadContainer: {
    marginBottom: 30,
  },
  uploadButton: {
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#bdc3c7',
    borderStyle: 'dashed',
  },
  uploadedButton: {
    backgroundColor: '#e8f5e9',
    borderColor: '#81c784',
  },
  uploadText: {
    color: '#7f8c8d',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReUploadPartnerPhoto;

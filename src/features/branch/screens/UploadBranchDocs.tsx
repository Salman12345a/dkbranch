import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  ToastAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {launchImageLibrary} from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageResizer from 'react-native-image-resizer';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {
  registerBranch,
  initiateBranchRegistration,
} from '../../../services/api';
import api from '../../../services/api';
import {useStore} from '../../../store/ordersStore';
import {storage} from '../../../utils/storage';

type UploadBranchDocsNavigationProp = StackNavigationProp<
  RootStackParamList,
  'UploadBranchDocs'
>;

type UploadBranchDocsRouteProp = RouteProp<
  RootStackParamList,
  'UploadBranchDocs'
>;

interface UploadBranchDocsProps {
  navigation: UploadBranchDocsNavigationProp;
  route: UploadBranchDocsRouteProp;
}

interface Asset {
  uri: string;
  type?: string;
  fileName?: string;
  size?: number;
}

interface Branch {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  name: string;
  address: {
    street: string;
    area: string;
    city: string;
    pincode: string;
  };
  location: {
    type: string;
    coordinates: [number, number];
  };
  openingTime: string;
  closingTime: string;
  ownerName: string;
  govId: string;
  phone: string;
  branchfrontImage: string;
  ownerIdProof: string;
  ownerPhoto: string;
  deliveryServiceAvailable: boolean;
  selfPickup: boolean;
  branchEmail?: string;
}

const UploadBranchDocs: React.FC<UploadBranchDocsProps> = ({
  route,
  navigation,
}) => {
  const {formData, branchId, isResubmit} = route.params || {};
  const {branches, addBranch, setUserId} = useStore();
  const branch =
    isResubmit && branchId ? branches.find(b => b.id === branchId) : null;

  const [form] = useState(() => {
    try {
      return typeof formData === 'string'
        ? JSON.parse(formData)
        : formData || {};
    } catch (e) {
      console.error('Error parsing formData:', e);
      return {};
    }
  });

  const [files, setFiles] = useState<{
    branchfrontImage: Asset | null;
    ownerIdProof: Asset | null;
    ownerPhoto: Asset | null;
  }>({
    branchfrontImage: null,
    ownerIdProof: null,
    ownerPhoto: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isResubmit && branch) {
      setFiles({
        branchfrontImage: branch.branchfrontImage
          ? {uri: branch.branchfrontImage}
          : null,
        ownerIdProof: branch.ownerIdProof ? {uri: branch.ownerIdProof} : null,
        ownerPhoto: branch.ownerPhoto ? {uri: branch.ownerPhoto} : null,
      });
    }
  }, [isResubmit, branch]);

  const compressAndResizeImage = async (imageUri: string, type: string): Promise<Asset> => {
    try {
      // Resize image to reasonable dimensions (1024px max width or height)
      const resizedImage = await ImageResizer.createResizedImage(
        imageUri,
        1024,
        1024,
        'JPEG',
        50, // Compress heavily to reduce size
        0,
        undefined,
        false,
        { mode: 'contain', onlyScaleDown: true }
      );

      if (Platform.OS === 'android') {
        ToastAndroid.show('Image compressed successfully', ToastAndroid.SHORT);
      }

      return {
        uri: resizedImage.uri,
        type: 'image/jpeg',
        fileName: resizedImage.name,
        size: resizedImage.size,
      };
    } catch (error) {
      console.error('Error compressing image:', error);
      throw error;
    }
  };

  const pickImage = useCallback(async (type: keyof typeof files) => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.5, // Lower initial quality
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (!result.didCancel && result.assets && result.assets.length > 0) {
        const originalAsset = result.assets[0];
        
        // Show loading or processing indicator
        if (Platform.OS === 'android') {
          ToastAndroid.show('Processing image...', ToastAndroid.SHORT);
        }
        
        // Further compress the image
        const compressedAsset = await compressAndResizeImage(
          originalAsset.uri || '',
          originalAsset.type || 'image/jpeg'
        );

        setFiles(prev => ({
          ...prev,
          [type]: compressedAsset,
        }));
      }
    } catch (error) {
      Alert.alert('Error', `Failed to pick or process ${type}`);
      console.error(`Error picking/processing ${type}:`, error);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!files.branchfrontImage || !files.ownerIdProof || !files.ownerPhoto) {
      Alert.alert('Error', 'Please upload all required documents');
      return;
    }

    setIsLoading(true);

    try {
      const location = JSON.parse(form.branchLocation || '{}');
      const address = JSON.parse(form.branchAddress || '{}');

      const data = {
        name: form.name || '',
        location: {
          type: 'Point',
          coordinates: [location.longitude || 0, location.latitude || 0],
        },
        address: {
          street: address.street || '',
          area: address.area || '',
          city: address.city || '',
          pincode: address.pincode || '',
        },
        branchEmail: form.branchEmail || '',
        openingTime: form.openingTime || '',
        closingTime: form.closingTime || '',
        ownerName: form.ownerName || '',
        govId: form.govId || '',
        phone: form.phone || '',
        deliveryServiceAvailable: form.deliveryServiceAvailable === 'yes',
        selfPickup: form.selfPickup === 'yes',
        branchfrontImage: files.branchfrontImage,
        ownerIdProof: files.ownerIdProof,
        ownerPhoto: files.ownerPhoto,
      };

      if (isResubmit && branchId) {
        const payload = {
          branchName: data.name,
          location: data.location,
          address: data.address,
          branchEmail: data.branchEmail,
          openingTime: data.openingTime,
          closingTime: data.closingTime,
          ownerName: data.ownerName,
          govId: data.govId,
          phone: data.phone,
          homeDelivery: data.deliveryServiceAvailable,
          selfPickup: data.selfPickup,
          branchfrontImage: branch?.branchfrontImage || '',
          ownerIdProof: branch?.ownerIdProof || '',
          ownerPhoto: branch?.ownerPhoto || '',
        };

        const response = await api.patch(`/modify/branch/${branchId}`, payload);
        const responseData = response.data;

        if (responseData) {
          const branchData: Branch = {
            id: responseData.branch._id,
            status: responseData.branch.status || 'pending',
            name: responseData.branch.name,
            phone: data.phone,
            address: data.address,
            location: {
              type: 'Point',
              coordinates: [
                data.location.coordinates[0] as number,
                data.location.coordinates[1] as number,
              ] as [number, number],
            },
            branchEmail: responseData.branch.branchEmail,
            openingTime: responseData.branch.openingTime,
            closingTime: responseData.branch.closingTime,
            ownerName: responseData.branch.ownerName,
            govId: responseData.branch.govId,
            deliveryServiceAvailable:
              responseData.branch.deliveryServiceAvailable,
            selfPickup: responseData.branch.selfPickup,
            branchfrontImage: responseData.branch.branchfrontImage,
            ownerIdProof: responseData.branch.ownerIdProof,
            ownerPhoto: responseData.branch.ownerPhoto,
          };

          addBranch(branchData);
          navigation.navigate('StatusScreen', {
            branchId: responseData.branch._id,
          });
        }
      } else {
        // New registration with OTP verification - Sequential API calls

        // Prepare form data for initiateBranchRegistration
        const initiationData = {
          branchName: data.name,
          branchLocation: JSON.stringify({
            latitude: data.location.coordinates[1],
            longitude: data.location.coordinates[0],
          }),
          branchAddress: JSON.stringify(data.address),
          branchEmail: data.branchEmail || '',
          openingTime: data.openingTime,
          closingTime: data.closingTime,
          ownerName: data.ownerName,
          govId: data.govId,
          phone: data.phone,
          homeDelivery: data.deliveryServiceAvailable.toString(),
          selfPickup: data.selfPickup.toString(),
          // Convert Asset to expected format with name property
          branchfrontImage: files.branchfrontImage
            ? {
                uri: files.branchfrontImage.uri,
                type: files.branchfrontImage.type || 'image/jpeg',
                name: files.branchfrontImage.fileName || 'branchfrontImage.jpg',
              }
            : undefined,
          ownerIdProof: files.ownerIdProof
            ? {
                uri: files.ownerIdProof.uri,
                type: files.ownerIdProof.type || 'image/jpeg',
                name: files.ownerIdProof.fileName || 'ownerIdProof.jpg',
              }
            : undefined,
          ownerPhoto: files.ownerPhoto
            ? {
                uri: files.ownerPhoto.uri,
                type: files.ownerPhoto.type || 'image/jpeg',
                name: files.ownerPhoto.fileName || 'ownerPhoto.jpg',
              }
            : undefined,
        };

        try {
          // Prepare data for initiateBranchRegistration (using the format it expects)
          console.log('Step 1: Initiating branch registration');
          const initiationResponse = await initiateBranchRegistration({
            branchName: data.name,
            branchLocation: JSON.stringify({
              latitude: data.location.coordinates[1],
              longitude: data.location.coordinates[0],
            }),
            branchAddress: JSON.stringify(data.address),
            branchEmail: data.branchEmail || '',
            openingTime: data.openingTime,
            closingTime: data.closingTime,
            ownerName: data.ownerName,
            govId: data.govId,
            phone: data.phone,
            homeDelivery: data.deliveryServiceAvailable.toString(),
            selfPickup: data.selfPickup.toString(),
            // These images are already compressed by our pickImage function
            branchfrontImage: files.branchfrontImage ? {
              uri: files.branchfrontImage.uri,
              type: 'image/jpeg',
              name: 'branchfrontImage.jpg',
            } : undefined,
            ownerIdProof: files.ownerIdProof ? {
              uri: files.ownerIdProof.uri,
              type: 'image/jpeg',
              name: 'ownerIdProof.jpg',
            } : undefined,
            ownerPhoto: files.ownerPhoto ? {
              uri: files.ownerPhoto.uri,
              type: 'image/jpeg',
              name: 'ownerPhoto.jpg',
            } : undefined,
          });

          if (!initiationResponse) {
            throw new Error('Branch registration initiation failed');
          }

          console.log('Branch initiation successful:', initiationResponse);

          // Use initiation response session & timing values
          
          // The API returns these fields nested under a second `data` object.
      // Fallback to `initiationResponse.data` in case backend shape changes.
      const { sessionId, validityPeriod, retryAfter } =
        initiationResponse?.data?.data ?? initiationResponse?.data ?? {};

          

          

          if (validityPeriod) {
            storage.set('otpValidityPeriod', parseInt(validityPeriod) || 600);
          }
          if (retryAfter) {
            storage.set('otpRetryAfter', parseInt(retryAfter) || 60);
          }
          if (sessionId) {
            storage.set('registrationSessionId', sessionId);
          }

          // Store form data for later use
          storage.set('branchFormData', JSON.stringify(data));
          storage.set('branchPhone', data.phone);

          // Navigate to OTP verification screen
          navigation.navigate('OTPVerification', {
            phone: data.phone,
            formData: JSON.stringify(data),
            sessionId,
            validityPeriod,
            retryAfter,
            branchId: undefined,
            isResubmit: false,
          } as any);
        } catch (apiError: any) {
          console.error('API Error:', apiError);
          const errorMessage =
            apiError.message || 'Registration process failed';
          Alert.alert('Error', errorMessage);
          throw apiError; // Re-throw to be caught by outer catch block
        }
      }
    } catch (error: any) {
      const errorMessage =
        error.message || (isResubmit ? 'Resubmission failed' : 'Upload failed');
      Alert.alert('Error', errorMessage);
      console.error(
        isResubmit ? 'Resubmission failed:' : 'Upload failed:',
        error.response?.data || error,
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    files,
    form,
    isResubmit,
    branchId,
    branch,
    addBranch,
    setUserId,
    navigation,
  ]);

  // Render preview if image exists
  const renderImagePreview = (type: keyof typeof files) => {
    if (files[type]?.uri) {
      return (
        <View style={styles.previewContainer}>
          <Image source={{uri: files[type]?.uri}} style={styles.imagePreview} />
          <Text style={styles.imageUploaded}>
            {type === 'branchfrontImage'
              ? 'Branch Front'
              : type === 'ownerIdProof'
              ? 'ID Proof'
              : 'Owner Photo'}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Upload Branch Documents</Text>
      <Text style={styles.subheader}>
        Please upload the required documents for branch registration
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Branch Front Image *</Text>
        <View style={styles.uploadSection}>
          {renderImagePreview('branchfrontImage')}
          <TouchableOpacity
            style={[
              styles.uploadIconContainer,
              isLoading && styles.buttonDisabled,
              files.branchfrontImage && styles.uploadCompleted,
            ]}
            onPress={() => pickImage('branchfrontImage')}
            disabled={isLoading}>
            <Icon
              name={files.branchfrontImage ? 'check-circle' : 'add-a-photo'}
              size={32}
              color={files.branchfrontImage ? '#2ecc71' : '#3498db'}
            />
            <Text style={styles.uploadText}>
              {files.branchfrontImage ? 'Change Image' : 'Tap to Upload'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Owner ID Proof *</Text>
        <View style={styles.uploadSection}>
          {renderImagePreview('ownerIdProof')}
          <TouchableOpacity
            style={[
              styles.uploadIconContainer,
              isLoading && styles.buttonDisabled,
              files.ownerIdProof && styles.uploadCompleted,
            ]}
            onPress={() => pickImage('ownerIdProof')}
            disabled={isLoading}>
            <Icon
              name={files.ownerIdProof ? 'check-circle' : 'badge'}
              size={32}
              color={files.ownerIdProof ? '#2ecc71' : '#3498db'}
            />
            <Text style={styles.uploadText}>
              {files.ownerIdProof ? 'Change Image' : 'Tap to Upload'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Owner Photo *</Text>
        <View style={styles.uploadSection}>
          {renderImagePreview('ownerPhoto')}
          <TouchableOpacity
            style={[
              styles.uploadIconContainer,
              isLoading && styles.buttonDisabled,
              files.ownerPhoto && styles.uploadCompleted,
            ]}
            onPress={() => pickImage('ownerPhoto')}
            disabled={isLoading}>
            <Icon
              name={files.ownerPhoto ? 'check-circle' : 'person-add'}
              size={32}
              color={files.ownerPhoto ? '#2ecc71' : '#3498db'}
            />
            <Text style={styles.uploadText}>
              {files.ownerPhoto ? 'Change Image' : 'Tap to Upload'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isResubmit && (
        <Text style={styles.warning}>
          Note: File updates are not supported in resubmission yet. Only text
          fields will be updated.
        </Text>
      )}

      <TouchableOpacity
        style={[styles.submitButton, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Text style={styles.submitButtonText}>
              {isResubmit ? 'Resubmit' : 'Submit'}
            </Text>
            <Icon name="arrow-forward" size={20} color="white" />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subheader: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 30,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 12,
    fontWeight: '500',
  },
  uploadSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadIconContainer: {
    flex: 1,
    height: 120,
    backgroundColor: '#ecf0f1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dcdde1',
    borderStyle: 'dashed',
  },
  uploadCompleted: {
    borderColor: '#2ecc71',
    borderStyle: 'solid',
    backgroundColor: '#eafaf1',
  },
  uploadText: {
    marginTop: 8,
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  previewContainer: {
    width: '45%',
    marginRight: 10,
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  imageUploaded: {
    textAlign: 'center',
    marginTop: 5,
    fontSize: 12,
    color: '#2c3e50',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: '#95a5a6',
    opacity: 0.7,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  warning: {
    fontSize: 12,
    color: '#e74c3c',
    marginBottom: 20,
    textAlign: 'center',
  },
});

export default UploadBranchDocs;

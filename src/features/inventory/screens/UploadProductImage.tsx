import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  Switch,
  ToastAndroid,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import CustomHeader from '../../../components/ui/CustomHeader';
import CustomButton from '../../../components/ui/CustomButton';
import { inventoryService } from '../../../services/inventoryService';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import ImageResizer from 'react-native-image-resizer';
import DeviceInfo from 'react-native-device-info';

import { removeBackground } from 'react-native-background-remover';


type UploadProductImageRouteProp = RouteProp<RootStackParamList, 'UploadProductImage'>;

const UploadProductImage = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<UploadProductImageRouteProp>();
  const { productId, uploadUrl, key, branchId } = route.params;
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [removeBg, setRemoveBg] = useState(false);
  const [processingBg, setProcessingBg] = useState(false);
  
  // Resize/crop the selected image to a 500x500px square before storing it
  const cropImageToSquare = async (uri: string): Promise<void> => {
    try {
      const resizedImage = await ImageResizer.createResizedImage(
        uri,
        500,
        500,
        'PNG', // Use PNG to preserve transparency
        100,
        0,
        undefined,
        false,
        { mode: 'cover' }
      );
      setImageUri(resizedImage.uri);
      // If your inventoryService requires JPEG, uncomment the following:
      /*
      const jpegImage = await ImageResizer.createResizedImage(
        resizedImage.uri,
        500,
        500,
        'JPEG',
        100,
        0,
        undefined,
        false,
        { mode: 'cover' }
      );
      setImageUri(jpegImage.uri);
      */
    } catch (err) {
      console.error('Error resizing image:', err);
      setImageUri(uri); // Fallback to original URI
    }
  };
  
  // Remove background and return processed URI
  const runBackgroundRemoval = async (uri: string): Promise<string> => {
    try {
      setProcessingBg(true);
      
      // Check if running on iOS simulator
      if (Platform.OS === 'ios') {
        const isSimulator = await DeviceInfo.isEmulator();
        if (isSimulator) {
          throw new Error('Background removal not supported on iOS simulator. Use a physical device.');
        }
      }
      
      const processedUri = await removeBackground(uri);
      return processedUri;
    } catch (err: any) {
      console.warn('Background removal failed:', err.message);
      const errorMessage = err.message?.includes('simulator')
        ? 'Background removal not supported on iOS simulator. Please use a physical device.'
        : 'Background removal failed – using original image';
      
      if (Platform.OS === 'android') {
        ToastAndroid.show(errorMessage, ToastAndroid.SHORT);
      } else {
        Alert.alert('Notice', errorMessage);
      }
      return uri;
    } finally {
      setProcessingBg(false);
    }
  };

  // Pipeline to run after selecting/capturing an image
  const processSelectedImage = async (uri: string): Promise<void> => {
    try {
      setOriginalImageUri(uri); // Store original image
      let finalUri = uri;
      
      if (removeBg) {
        finalUri = await runBackgroundRemoval(uri);
      }
      
      await cropImageToSquare(finalUri);
    } catch (err) {
      console.error('Error processing image:', err);
      setError('Failed to process image');
    }
  };
  
  // Handle image selection
  const handleSelectImage = (): void => {
    Alert.alert(
      'Select Image',
      'Choose an option to upload product image',
      [
        {
          text: 'Camera',
          onPress: () => openCamera(),
        },
        {
          text: 'Gallery',
          onPress: () => openGallery(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };
  
  // Request camera permission for Android
  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    
    try {
      // For Android 13+ (API level 33+)
      if (Platform.Version >= 33) {
        const cameraPermission = await request(PERMISSIONS.ANDROID.CAMERA);
        return cameraPermission === RESULTS.GRANTED;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs camera permission to take product photos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.error('Error requesting camera permission:', err);
      return false;
    }
  };

  // Open camera
  const openCamera = async (): Promise<void> => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to take photos. Please enable it in your device settings.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    launchCamera(
      {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
        includeBase64: false,
      },
      (response: ImagePickerResponse) => {
        if (response.didCancel) {
          console.log('User cancelled camera');
        } else if (response.errorCode) {
          console.log('Camera Error:', response.errorMessage);
          Alert.alert('Error', response.errorMessage || 'Failed to open camera');
        } else if (response.assets && response.assets[0]?.uri) {
          processSelectedImage(response.assets[0].uri);
        }
      }
    );
  };
  
  // Open gallery
  const openGallery = (): void => {
    launchImageLibrary(
      {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
      },
      (response: ImagePickerResponse) => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorCode) {
          console.log('ImagePicker Error:', response.errorMessage);
          Alert.alert('Error', response.errorMessage || 'Failed to open gallery');
        } else if (response.assets && response.assets[0]?.uri) {
          processSelectedImage(response.assets[0].uri);
        }
      }
    );
  };
  
  // Revert to original image
  const handleRevert = async (): Promise<void> => {
    if (originalImageUri) {
      await cropImageToSquare(originalImageUri);
    }
  };
  
  // Handle submit
  const handleSubmit = async (): Promise<void> => {
    if (!imageUri) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await inventoryService.uploadImageToPresignedUrl(uploadUrl, imageUri);
      await inventoryService.updateProductImageUrl(productId, key);
      
      Alert.alert(
        'Success',
        'Product created successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('ProductsScreen', {
                categoryId: route.params.categoryId,
                categoryName: route.params.categoryName,
                isDefault: false,
                refresh: true,
                refreshTimestamp: Date.now(),
              });
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to upload image';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <CustomHeader title="Upload Product Image" />
      
      <View style={styles.content}>
        <Text style={styles.title}>Upload Product Image</Text>
        <Text style={styles.subtitle}>
          Please upload a clear image of your product
        </Text>

        {/*<View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Remove background</Text>
          <Switch
            value={removeBg}
            onValueChange={setRemoveBg}
            disabled={loading || processingBg}
          />
        </View>*/}
        
        <TouchableOpacity 
          style={styles.imageContainer} 
          onPress={handleSelectImage}
          disabled={loading || processingBg}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} />
          ) : (
            <View style={styles.placeholderContainer}>
              <Icon name="add-photo-alternate" size={50} color="#999" />
              <Text style={styles.placeholderText}>Tap to select image</Text>
            </View>
          )}
        </TouchableOpacity>
        
        {originalImageUri && imageUri !== originalImageUri && (
          <CustomButton
            title="Revert to Original"
            onPress={handleRevert}
            disabled={loading || processingBg}
            style={styles.revertButton}
          />
        )}
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <View style={styles.buttonContainer}>
          <CustomButton
            title={processingBg ? "Processing..." : "Submit"}
            onPress={handleSubmit}
            disabled={!imageUri || loading || processingBg}
          />
          {(loading || processingBg) && (
            <ActivityIndicator style={styles.loader} size="small" color="#007AFF" />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 250,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
  },
  loader: {
    marginLeft: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
  revertButton: {
    marginBottom: 16,
    width: '100%',
  },
});

export default UploadProductImage;
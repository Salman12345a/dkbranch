import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import CustomHeader from '../../../components/ui/CustomHeader';
import CustomButton from '../../../components/ui/CustomButton';
import { inventoryService } from '../../../services/inventoryService';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import ImageResizer from 'react-native-image-resizer';

type UploadProductImageRouteProp = RouteProp<RootStackParamList, 'UploadProductImage'>;

const UploadProductImage = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<UploadProductImageRouteProp>();
  const { productId, uploadUrl, key, branchId } = route.params;
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Resize/crop the selected image to a 500x500px square before we store it.
  const cropImageToSquare = async (uri: string) => {
    try {
      const resizedImage = await ImageResizer.createResizedImage(
        uri,
        500,
        500,
        'JPEG',
        100,
        0,
        undefined,
        false,
        { mode: 'cover' } // `cover` keeps the aspect ratio while ensuring exact size.
      );
      setImageUri(resizedImage.uri);
    } catch (err) {
      console.error('Error resizing image:', err);
      // Fallback to the original image if resizing fails.
      setImageUri(uri);
    }
  };
  
  // Handle image selection
  const handleSelectImage = () => {
    Alert.alert(
      'Select Image',
      'Choose an option to upload product image',
      [
        {
          text: 'Camera',
          onPress: async () => await openCamera(),
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
  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    
    try {
      // For Android 13+
      if (Platform.Version >= 33) {
        const cameraPermission = await request(PERMISSIONS.ANDROID.CAMERA);
        return cameraPermission === RESULTS.GRANTED;
      } 
      // For older Android versions
      else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "Camera Permission",
            message: "App needs camera permission to take product photos",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
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
  const openCamera = async () => {
    // Request camera permission before proceeding
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
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
        includeBase64: false,
      },
      (response) => {
        if (response.didCancel) {
          console.log('User cancelled camera');
        } else if (response.errorCode) {
          console.log('Camera Error:', response.errorMessage);
          Alert.alert('Error', response.errorMessage || 'Failed to open camera');
        } else if (response.assets && response.assets[0].uri) {
          cropImageToSquare(response.assets[0].uri);
        }
      }
    );
  };
  
  // Open gallery
  const openGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
      },
      (response) => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorCode) {
          console.log('ImagePicker Error:', response.errorMessage);
          Alert.alert('Error', response.errorMessage || 'Failed to open gallery');
        } else if (response.assets && response.assets[0].uri) {
          cropImageToSquare(response.assets[0].uri);
        }
      }
    );
  };
  
  // Handle submit
  const handleSubmit = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Step 1: Upload image to presigned URL
      await inventoryService.uploadImageToPresignedUrl(uploadUrl, imageUri);
      
      // Step 2: Update product with image URL
      await inventoryService.updateProductImageUrl(productId, key);
      
      // Show success message
      Alert.alert(
        'Success',
        'Product created successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // First navigate back to ProductsScreen with refresh flag
              navigation.navigate('ProductsScreen', {
                categoryId: route.params.categoryId,
                categoryName: route.params.categoryName,
                isDefault: false, // Custom products are in the custom tab
                refresh: true,
                refreshTimestamp: Date.now()
              });
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
      Alert.alert('Error', err.message || 'Failed to upload image');
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
        
        <TouchableOpacity 
          style={styles.imageContainer} 
          onPress={handleSelectImage}
          disabled={loading}
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
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <View style={styles.buttonContainer}>
          <CustomButton
            title="Submit"
            onPress={handleSubmit}
            disabled={!imageUri || loading}
          />
          {loading && <ActivityIndicator style={styles.loader} size="small" color="#007AFF" />}
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
  loader: {
    marginLeft: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default UploadProductImage;

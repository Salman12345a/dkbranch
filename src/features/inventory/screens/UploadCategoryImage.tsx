import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Alert, Platform, ToastAndroid, PermissionsAndroid } from 'react-native';
import CustomButton from '../../../components/ui/CustomButton';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';
import { PERMISSIONS, request, RESULTS, check } from 'react-native-permissions';
import ImageCropPicker from 'react-native-image-crop-picker';
import api from '../../../services/api';

const UploadCategoryImage = () => {
  const route = useRoute();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { uploadUrl, key, categoryId, branchId } = route.params as any;
  const [image, setImage] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    // Check permissions when component mounts
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      if (Platform.OS === 'ios') {
        setHasPermission(true);
        return;
      }
      
      // For Android
      if (Platform.Version < 33) {
        const granted = await check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
        setHasPermission(granted === RESULTS.GRANTED);
      } else {
        const granted = await check(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        setHasPermission(granted === RESULTS.GRANTED);
      }
    } catch (err) {
      console.error('Permission check error:', err);
      setHasPermission(false);
    }
  };

  const requestStoragePermission = async () => {
    try {
      if (Platform.OS !== 'android') {
        setHasPermission(true);
        return true;
      }
      
      let granted;
      if (Platform.Version < 33) {
        try {
          granted = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
        } catch (error) {
          // Fallback to old PermissionsAndroid API if needed
          console.log('Falling back to PermissionsAndroid API');
          granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            {
              title: "Storage Permission Required",
              message: "App needs access to your storage to select images",
              buttonNeutral: "Ask Me Later",
              buttonNegative: "Cancel",
              buttonPositive: "OK"
            }
          );
        }
      } else {
        try {
          granted = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        } catch (error) {
          console.log('Falling back to PermissionsAndroid API for Android 13+');
          granted = await PermissionsAndroid.request(
            'android.permission.READ_MEDIA_IMAGES',
            {
              title: "Photos Permission Required",
              message: "App needs access to your photos to select images",
              buttonNeutral: "Ask Me Later",
              buttonNegative: "Cancel",
              buttonPositive: "OK"
            }
          );
        }
      }
      
      const isGranted = 
        granted === RESULTS.GRANTED || 
        granted === PermissionsAndroid.RESULTS.GRANTED;
        
      setHasPermission(isGranted);
      return isGranted;
    } catch (err) {
      console.error('Permission request error:', err);
      setHasPermission(false);
      return false;
    }
  };

  const pickImage = async () => {
    try {
      setError('');
      
      // Request permission if not already granted
      if (!hasPermission) {
        const permissionGranted = await requestStoragePermission();
        if (!permissionGranted) {
          setError('Storage permission is required to pick an image.');
          if (Platform.OS === 'android') {
            ToastAndroid.show('Storage permission denied', ToastAndroid.SHORT);
          }
          return;
        }
      }
      
      // Use Promise-based approach instead of callback
      const result = await new Promise<ImagePickerResponse>((resolve) => {
        launchImageLibrary({
          mediaType: 'photo',
          quality: 0.7, // Reduce quality to avoid memory issues
          maxWidth: 800,  // Limit dimensions to avoid memory issues
          maxHeight: 800,
          includeBase64: false, // Don't include base64 data to save memory
        }, (response) => {
          resolve(response);
        });
      });
      
      // Handle response
      if (result.didCancel) {
        console.log('User cancelled image picker');
        return;
      }
      
      if (result.errorCode) {
        console.error('ImagePicker Error: ', result.errorMessage);
        setError(result.errorMessage || 'Image picker error');
        if (Platform.OS === 'android') {
          ToastAndroid.show('Error selecting image', ToastAndroid.SHORT);
        }
        return;
      }
      
      if (result.assets && result.assets.length > 0) {
        console.log('Image selected:', result.assets[0].uri);
        setImage(result.assets[0]);
      }
    } catch (err: any) {
      console.error('Unexpected error in image picker:', err);
      setError('Unexpected error selecting image: ' + (err?.message || 'Unknown error'));
      if (Platform.OS === 'android') {
        ToastAndroid.show('Error selecting image', ToastAndroid.SHORT);
      }
    }
  };

  // Process the image - convert to JPG and compress
  const processImage = async (imageUri: string): Promise<{ uri: string; type: string; name: string }> => {
    try {
      console.log('Processing image: converting to JPG and compressing');
      
      // Process the image using correct ImageCropPicker API
      const processedImage = await ImageCropPicker.openCropper({
        path: imageUri,
        width: 800,                 // Target width
        height: 800,                // Target height
        compressImageQuality: 0.7,  // Compression quality (0-1)
        compressImageMaxWidth: 800, // Max width for compression
        compressImageMaxHeight: 800,// Max height for compression
        mediaType: 'photo',
        cropperCircleOverlay: false,
        freeStyleCropEnabled: true,
        includeBase64: false,       // Don't include base64 to save memory
        includeExif: false,         // Don't include EXIF data
        forceJpg: true              // Force JPG conversion
      });
      
      console.log('Image processed successfully:', processedImage.path);
      return {
        uri: processedImage.path,
        type: 'image/jpeg',         // Force JPEG mime type
        name: 'image.jpg',          // Force .jpg extension
      };
    } catch (err: any) {
      console.error('Image processing error:', err);
      
      // If cropper fails, try direct processing without UI
      try {
        console.log('Attempting direct image processing...');
        // Use the lower-level API to manipulate the image
        const fileName = imageUri.split('/').pop() || 'image.jpg';
        const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
        
        if (extension !== 'jpg' && extension !== 'jpeg') {
          console.log('Converting non-JPG image to JPG');
        }
        
        return {
          uri: imageUri,           // Use original URI
          type: 'image/jpeg',      // Force JPEG content type regardless of source
          name: 'image.jpg',       // Force JPG extension
        };
      } catch (fallbackErr) {
        console.error('All image processing methods failed:', fallbackErr);
        
        // Last resort: use original image but with JPG type for uploading
        return {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'image.jpg',
        };
      }
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!image) {
      setError('Please select an image first.');
      return;
    }
    setLoading(true);
    try {
      // Validate image data
      if (!image.uri) {
        throw new Error('Invalid image data');
      }
      
      console.log('Starting image processing and upload to S3');
      
      // Process the image - convert to JPG and compress
      const processedFile = await processImage(image.uri);
      console.log('Image processed successfully, ready for upload');
      
      // Get the processed image as a blob safely
      let imageBlob;
      try {
        const imageResponse = await fetch(processedFile.uri);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch processed image: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        imageBlob = await imageResponse.blob();
      } catch (fetchErr: any) {
        console.error('Error fetching processed image blob:', fetchErr);
        throw new Error(`Error preparing processed image: ${fetchErr.message}`);
      }
      
      // Upload to S3
      try {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'image/jpeg', // Always use JPEG content type
          },
          body: imageBlob,
        });
        
        console.log('S3 upload response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to upload image to S3: ${response.status} ${response.statusText}`);
        }
      } catch (uploadErr: any) {
        console.error('S3 upload error:', uploadErr);
        throw new Error(`Upload failed: ${uploadErr.message}`);
      }
      
      // 2. Update backend with image URL
      try {
        console.log('Updating backend with image key:', key);
        const updateRes = await api.post(`/branch/categories/${categoryId}/image-url`, {
          key,
        });
        
        if (!updateRes.data) {
          throw new Error('Backend returned empty response');
        }
        if (!updateRes.data.imageUrl) {
          throw new Error('Backend did not return image URL');
        }
        
        console.log('Category updated with image URL:', updateRes.data.imageUrl);
      } catch (apiErr: any) {
        console.error('API error:', apiErr);
        throw new Error(`Backend update failed: ${apiErr.message}`);
      }
      
      // Success
      if (Platform.OS === 'android') {
        ToastAndroid.show('Image uploaded successfully', ToastAndroid.SHORT);
      }
      Alert.alert('Success', 'Category image uploaded successfully!', [
        { text: 'OK', onPress: () => {
          // Navigate back with refresh parameter
          navigation.navigate('InventoryItemDisplay', { refresh: true, refreshTimestamp: Date.now() });
        }},
      ]);
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err?.message || 'Something went wrong');
      if (Platform.OS === 'android') {
        ToastAndroid.show('Upload failed', ToastAndroid.SHORT);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Category Image</Text>
      {image ? (
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: image.uri }} 
            style={styles.imagePreview} 
            resizeMode="cover"
          />
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text>No image selected</Text>
          {hasPermission === false && (
            <Text style={styles.permissionText}>Storage permission required</Text>
          )}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Uploading image...</Text>
        </View>
      ) : (
        <View style={styles.buttonContainer}>
          <CustomButton 
            title="Pick Image" 
            onPress={pickImage} 
            style={styles.button}
          />
          <CustomButton 
            title="Submit" 
            onPress={handleSubmit} 
            disabled={!image}
            style={[styles.button, !image && styles.disabledButton]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  imageContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
  },
  permissionText: {
    color: 'red',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  error: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
    padding: 5,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    marginVertical: 8,
    width: '80%',
  },
  disabledButton: {
    opacity: 0.7,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#007AFF',
  },
});

export default UploadCategoryImage; 
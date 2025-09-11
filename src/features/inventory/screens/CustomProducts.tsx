import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { storage } from '../../../utils/storage';
import CustomHeader from '../../../components/ui/CustomHeader';
import CustomButton from '../../../components/ui/CustomButton';
import { inventoryService, createCustomProduct } from '../../../services/inventoryService';
import { launchImageLibrary, launchCamera, Asset } from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import { PERMISSIONS, request, RESULTS, check } from 'react-native-permissions';

type CustomProductsRouteProp = RouteProp<RootStackParamList, 'CustomProducts'>;

const CustomProducts = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<CustomProductsRouteProp>();
  const { categoryId, categoryName, isDefault, defaultCategoryId } = route.params;
  
  // Get branchId from storage
  const branchId = storage.getString('userId') || '';
  
  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [description, setDescription] = useState('');
  const [isPacket, setIsPacket] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<Asset | null>(null);

  // Resize/compress selected image
  const compressImage = async (asset: Asset): Promise<Asset> => {
    if (!asset.uri) return asset;
    try {
      const resized = await ImageResizer.createResizedImage(
        asset.uri,
        1024,
        1024,
        'JPEG',
        70,
        0,
        undefined,
        false,
        { mode: 'contain', onlyScaleDown: true }
      );
      return {
        ...asset,
        uri: resized.uri,
        type: 'image/jpeg',
        fileName: resized.name || asset.fileName || 'image.jpg',
        fileSize: resized.size,
      } as Asset;
    } catch (e) {
      console.warn('Image compression failed, using original image', e);
      return asset;
    }
  };

  const pickImage = () => {
    Alert.alert(
      'Select Image',
      'Choose an option to add product image',
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

  const requestCameraPermission = async () => {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;
      
      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  };

  const openCamera = async () => {
    try {
      // Check and request camera permission
      const hasPermission = await requestCameraPermission();
      
      if (!hasPermission) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take photos for your products.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Settings', 
              onPress: () => {
                // On Android, user needs to manually enable in settings
                Alert.alert(
                  'Enable Camera Permission',
                  'Go to Settings > Apps > SyncMart > Permissions > Camera and enable it.',
                  [{ text: 'OK' }]
                );
              }
            }
          ]
        );
        return;
      }

      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.5,
        saveToPhotos: true,
      });
      
      if (!result.didCancel && result.assets && result.assets.length > 0) {
        const compressed = await compressImage(result.assets[0]);
        setImage(compressed);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open camera');
      console.error('Camera error:', err);
    }
  };

  const openGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.5,
      });
      if (!result.didCancel && result.assets && result.assets.length > 0) {
        const compressed = await compressImage(result.assets[0]);
        setImage(compressed);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image from gallery');
      console.error('Gallery picker error:', err);
    }
  };
  
  // Unit options for packaged products
  const packetUnitOptions = [
    { label: 'Kilogram (kg)', value: 'kg' },
    { label: 'Gram (g)', value: 'g' },
    { label: 'Liter (L)', value: 'L' },
    { label: 'Milliliter (ml)', value: 'ml' },
    { label: 'piece (pc)', value: 'pc' }
  ];

  // Unit options for non-packaged products (only kg and litre)
  const nonPacketUnitOptions = [
    { label: 'Kilogram (kg)', value: 'kg' },
    { label: 'Liter (L)', value: 'L' }
  ];

  // Get the appropriate unit options based on isPacket flag
  const unitOptions = isPacket ? packetUnitOptions : nonPacketUnitOptions;
  
  // Validation
  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Product name is required');
      return false;
    }
    
    if (!price.trim() || isNaN(Number(price))) {
      Alert.alert('Error', 'Valid price is required');
      return false;
    }
    
    if (discountPrice.trim() && isNaN(Number(discountPrice))) {
      Alert.alert('Error', 'Discount price must be a valid number');
      return false;
    }
    
    if (!quantity.trim() || isNaN(Number(quantity))) {
      Alert.alert('Error', 'Quantity is required and must be a valid number');
      return false;
    }
    
    return true;
  };
  
  // Handle next button press
  const handleSubmit = async () => {
    setError('');
    if (!name.trim() || !price.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('price', price.trim());
    formData.append('discountPrice', discountPrice.trim() || '0');
    formData.append('quantity', quantity.trim() || '1');
    formData.append('unit', unit);
    formData.append('description', description.trim());
    formData.append('isPacket', String(isPacket));
    formData.append('categoryId', categoryId);
    formData.append('branchId', branchId);

    if (image && image.uri) {
      formData.append('productImage', {
        uri: image.uri,
        name: image.fileName || 'image.jpg',
        type: image.type || 'image/jpeg',
      } as any);
    }

    try {
      await createCustomProduct(branchId, formData);
      Alert.alert('Success', 'Product created successfully!', [
        {
          text: 'OK',
          onPress: () =>
            navigation.navigate('ProductsScreen', {
              categoryId,
              categoryName,
              isDefault: isDefault || false,
              defaultCategoryId,
              refresh: true,
              refreshTimestamp: new Date().getTime(),
            }),
        },
      ]);
    } catch (err: any) {
      console.error('Failed to create product:', err);
      setError(err?.response?.data?.message || 'Failed to create product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <CustomHeader title={`New in ${categoryName}`} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Product Name"
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="Price"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          <View style={styles.packetContainer}>
            <Text style={styles.packetLabel}>Is this a packaged item?</Text>
            <View style={styles.radioContainer}>
              <TouchableOpacity style={styles.radioOption} onPress={() => setIsPacket(true)}>
                <View style={styles.radioCircle}>
                  {isPacket && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.radioOption} onPress={() => {
                setIsPacket(false);
                if (unit !== 'kg' && unit !== 'L') {
                  setUnit('kg');
                }
              }}>
                <View style={styles.radioCircle}>
                  {!isPacket && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Quantity"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={unit}
              onValueChange={(itemValue) => setUnit(itemValue)}
              style={styles.picker}
            >
              {unitOptions.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </View>
          
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description (Optional)"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image && image.uri ? (
              <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={40} color="#888" />
                <Text style={styles.imagePickerText}>Add Product Image</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
          ) : (
            <CustomButton
              title="Create Product"
              onPress={handleSubmit}
              disabled={!name || !price || !quantity}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  formContainer: {
    width: '100%',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  pickerContainer: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    marginBottom: 16,
  },
  picker: {
    width: '100%',
  },
  packetContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  packetLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  radioContainer: {
    flexDirection: 'row',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  radioCircle: {
    height: 22,
    width: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioDot: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  radioText: {
    fontSize: 16,
    color: '#333',
  },
  imagePicker: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginBottom: 24,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePickerText: {
    marginTop: 8,
    color: '#888',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default CustomProducts;

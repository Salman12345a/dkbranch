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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { storage } from '../../../utils/storage';
import CustomHeader from '../../../components/ui/CustomHeader';
import CustomButton from '../../../components/ui/CustomButton';
import { inventoryService, CustomProductData } from '../../../services/inventoryService';
import { Picker } from '@react-native-picker/picker';

type CustomProductsRouteProp = RouteProp<RootStackParamList, 'CustomProducts'>;

const CustomProducts = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<CustomProductsRouteProp>();
  const { categoryId, categoryName } = route.params;
  
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
  const handleNext = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // First try with the original name
      // Prepare product data
      const productData: CustomProductData = {
        name, // Use the original name first
        price: Number(price),
        categoryId,
        branchId,
        isPacket,
        description: description.trim() || 'Test product description',
      };
      
      // Add optional fields if provided
      if (discountPrice.trim()) {
        productData.discountPrice = Number(discountPrice);
      } else {
        // Default discount price to 90 if not provided (as shown in the example)
        productData.discountPrice = 90;
      }
      
      if (quantity.trim()) {
        productData.quantity = Number(quantity);
      } else {
        // Default quantity to 10 if not provided (as shown in the example)
        productData.quantity = 10;
      }
      
      if (unit) {
        productData.unit = unit;
      }
      
      console.log('Sending product data:', JSON.stringify(productData));
      
      try {
        // First attempt with original name
        const response = await inventoryService.createCustomProduct(productData);
        
        // Get product ID from response
        const productId = response._id;
        
        // Get image upload URL
        const uploadUrlResponse = await inventoryService.getProductImageUploadUrl(branchId, productId);
        
        // Navigate to upload image screen
        navigation.navigate('UploadProductImage', {
          productId,
          uploadUrl: uploadUrlResponse.uploadUrl,
          key: uploadUrlResponse.key,
          branchId,
          categoryId,
          categoryName
        });
      } catch (err: any) {
        // Check if the error is about duplicate product name
        if (err.response?.data?.message?.includes('product with this name already exists')) {
          console.log('Product name already exists, trying with unique name');
          
          // Generate a unique timestamp suffix for the product name
          const timestamp = new Date().getTime();
          const uniqueProductName = `${name}_${timestamp.toString().slice(-6)}`;
          
          // Update product data with unique name
          productData.name = uniqueProductName;
          
          console.log('Retrying with unique name:', uniqueProductName);
          
          // Try again with the unique name
          const response = await inventoryService.createCustomProduct(productData);
          
          // Get product ID from response
          const productId = response._id;
          
          // Get image upload URL
          const uploadUrlResponse = await inventoryService.getProductImageUploadUrl(branchId, productId);
          
          // Navigate to upload image screen
          navigation.navigate('UploadProductImage', {
            productId,
            uploadUrl: uploadUrlResponse.uploadUrl,
            key: uploadUrlResponse.key,
            branchId,
            categoryId,
            categoryName
          });
        } else {
          // If it's a different error, rethrow it
          throw err;
        }
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
      Alert.alert('Error', err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <CustomHeader title={`Create Custom Product`} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <Text style={styles.categoryName}>Category: {categoryName}</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Name*</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter product name"
              placeholderTextColor="#999"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Price*</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="Enter price"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
          

          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isPacket ? 'Packet Quantity*' : 'Quantity*'}</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={isPacket ? 'Enter packet quantity' : 'Enter quantity'}
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unit*</Text>
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
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Is Packet</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[styles.radioButton, isPacket && styles.radioButtonSelected]}
                onPress={() => setIsPacket(true)}
              >
                <Text style={styles.radioText}>Yes</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.radioButton, !isPacket && styles.radioButtonSelected]}
                onPress={() => {
                  setIsPacket(false);
                  // When switching to non-packet, ensure unit is valid
                  if (unit !== 'kg' && unit !== 'L') {
                    setUnit('kg');
                  }
                }}
              >
                <Text style={styles.radioText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter product description (optional)"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          
          <View style={styles.buttonContainer}>
            <CustomButton
              title="Next"
              onPress={handleNext}
              disabled={loading}
            />
            {loading && <ActivityIndicator style={styles.loader} size="small" color="#007AFF" />}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  picker: {
    height: 50,
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  radioButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  radioText: {
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loader: {
    marginLeft: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
  },
});

export default CustomProducts;

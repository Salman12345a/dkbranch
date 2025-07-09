import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  KeyboardAvoidingView, 
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
  ToastAndroid
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../../../services/api';
import CustomButton from '../../../components/ui/CustomButton';
import { inventoryService } from '../../../services/inventoryService';
import { storage } from '../../../utils/storage';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface EditProductDetailsProps {}

const EditProductDetails: React.FC<EditProductDetailsProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, categoryId, categoryName } = route.params as {
    productId: string;
    categoryId: string;
    categoryName: string;
  };

  // Get branchId from storage
  const branchId = storage.getString('userId');

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [isUnitModalVisible, setIsUnitModalVisible] = useState(false);
  const [isPacket, setIsPacket] = useState(false);
  const [description, setDescription] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [disabledReason, setDisabledReason] = useState('');
  
  // Track if this is a default product (true) or custom product (false)
  const [isDefaultProduct, setIsDefaultProduct] = useState(true);
  
  // Unit options for packaged products
  const packetUnitOptions = [
    { label: 'Kilogram (kg)', value: 'kg' },
    { label: 'Liter (L)', value: 'L' },
    { label: 'Gram (g)', value: 'g' },
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
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch product details on component mount
  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!branchId || !productId) {
        setInitialLoading(false);
        return;
      }

      try {
        const response = await api.get(`/branch/${branchId}/categories/${categoryId}/products/${productId}`);
        const product = response.data;

        setName(product.name || '');
        setPrice(product.price?.toString() || '');
        setIsPacket(product.isPacket || false);
        setQuantity(product.quantity?.toString() || '');
        setUnit(product.unit || 'kg');
        setDescription(product.description || '');
        setIsAvailable(product.isAvailable !== false); // Default to true if not specified
        setDisabledReason(product.disabledReason || '');
        
        // Determine if this is a default product or custom product
        setIsDefaultProduct(product.createdFromTemplate ?? true);
      } catch (err: any) {
        console.error('Error fetching product details:', err);
        setError(err?.message || 'Failed to fetch product details');
        Alert.alert('Error', 'Failed to fetch product details. Please try again.');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchProductDetails();
  }, [productId]);

  // Validate form
  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Product name is required');
      return false;
    }
    
    if (!price.trim() || isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    
    if (!quantity.trim()) {
      Alert.alert('Error', 'Quantity is required');
      return false;
    }
    
    if (!isAvailable && !disabledReason.trim()) {
      Alert.alert('Error', 'Please provide a reason why the product is not available');
      return false;
    }
    
    return true;
  };

  // Handle update
  const handleUpdate = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Prepare product data
      const productData: any = {
        name: name.trim(),
        price: Number(price),
        isPacket,
        description: description.trim(),
        isAvailable,
      };
      
      if (quantity.trim()) {
        productData.quantity = quantity.trim();
      }
      
      if (unit.trim()) {
        productData.unit = unit.trim();
      }
      
      if (!isAvailable && disabledReason.trim()) {
        productData.disabledReason = disabledReason.trim();
      }
      
      // Make API call to update product
      await api.put(`/branch/products/${productId}`, productData);
      
      // Show success message
      ToastAndroid.show('Product updated successfully!', ToastAndroid.SHORT);
      
      // Refresh product list
      if (branchId && categoryId) {
        await inventoryService.getBranchCategoryProducts(branchId, categoryId);
      }
      
      // Navigate back to products screen with the correct tab selected
      // @ts-ignore - Ignoring navigation type error
      navigation.navigate('ProductsScreen', {
        categoryId,
        categoryName,
        isDefault: isDefaultProduct, // Use the product type to determine which tab to show
        refresh: true,
        refreshTimestamp: Date.now()
      });
    } catch (err: any) {
      console.error('Error updating product:', err);
      setError(err?.message || 'Failed to update product');
      Alert.alert('Error', err?.message || 'Failed to update product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Edit Product Details</Text>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Product Name*</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter product name"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Price* (₹)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="Enter price"
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Is Packet?</Text>
            <Switch
              value={isPacket}
              onValueChange={(value) => {
                setIsPacket(value);
                // When switching from packet to non-packet, ensure unit is valid
                if (!value && unit !== 'kg' && unit !== 'L') {
                  setUnit('kg');
                }
              }}
              trackColor={{ false: '#d3d3d3', true: '#007AFF' }}
              thumbColor={isPacket ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Available for Sale</Text>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: '#d3d3d3', true: '#4CAF50' }}
              thumbColor={isAvailable ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.formGroup}>
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

          <View style={styles.formGroup}>
            <Text style={styles.label}>Unit*</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setIsUnitModalVisible(true)}
            >
              <Text style={styles.selectInputText}>
                {unitOptions.find(option => option.value === unit)?.label || 'Select unit'}
              </Text>
            </TouchableOpacity>
            
            {/* Unit selection modal */}
            <Modal
              visible={isUnitModalVisible}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setIsUnitModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select Unit</Text>
                  
                  {unitOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.optionItem}
                      onPress={() => {
                        setUnit(option.value);
                        setIsUnitModalVisible(false);
                      }}
                    >
                      <Text style={styles.optionText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                  
                  <TouchableOpacity
                    style={[styles.optionItem, styles.cancelButton]}
                    onPress={() => setIsUnitModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter product description (optional)"
              multiline
              numberOfLines={4}
            />
          </View>
          
          {!isAvailable && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Reason for Unavailability*</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={disabledReason}
                onChangeText={setDisabledReason}
                placeholder="Enter reason (out of stock, seasonal, discontinued, etc.)"
                multiline
                numberOfLines={3}
              />
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <CustomButton
              title="Update Product"
              onPress={handleUpdate}
              loading={loading}
            />
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
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonContainer: {
    marginTop: 20,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  selectInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
  },
  selectInputText: {
    fontSize: 16,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  optionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  cancelButton: {
    marginTop: 15,
    borderBottomWidth: 0,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ff3b30',
    fontWeight: '600',
  },
});

export default EditProductDetails;
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, ToastAndroid } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import CustomHeader from '../../../components/ui/CustomHeader';
import CustomButton from '../../../components/ui/CustomButton';
import { Product } from '../../../services/inventoryService';
import api from '../../../services/api';
import useInventoryStore from '../../../store/inventoryStore';
import inventoryService from '../../../services/inventoryService';
import { storage } from '../../../utils/storage';

type SelectDefaultProductsProps = StackScreenProps<RootStackParamList, 'SelectDefaultProducts'>;

const SelectDefaultProducts = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<SelectDefaultProductsProps['route']>();
  const { defaultCategoryId, categoryName, categoryId } = route.params;
  
  const [defaultProducts, setDefaultProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  
  // Get branchId from MMKV storage (userId)
  // const branchId = storage.getString('userId');

  // Fetch default products for the selected default category
  useEffect(() => {
    fetchDefaultProducts();
  }, [defaultCategoryId]);

  const fetchDefaultProducts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!defaultCategoryId) {
        setError('No default category ID provided.');
        setLoading(false);
        return;
      }
      
      const branchId = storage.getString('userId');
      if (!branchId) {
        setError('Branch ID not found');
        setLoading(false);
        return;
      }

      // Use the new function to get only non-imported products
      const products = await inventoryService.getNonImportedDefaultProducts(
        branchId, 
        categoryId, 
        defaultCategoryId
      );
      setDefaultProducts(products);
      
      // If no products are available to import, show a helpful message
      if (products.length === 0) {
        setError('All products from this category have already been imported.');
      }
    } catch (err: any) {
      console.error('Error fetching non-imported default products:', err);
      setError(err?.message || 'Failed to fetch default products');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleImportProducts = async () => {
    if (selectedProductIds.length === 0) return;
    setImporting(true);
    try {
      const branchId = storage.getString('userId');
      if (!branchId) throw new Error('Branch ID not found');
      // Use the correct categoryId from route params
      if (!categoryId) throw new Error('Category ID not found');
      await api.post(`/branch/${branchId}/categories/${categoryId}/import-products`, {
        productIds: selectedProductIds,
      });
      ToastAndroid.show('Products imported successfully!', ToastAndroid.SHORT);
      navigation.navigate('ProductsScreen', {
        categoryId,
        categoryName,
        isDefault: true,
        refresh: true,
        refreshTimestamp: Date.now(),
        defaultCategoryId
      });
    } catch (err: any) {
      ToastAndroid.show(err?.message || 'Failed to import products', ToastAndroid.LONG);
    } finally {
      setImporting(false);
    }
  };

  const renderProductItem = (product: Product) => {
    const isSelected = selectedProductIds.includes(product._id);
    return (
      <TouchableOpacity
        key={product._id}
        style={[styles.itemContainer, isSelected && styles.selectedItem]}
        onPress={() => handleSelectProduct(product._id)}
        activeOpacity={0.7}
      >
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </View>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
        ) : null}
        <View style={styles.productDetails}>
          <Text style={styles.itemName}>{product.name}</Text>
          <Text style={styles.itemPrice}>₹{product.price}</Text>
          {product.description ? (
            <Text style={styles.itemDescription}>{product.description}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <CustomHeader title={`Default Products - ${categoryName}`} />
      <View style={styles.container}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading available products...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <CustomButton title="Retry" onPress={fetchDefaultProducts} />
          </View>
        ) : (
          <>
            <Text style={styles.title}>Default products in this category</Text>
            {defaultProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No default products available for this category
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.scrollView}>
                {defaultProducts.map(renderProductItem)}
              </ScrollView>
            )}
            {!loading && !error && defaultProducts.length > 0 && (
              <View style={styles.buttonContainer}>
                <CustomButton
                  title={importing ? 'Importing...' : 'Import Selected Products'}
                  onPress={handleImportProducts}
                  disabled={selectedProductIds.length === 0 || importing}
                />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  selectedItem: {
    backgroundColor: '#e6f7ff',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: '#28a745',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: '#6c757d',
  },
  buttonContainer: {
    marginTop: 16,
    marginBottom: 20,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 10,
    color: '#6c757d',
  },
  errorText: {
    textAlign: 'center',
    marginVertical: 16,
    color: '#dc3545',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 20,
  },
});

export default SelectDefaultProducts;

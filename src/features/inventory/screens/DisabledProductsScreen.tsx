import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import CustomHeader from '../../../components/ui/CustomHeader';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../services/api';
import { storage } from '../../../utils/storage';
import { Product as BaseProduct } from '../../../services/inventoryService';

// Extended product interface for disabled products
interface Product extends BaseProduct {
  Category?: {
    _id: string;
    name: string;
    imageUrl: string;
  };
  isUpdating?: boolean;
  disabledReason?: string;
}
import { ToastAndroid } from 'react-native';

type NavigationProp = StackNavigationProp<RootStackParamList, 'DisabledProducts'>;

const DisabledProductsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disabledProducts, setDisabledProducts] = useState<Product[]>([]);

  const branchId = storage.getString('userId');

  // Function to fetch disabled products
  const fetchDisabledProducts = async () => {
    if (!branchId) {
      setError('Branch ID not found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/branch/${branchId}/products/disabled`);
      
      // Handle different API response structures
      if (response.data && response.data.status === 'SUCCESS') {
        // New format
        const productsArray = response.data.data.products || [];
        console.log(`Fetched ${productsArray.length} disabled products`);
        setDisabledProducts(productsArray);
      } else if (Array.isArray(response.data)) {
        // Old format
        console.log(`Fetched ${response.data.length} disabled products`);
        setDisabledProducts(response.data);
      } else {
        console.error('Unexpected API response format');
        setError('Failed to fetch disabled products - unexpected format');
      }
    } catch (err: any) {
      console.error('Error fetching disabled products:', err);
      setError(err?.message || 'Failed to fetch disabled products');
    } finally {
      setLoading(false);
    }
  };

  // Re-enable a disabled product
  const handleReEnableProduct = async (productId: string, productName: string) => {
    if (!branchId) {
      ToastAndroid.show('Branch ID not found', ToastAndroid.SHORT);
      return;
    }

    Alert.alert(
      'Enable Product',
      `Are you sure you want to enable ${productName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Enable',
          onPress: async () => {
            try {
              // Add loading indicator for this product
              setDisabledProducts(prev => 
                prev.map(product => 
                  product._id === productId 
                    ? { ...product, isUpdating: true } 
                    : product
                )
              );

              // Call API to re-enable product
              await api.patch(`/branch/products/${productId}/enable`);
              
              // Remove product from list
              setDisabledProducts(prev => 
                prev.filter(product => product._id !== productId)
              );
              
              ToastAndroid.show('Product enabled successfully', ToastAndroid.SHORT);
            } catch (error: any) {
              console.error('Error enabling product:', error);
              
              // Remove loading state
              setDisabledProducts(prev => 
                prev.map(product => 
                  product._id === productId 
                    ? { ...product, isUpdating: false } 
                    : product
                )
              );
              
              ToastAndroid.show(
                error?.response?.data?.message || 'Failed to enable product', 
                ToastAndroid.SHORT
              );
            }
          }
        }
      ]
    );
  };

  // Navigate to edit a disabled product
  const navigateToEditProduct = (productId: string, categoryId: string, categoryName: string) => {
    navigation.navigate('EditProductDetails', {
      productId,
      categoryId,
      categoryName
    });
  };

  // Load data on initial render
  useEffect(() => {
    fetchDisabledProducts();
  }, []);

  // Pull-to-refresh function
  const handleRefresh = () => {
    fetchDisabledProducts();
  };

  // Render a disabled product item
  const renderProductItem = ({ item: product }: { item: Product }) => {
    const categoryName = product.Category?.name || 'Unknown Category';
    
    return (
      <View style={styles.productCard}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {product.imageUrl ? (
            <Image 
              source={{ uri: product.imageUrl }} 
              style={styles.productImage} 
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Icon name="image-not-supported" size={30} color="#999" />
            </View>
          )}
        </View>
        
        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          
          {product.isPacket !== undefined && (
            <View style={product.isPacket ? styles.packTag : styles.looseTag}>
              <Text style={styles.tagText}>
                {product.isPacket ? 'Pack' : 'Loose'}
              </Text>
            </View>
          )}
          
          <Text style={styles.categoryText}>
            <Text style={styles.labelText}>Category: </Text>
            {categoryName}
          </Text>
          
          {product.disabledReason && (
            <Text style={styles.reasonText}>
              <Text style={styles.labelText}>Reason: </Text>
              {product.disabledReason}
            </Text>
          )}
          
          <Text style={styles.priceText}>
            ₹{product.price}
            {product.quantity && product.unit && `/${product.quantity}${product.unit}`}
          </Text>
        </View>
        
        {/* Action Button */}
        <View style={styles.actionButtons}>
          {/* Enable Button */}
          <TouchableOpacity 
            style={styles.enableButton}
            onPress={() => handleReEnableProduct(product._id, product.name)}
            disabled={product.isUpdating}
          >
            {product.isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="check-circle" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <CustomHeader 
        title="Disabled Products" 
        onBackPress={() => navigation.goBack()} 
      />
      
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading disabled products...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Icon name="error-outline" size={50} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchDisabledProducts}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : disabledProducts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="check-circle" size={70} color="#28a745" />
          <Text style={styles.emptyText}>No disabled products found!</Text>
          <Text style={styles.emptySubText}>All your products are currently enabled.</Text>
        </View>
      ) : (
        <FlatList
          data={disabledProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={loading}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    padding: 10,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    padding: 15,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
  },
  productInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 14,
    color: '#dc3545',
    marginBottom: 4,
  },
  labelText: {
    fontWeight: '500',
    color: '#555',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#28a745',
    marginTop: 2,
  },
  packTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF6347',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 5,
  },
  looseTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 5,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    flexDirection: 'row',
  },
  editButton: {
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  enableButton: {
    backgroundColor: '#28a745',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DisabledProductsScreen;

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Image, Dimensions, Alert, Modal } from 'react-native';
import { Tab, TabView } from '@rneui/themed';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useInventoryStore from '../../../store/inventoryStore';
import { Product, Category } from '../../../services/inventoryService';
import inventoryService from '../../../services/inventoryService';
import CustomHeader from '../../../components/ui/CustomHeader';
import CustomButton from '../../../components/ui/CustomButton';
import { useRoute } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { storage } from '../../../utils/storage';
import { ToastAndroid } from 'react-native';

type ProductsScreenProps = StackScreenProps<RootStackParamList, 'ProductsScreen'>;

const ProductsScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<ProductsScreenProps['route']>();
  const {
    products,
    fetchDefaultProducts,
    fetchCustomProducts,
    fetchBranchCategoryProducts,
    toggleProductSelection,
    setActiveProductTab,
    clearProductSelections,
    deleteCustomProducts
  } = useInventoryStore();

  const [productIndex, setProductIndex] = React.useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading products...');
  
  // Get branchId from MMKV storage (userId)
  const branchId = storage.getString('userId');
  
  // Get params from route
  const { categoryId, categoryName, isDefault, refresh, refreshTimestamp, defaultCategoryId } = route.params;
  
  // Determine if this is a custom category directly from the route params
  // If defaultCategoryId exists, it's an imported category (not custom)
  // Otherwise, if isDefault is false, it's a custom category
  const isCustomCategory = !defaultCategoryId && !isDefault;
  
  console.log(`Category ${categoryName} is ${isCustomCategory ? 'custom' : 'default/imported'}`);
  console.log(`defaultCategoryId: ${defaultCategoryId}, isDefault: ${isDefault}`);

  // Function to fetch all products for the category
  const fetchAllProducts = async () => {
    if (!categoryId || !branchId) return;
    
    try {
      // Start loading state
      setIsLoading(true);
      console.log('Fetching products for category:', categoryId);
      
      if (isCustomCategory) {
        // For custom categories, only fetch custom products
        setLoadingMessage('Loading custom products...');
        console.log('Custom category - only fetching custom products');
        await fetchCustomProducts(branchId, categoryId);
        console.log('Custom products fetched successfully');
      } else {
        // For default categories, fetch both default and custom products
        // First fetch default products (from template)
        setLoadingMessage('Loading default products...');
        await fetchBranchCategoryProducts(branchId, categoryId);
        console.log('Default products fetched successfully');
        
        // Then fetch custom products (created by branch)
        setLoadingMessage('Loading custom products...');
        await fetchCustomProducts(branchId, categoryId);
        console.log('Custom products fetched successfully');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      ToastAndroid.show('Error loading products', ToastAndroid.SHORT);
    } finally {
      // End loading state regardless of success or failure
      setIsLoading(false);
    }
  };

  // Effect to handle initial load
  useEffect(() => {
    if (categoryId && branchId) {
      // For custom categories, automatically set the active tab to 'custom'
      if (isCustomCategory) {
        setActiveProductTab('custom');
        setProductIndex(1);
      } else {
        // For non-custom categories, handle initial tab selection based on isDefault parameter
        if (isDefault) {
          setActiveProductTab('default');
          setProductIndex(0);
        } else {
          setActiveProductTab('custom');
          setProductIndex(1);
        }
      }
      
      fetchAllProducts();
    }
  }, [categoryId, isDefault, branchId, isCustomCategory]);
  
  // Effect to handle refreshes
  useEffect(() => {
    if (refresh && refreshTimestamp && categoryId && branchId) {
      console.log('Refreshing products due to navigation parameter with timestamp:', refreshTimestamp);
      fetchAllProducts();
      
      // If not custom category and not default, ensure we're on the custom tab
      if (!isCustomCategory && !isDefault) {
        setProductIndex(1); // Switch to custom tab
        setActiveProductTab('custom');
      }
    }
  }, [refresh, refreshTimestamp, isCustomCategory]);

  // Clear selections when component mounts or category changes
  useEffect(() => {
    clearProductSelections(categoryId);
  }, [categoryId, clearProductSelections]);

  const handleProductSelect = (productId: string) => {
    toggleProductSelection(productId, categoryId);
  };

  const navigateToSelectDefaultProducts = () => {
    navigation.navigate('SelectDefaultProducts', {
      categoryId, // branch category id
      categoryName,
      defaultCategoryId // pass original default id
    });
  };
  
  const navigateToCreateProduct = () => {
    navigation.navigate('CustomProducts', {
      categoryId,
      categoryName,
      isCustom: true
    });
  };

  const navigateToEditProduct = (productId: string) => {
    navigation.navigate('EditProductDetails', {
      productId,
      categoryId,
      categoryName
    });
  };
  
  // Function to handle removing a product
  const handleRemoveProduct = (productId: string, productName: string, isCustom: boolean) => {
    if (!branchId || !categoryId) {
      ToastAndroid.show('Missing branch or category information', ToastAndroid.SHORT);
      return;
    }
    
    const actionText = isCustom ? 'delete' : 'remove';
    
    // Show confirmation dialog
    Alert.alert(
      `${isCustom ? 'Delete' : 'Remove'} Product`,
      `Are you sure you want to ${actionText} ${productName}?${isCustom ? '\nThis action cannot be undone.' : ''}`,
      [
        {
          text: 'No',
          style: 'cancel'
        },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              if (isCustom) {
                // For custom products, completely delete them
                await deleteCustomProducts(branchId, [productId], categoryId);
                ToastAndroid.show('Custom product deleted successfully', ToastAndroid.SHORT);
              } else {
                // For imported products, just mark as removed
                await inventoryService.removeImportedProducts(branchId, [productId]);
                ToastAndroid.show('Product removed successfully', ToastAndroid.SHORT);
              }
              
              // Refresh products list
              fetchAllProducts();
            } catch (error) {
              console.error(`Error ${actionText}ing product:`, error);
              ToastAndroid.show(`Failed to ${actionText} product`, ToastAndroid.SHORT);
            }
          }
        }
      ]
    );
  };

  // Product card component for grid layout
  // Handler for product view or edit operations
  const handleProductPress = (product: Product) => {
    if (!product.isAvailable) {
      // Show alert for unavailable products
      Alert.alert(
        "Product Unavailable",
        `${product.name} is temporarily disabled due to unavailability.`,
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    // Navigate to product detail/edit screen instead of selecting it
    navigateToEditProduct(product._id);
  };
  
  // Separate handler for explicitly selecting products (e.g., for batch operations)
  const handleProductLongPress = (product: Product) => {
    if (!product.isAvailable) return; // Don't allow selection of unavailable products
    toggleProductSelection(product._id, categoryId);
  };

  const renderProductItem = ({ item: product }: { item: Product }) => {
    const isSelected = products[products.activeTab].selected[categoryId]?.includes(product._id) || false;
    const isUnavailable = product.isAvailable === false;
    
    return (
      <TouchableOpacity
        style={[
          styles.gridItem, 
          isSelected && styles.selectedItem,
          isUnavailable && styles.unavailableItem
        ]}
        onPress={() => handleProductPress(product)}
        onLongPress={() => handleProductLongPress(product)}
        delayLongPress={500}
        activeOpacity={isUnavailable ? 1 : 0.7} // Less responsive press effect for unavailable items
      >
        <View style={styles.imageContainer}>
          {product.imageUrl ? (
            <Image 
              source={{ uri: product.imageUrl }} 
              style={[
                styles.productImage,
                isUnavailable && styles.grayedImage
              ]} 
              resizeMode="cover"
            />
          ) : (
            <View style={[
              styles.placeholderImage,
              isUnavailable && styles.grayedPlaceholder
            ]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <View style={styles.nameContainer}>
            <Text style={[
              styles.itemName, 
              isUnavailable && styles.unavailableText
            ]} numberOfLines={1}>
              {product.name}
            </Text>
            {product.isPacket === false ? (
              <View style={styles.inlineLooseTag}>
                <Text style={styles.looseProductText}>Loose</Text>
              </View>
            ) : product.isPacket === true ? (
              <View style={styles.inlinePackTag}>
                <Text style={styles.packProductText}>Pack</Text>
              </View>
            ) : null}
            
            {/* Show unavailable tag if product is not available */}
            {isUnavailable && (
              <View style={styles.unavailableTag}>
                <Text style={styles.unavailableTagText}>Unavailable</Text>
              </View>
            )}
          </View>
          
          {/* Show price with quantity and unit regardless of isPacket */}
          {product.unit && product.quantity ? (
            <Text style={[
              styles.itemPrice,
              isUnavailable && styles.unavailableText
            ]}>₹{product.price}/{product.quantity}{product.unit}</Text>
          ) : product.unit ? (
            <Text style={[
              styles.itemPrice,
              isUnavailable && styles.unavailableText
            ]}>₹{product.price}/{product.unit}</Text>
          ) : (
            <Text style={[
              styles.itemPrice,
              isUnavailable && styles.unavailableText
            ]}>₹{product.price}</Text>
          )}
          <Text style={[
            styles.itemDescription,
            isUnavailable && styles.unavailableText
          ]} numberOfLines={2}>{product.description || 'No description'}</Text>
        </View>
        
        {/* Edit button - only shown for available products */}
        {!isUnavailable && (
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => navigateToEditProduct(product._id)}
          >
            <Icon name="edit" size={16} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Delete button for default products */}
        {products.activeTab === 'default' && product.createdFromTemplate && (
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => handleRemoveProduct(product._id, product.name, false)}
          >
            <Icon name="delete" size={20} color="#FF6347" />
          </TouchableOpacity>
        )}
        
        {/* Delete button for custom products */}
        {products.activeTab === 'custom' && !product.createdFromTemplate && (
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => handleRemoveProduct(product._id, product.name, true)}
          >
            <Icon name="delete" size={20} color="#FF6347" />
          </TouchableOpacity>
        )}
        
        {/* Custom product indicator (hidden but kept as flag) */}
        {!product.createdFromTemplate && (
          <View style={[styles.customProductIndicator, { display: 'none' }]}>
            <Text style={styles.customProductText}>Custom</Text>
          </View>
        )}
        
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Get products based on the active tab and filter by createdFromTemplate flag
  const getProductsForTab = () => {
    // For custom categories, always return custom products
    if (isCustomCategory) {
      if (products.custom.loading || products.custom.error) {
        return [];
      }
      
      const customItems = products.custom.items[categoryId] || [];
      const filteredProducts = customItems.filter(
        (product: Product) => product.createdFromTemplate === false
      );
      
      return filteredProducts;
    }
    
    // For regular categories, handle based on active tab
    if (products.activeTab === 'default') {
      if (products.default.loading || products.default.error) {
        return [];
      }
      
      const defaultItems = products.default.items[categoryId] || [];
      const filteredProducts = defaultItems.filter(
        (product: Product) => product.createdFromTemplate === true
      );
      
      return filteredProducts;
    } else {
      if (products.custom.loading || products.custom.error) {
        return [];
      }
      
      // Filter to ensure only products with createdFromTemplate = false are shown
      const customItems = products.custom.items[categoryId] || [];
      const filteredProducts = customItems.filter((product: Product) => {
        return product.createdFromTemplate === false;
      });
      
      console.log(`Filtered ${filteredProducts.length} products for CUSTOM tab`);
      return filteredProducts;
    }
  };
  
  const selectedCategoryProducts = getProductsForTab();
  
  console.log(`Final products for ${products.activeTab} tab:`, selectedCategoryProducts.length);

  return (
    <View style={styles.mainContainer}>
      <CustomHeader 
        title={`${categoryName} Products`} 
        onBackPress={() => navigation.goBack()} 
      />
      
      {/* Full Screen Loading Overlay */}
      <Modal
        visible={isLoading}
        transparent={true}
        animationType='fade'
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingModalContainer}>
            <ActivityIndicator size='large' color='#007AFF' />
            <Text style={styles.loadingModalText}>{loadingMessage}</Text>
          </View>
        </View>
      </Modal>
      
      <View style={styles.container}>
        {isCustomCategory ? (
          // For custom categories, only show custom products without tabs
          <View style={styles.tabContentContainer}>
            {products.custom.loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading custom products...</Text>
              </View>
            ) : products.custom.error ? (
              <Text style={styles.errorText}>{products.custom.error}</Text>
            ) : (
              <>
                {selectedCategoryProducts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No custom products added yet</Text>
                    <View style={styles.buttonContainer}>
                      <CustomButton
                        title="Create New Product"
                        onPress={navigateToCreateProduct}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <FlatList
                      data={selectedCategoryProducts}
                      renderItem={renderProductItem}
                      keyExtractor={(item) => item._id}
                      numColumns={2}
                      columnWrapperStyle={styles.gridRow}
                      contentContainerStyle={styles.gridContainer}
                      showsVerticalScrollIndicator={false}
                    />
                    <View style={styles.buttonContainer}>
                      <CustomButton
                        title="Create New Product"
                        onPress={navigateToCreateProduct}
                      />
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        ) : (
          // For regular categories (default/imported), show tabs with both default and custom products
          <>
            <Tab
              value={productIndex}
              onChange={(index) => {
                setProductIndex(index);
                setActiveProductTab(index === 0 ? 'default' : 'custom');
              }}
              indicatorStyle={styles.tabIndicator}
            >
              <Tab.Item
                title="Default"
                titleStyle={styles.tabTitle}
              />
              <Tab.Item
                title="Custom"
                titleStyle={styles.tabTitle}
              />
            </Tab>

            <TabView 
              value={productIndex} 
              onChange={(index) => {
                setProductIndex(index);
                // Ensure activeProductTab is always updated when tab changes, including swipes
                setActiveProductTab(index === 0 ? 'default' : 'custom');
              }} 
              animationType="spring"
            >
              {/* Default Products Tab */}
              <TabView.Item style={styles.tabContent}>
                <View style={styles.tabContentContainer}>
                  {products.default.loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#007AFF" />
                      <Text style={styles.loadingText}>Loading default products...</Text>
                    </View>
                  ) : products.default.error ? (
                    <Text style={styles.errorText}>{products.default.error}</Text>
                  ) : (
                    <>
                      {selectedCategoryProducts.length === 0 ? (
                        <View style={styles.emptyState}>
                          <Text style={styles.emptyStateText}>No products imported for this category yet</Text>
                          <View style={styles.buttonContainer}>
                            <CustomButton
                              title="Import New Products"
                              onPress={navigateToSelectDefaultProducts}
                            />
                          </View>
                        </View>
                      ) : (
                        <>
                          <View style={{flex: 1}}>
                            <FlatList
                              data={selectedCategoryProducts}
                              renderItem={renderProductItem}
                              keyExtractor={(item) => item._id}
                              numColumns={2}
                              columnWrapperStyle={styles.gridRow}
                              contentContainerStyle={styles.gridContainer}
                              showsVerticalScrollIndicator={false}
                            />
                            <View style={styles.fixedButtonContainer}>
                              <CustomButton
                                title="Import New Products"
                                onPress={navigateToSelectDefaultProducts}
                              />
                            </View>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>
              </TabView.Item>
              
              {/* Custom Products Tab */}
              <TabView.Item style={styles.tabContent}>
                <View style={styles.tabContentContainer}>
                  {products.custom.loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#007AFF" />
                      <Text style={styles.loadingText}>Loading custom products...</Text>
                    </View>
                  ) : products.custom.error ? (
                    <Text style={styles.errorText}>{products.custom.error}</Text>
                  ) : (
                    <>
                      {selectedCategoryProducts.length === 0 ? (
                        <View style={styles.emptyState}>
                          <Text style={styles.emptyStateText}>No custom products added yet</Text>
                          <View style={styles.buttonContainer}>
                            <CustomButton
                              title="Create New Product"
                              onPress={navigateToCreateProduct}
                            />
                          </View>
                        </View>
                      ) : (
                        <>
                          <View style={{flex: 1}}>
                            <FlatList
                              data={selectedCategoryProducts}
                              renderItem={renderProductItem}
                              keyExtractor={(item) => item._id}
                              numColumns={2}
                              columnWrapperStyle={styles.gridRow}
                              contentContainerStyle={styles.gridContainer}
                              showsVerticalScrollIndicator={false}
                            />
                            <View style={styles.fixedButtonContainer}>
                              <CustomButton
                                title="Create New Product"
                                onPress={navigateToCreateProduct}
                              />
                            </View>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>
              </TabView.Item>
            </TabView>
          </>
        )}
      </View>
    </View>
  );
};

// Get screen width to calculate grid item width
const { width } = Dimensions.get('window');
const itemWidth = (width - 10) / 2; // 2 columns with minimal padding

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 0, // Removed padding to use full width
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgb(255, 255, 255)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModalContainer: {
    backgroundColor: 'white',

  },
  loadingModalText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  tabIndicator: {
    backgroundColor: '#007AFF',
    height: 3,
  },
  tabTitle: {
    color: '#007AFF',
    fontSize: 14,
  },
  tabContent: {
    width: '100%',
    flex: 1,
  },
  tabContentContainer: {
    flex: 1,
  },
  gridContainer: {
    paddingTop: 10,
    paddingBottom: 120, // Increased bottom padding to ensure proper spacing at the bottom
    paddingHorizontal: 2, // Minimal horizontal padding to maximize screen usage
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridItem: {
    width: itemWidth,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  unavailableItem: {
    backgroundColor: '#f9f9f9',
    opacity: 0.7,
    borderColor: '#d3d3d3',
    borderWidth: 1,
  },
  imageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#f5f5f5',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  grayedImage: {
    opacity: 0.5,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  grayedPlaceholder: {
    backgroundColor: '#d7d7d7',
  },
  placeholderText: {
    color: '#888',
    fontSize: 14,
  },
  productInfo: {
    padding: 10,
  },
  selectedItem: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  unavailableText: {
    color: '#999',
  },
  unavailableTag: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 5,
  },
  unavailableTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  selectedBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: '#007AFF',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    flexWrap: 'wrap',
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 5,
  },

  itemPrice: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '500',
  },

  itemDescription: {
    fontSize: 12,
    color: '#6c757d',
    height: 32, // Limit to 2 lines
  },
  customProductIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#FF8C00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 1,
  },
  customProductText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inlineLooseTag: {
    backgroundColor: '#8A2BE2', // Purple color for loose products
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 5,
  },
  inlinePackTag: {
    backgroundColor: '#FF6347', // Tomato color for packaged products
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 5,
  },
  looseProductText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  packProductText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  editButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#007AFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  deleteButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 10,
    color: '#6c757d',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#dc3545',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
    flex: 1,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 20,
  },
  buttonContainer: {
    paddingHorizontal: 5,
    marginTop: 5,
    marginBottom: 10,
    width: '100%',
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});

export default ProductsScreen;

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ToastAndroid, ActivityIndicator, Alert } from 'react-native';
import { Icon } from '@rneui/themed';
import api from '../../../services/api';
import { Tab, TabView } from '@rneui/themed';
import useInventoryStore from '../../../store/inventoryStore';
import { Category, Product, inventoryService } from '../../../services/inventoryService';
import CustomHeader from '../../../components/ui/CustomHeader';
import CustomButton from '../../../components/ui/CustomButton';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { InventoryItemDisplayNavigationProp } from '../../../navigation/types';
import { storage } from '../../../utils/storage';

const InventoryItemDisplay = () => {
  const navigation = useNavigation<InventoryItemDisplayNavigationProp>();
  const route = useRoute();
  const {
    categories,
    products,
    fetchBranchCategories,
    setActiveCategoryTab,
    setActiveProductTab,
    fetchDefaultProducts,
    fetchCustomProducts,
    toggleProductSelection,
    importSelectedProducts,
    setSelectedCategory,
  } = useInventoryStore();

  // Add loading state for initial screen load
  const [isLoading, setIsLoading] = useState(true);

  const [categoryIndex, setCategoryIndex] = React.useState(0);
  // productIndex state removed as it's now in ProductsScreen
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [isRemoving, setIsRemoving] = React.useState(false);
  // New state for custom categories deletion mode
  const [customDeletionMode, setCustomDeletionMode] = React.useState(false);
  const [deletingCustomCategories, setDeletingCustomCategories] = React.useState(false);
  // Map to cache categories with products
  const [categoriesWithProducts, setCategoriesWithProducts] = React.useState<Record<string, boolean>>({});
  const [checkingProducts, setCheckingProducts] = React.useState(false);

  // Get branchId from MMKV storage (userId)
  const branchId = storage.getString('userId');
  console.log('BranchId (userId) from MMKV storage:', branchId);

  // Effect to fetch categories when the screen comes into focus or when branchId changes.
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const loadData = async () => {
        if (branchId && isActive) {
          console.log('InventoryItemDisplay focused, fetching categories...');
          setIsLoading(true);
          try {
            await fetchBranchCategories(branchId);
            // Check if we need to switch to the custom tab after import
            const params = route.params as { refresh?: boolean; refreshTimestamp?: number } | undefined;
            if (params?.refresh) {
              // Clear the refresh param to prevent re-triggering on subsequent focuses without new navigation
              navigation.setParams({ refresh: undefined, refreshTimestamp: undefined });
            }
          } catch (error) {
            console.error('Error loading categories on focus:', error);
          } finally {
            if (isActive) {
              setTimeout(() => {
                setIsLoading(false);
              }, 800); // Keep small delay for smoother UI
            }
          }
        }
      };

      loadData();

      return () => {
        isActive = false;
      };
    }, [branchId, fetchBranchCategories, route.params, navigation, setActiveCategoryTab])
  );

  // Initial categories fetch (this might be redundant if useFocusEffect covers initial load, but kept for safety for now)
  // Consider removing if useFocusEffect handles initial load reliably.
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (branchId) {
          await fetchBranchCategories(branchId);
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        // Delay turning off the loading state for a smoother experience
        setTimeout(() => {
          setIsLoading(false);
        }, 800);
      }
    };
    
    loadData();
  }, [branchId, fetchBranchCategories]);
  
  // Reset the product cache when exiting selection or deletion mode
  useEffect(() => {
    if (!selectionMode && !customDeletionMode) {
      setCategoriesWithProducts({});
    }
  }, [selectionMode, customDeletionMode]);

  const handleAddInventory = () => {
    navigation.navigate('DefaultCategories');
  };

  // Product handling functions moved to ProductsScreen

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('ProductsScreen', {
      categoryId: category._id,
      categoryName: category.name,
      isDefault: categories.activeTab === 'default',
      defaultCategoryId: category.defaultCategoryId
    });
  };

  const handleRemoveSelectedCategories = () => {
    if (!branchId || selectedCategories.length === 0) return;
    
    // Show confirmation dialog
    Alert.alert(
      'Remove Categories',
      'Are you sure you want to remove these selected categories?',
      [
        {
          text: 'No',
          style: 'cancel'
        },
        {
          text: 'Yes',
          onPress: async () => {
            setIsRemoving(true);
            try {
              console.log('Removing categories with IDs:', selectedCategories);
              
              // Use the api service which handles the base URL, authentication, and error handling
              // The endpoint path matches what was shown in the screenshot
              const response = await api.put(`/branch/${branchId}/categories/remove-imported`, {
                categoryIds: selectedCategories
              });
              
              console.log('Response data:', response.data);
              
              // Show success message
              ToastAndroid.show('Categories removed successfully', ToastAndroid.SHORT);
              
              // Reset selection mode and refresh categories
              setSelectionMode(false);
              setSelectedCategories([]);
              fetchBranchCategories(branchId);
            } catch (error) {
              console.error('Error removing categories:', error);
              // More detailed error message
              if (error instanceof Error) {
                ToastAndroid.show(`Error: ${error.message}`, ToastAndroid.LONG);
              } else {
                ToastAndroid.show('Failed to remove categories', ToastAndroid.LONG);
              }
            } finally {
              setIsRemoving(false);
            }
          }
        }
      ]
    );
  };

  // Handle custom category deletion
  const handleDeleteCustomCategories = async () => {
    if (!branchId || selectedCategories.length === 0) return;
    
    // Show confirmation dialog
    Alert.alert(
      'Delete Categories',
      'Are you sure you want to delete the selected categories?',
      [
        {
          text: 'No',
          style: 'cancel'
        },
        {
          text: 'Yes',
          onPress: async () => {
            setDeletingCustomCategories(true);
            try {
              console.log('Deleting custom categories with IDs:', selectedCategories);
              await inventoryService.deleteCustomCategories(branchId, selectedCategories);
              
              // Show success message
              ToastAndroid.show('Categories deleted successfully', ToastAndroid.SHORT);
              
              // Reset selection mode and refresh categories
              setCustomDeletionMode(false);
              setSelectedCategories([]);
              fetchBranchCategories(branchId);
            } catch (error) {
              console.error('Error deleting custom categories:', error);
              // More detailed error message
              if (error instanceof Error) {
                ToastAndroid.show(`Error: ${error.message}`, ToastAndroid.LONG);
              } else {
                ToastAndroid.show('Failed to delete categories', ToastAndroid.LONG);
              }
            } finally {
              setDeletingCustomCategories(false);
            }
          }
        }
      ]
    );
  };

  // Check if a category has products before allowing selection
  const checkCategoryForProducts = async (categoryId: string) => {
    if (!branchId) return false;
    
    // If we already checked this category, use cached result
    if (categoriesWithProducts[categoryId] !== undefined) {
      return categoriesWithProducts[categoryId];
    }
    
    setCheckingProducts(true);
    try {
      // Fetch both types of products for this category
      const products = await inventoryService.getBranchCategoryProducts(branchId, categoryId);
      const hasProducts = products.length > 0;
      
      // Cache the result
      setCategoriesWithProducts(prev => ({
        ...prev,
        [categoryId]: hasProducts
      }));
      
      return hasProducts;
    } catch (error) {
      console.error('Error checking category products:', error);
      // If there's an error, we assume there are no products
      return false;
    } finally {
      setCheckingProducts(false);
    }
  };

  const toggleCategorySelection = async (categoryId: string) => {
    // If we're deselecting, always allow it
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
      return;
    }
    
    // Check for products in both default and custom categories
    // when in their respective deletion modes
    if ((selectionMode && categories.activeTab === 'default') || customDeletionMode) {
      const hasProducts = await checkCategoryForProducts(categoryId);
      
      if (hasProducts) {
        // Show alert that category has products
        Alert.alert(
          customDeletionMode ? 'Cannot Delete Category' : 'Cannot Remove Category',
          'This category contains products. You must delete all products in this category before ' + 
          (customDeletionMode ? 'deleting' : 'removing') + ' it.',
          [{ text: 'Got it', style: 'default' }]
        );
        return;
      }
    }
    
    // If no products or not in selection/deletion mode, allow selection
    setSelectedCategories([...selectedCategories, categoryId]);
  };

  // Toggle custom category deletion mode
  const toggleCustomDeletionMode = () => {
    // If we're exiting deletion mode, clear selections
    if (customDeletionMode) {
      setSelectedCategories([]);
    }
    setCustomDeletionMode(!customDeletionMode);
  };

  const renderCategoryItem = (category: Category) => {
    const isSelected = selectedCategories.includes(category._id);
    return (
      <TouchableOpacity
        key={category._id}
        style={[styles.gridItem, isSelected && styles.categorySelectedItem]}
        onPress={() => {
          if (selectionMode || customDeletionMode) {
            toggleCategorySelection(category._id);
          } else {
            handleCategoryPress(category);
          }
        }}
      >
        {(selectionMode || customDeletionMode) && (
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
              {checkingProducts && category._id === selectedCategories[selectedCategories.length - 1] && (
                <ActivityIndicator size="small" color="#007AFF" style={styles.smallLoader} />
              )}
            </View>
          </View>
        )}
        {category.imageUrl ? (
          <Image
            source={{ uri: category.imageUrl }}
            style={styles.categoryImage}
          />
        ) : (
          <View style={[styles.categoryImage, { backgroundColor: '#e9ecef' }]} />
        )}
        <Text style={styles.itemName}>{category.name}</Text>
      </TouchableOpacity>
    );
  };

  // renderProductItem moved to ProductsScreen

  const renderCategories = () => {
    const activeCategories = categories.branch;
    // Default and custom filtered lists
    const defaultCategories = activeCategories.items.filter(
      category => category.createdFromTemplate || !!category.defaultCategoryId
    );
    const customCategories = activeCategories.items.filter(
      category => !category.createdFromTemplate && !category.defaultCategoryId
    );

    return (
      <View style={styles.container}>
        <Tab
          value={categoryIndex}
          onChange={(index) => {
            setCategoryIndex(index);
            setActiveCategoryTab(index === 0 ? 'default' : 'custom');
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

        <TabView value={categoryIndex} onChange={setCategoryIndex} animationType="spring">
          {/* Default Tab */}
          <TabView.Item style={styles.tabContent}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {activeCategories.loading ? (
                <Text style={styles.loadingText}>Loading categories...</Text>
              ) : activeCategories.error ? (
                <Text style={styles.errorText}>{activeCategories.error}</Text>
              ) : (
                <>
                  {defaultCategories.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No default categories added yet</Text>
                      <CustomButton title="Import Category" onPress={handleAddInventory} />
                    </View>
                  ) : (
                    <>
                      <View style={styles.headerContainer}>
                        <Text style={styles.sectionTitle}>Imported Default Categories</Text>
                        {defaultCategories.length > 0 && (
                          <TouchableOpacity
                            style={styles.deleteIcon}
                            onPress={() => {
                              setSelectionMode(!selectionMode);
                              setSelectedCategories([]);
                            }}
                          >
                            <Icon name={selectionMode ? "close" : "delete"} size={24} color="#dc3545" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.gridContainer}>
                        {defaultCategories.map(renderCategoryItem)}
                      </View>
                      {selectionMode ? (
                        <View style={styles.removeButtonContainer}>
                          {isRemoving ? (
                            <ActivityIndicator size="small" color="#007AFF" />
                          ) : (
                            <CustomButton 
                              title="Remove Selected Categories" 
                              onPress={handleRemoveSelectedCategories}
                              disabled={selectedCategories.length === 0} 
                            />
                          )}
                        </View>
                      ) : (
                        <View style={styles.addButtonContainer}>
                          <CustomButton title="Import Category" onPress={handleAddInventory} />
                        </View>
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </TabView.Item>
          {/* Custom Tab */}
          <TabView.Item style={styles.tabContent}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {activeCategories.loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
              ) : activeCategories.error ? (
                <View style={styles.emptyState}>
                  <Text style={styles.errorText}>{activeCategories.error}</Text>
                </View>
              ) : (
                <>
                  {customCategories.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No custom categories yet. Create one!</Text>
                      <CustomButton
                        title="Create Category"
                        onPress={() => navigation.navigate('CreateCustomCategories')}
                      />
                    </View>
                  ) : (
                    <>
                      <View style={styles.headerContainer}>
                        <Text style={styles.sectionTitle}>Custom Categories</Text>
                        <TouchableOpacity
                          style={styles.deleteIcon}
                          onPress={toggleCustomDeletionMode}
                        >
                          <Icon
                            name={customDeletionMode ? "close" : "delete"}
                            type="material"
                            color={customDeletionMode ? "#F44336" : "#007AFF"}
                            size={24}
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.gridContainer}>
                        {customCategories.map(renderCategoryItem)}
                      </View>
                      {customDeletionMode && selectedCategories.length > 0 && (
                        <View style={styles.removeButtonContainer}>
                          <CustomButton
                            title={`Delete Selected (${selectedCategories.length})`}
                            onPress={handleDeleteCustomCategories}
                            loading={deletingCustomCategories}
                          />
                        </View>
                      )}
                      {!customDeletionMode && (
                        <View style={styles.addButtonContainer}>
                          <CustomButton title="Create Category" onPress={() => navigation.navigate('CreateCustomCategories')} />
                        </View>
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </TabView.Item>
        </TabView>
      </View>
    );
  };

  // renderProducts function removed as it is now moved to ProductsScreen

  if (!branchId) {
    return (
      <View style={styles.mainContainer}>
        <View style={styles.emptyState}>
          <Text style={styles.loadingText}>Loading branch information...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {renderCategories()}
      
      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#340e5c" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteIcon: {
    padding: 8,
  },
  checkboxContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categorySelectedItem: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    borderWidth: 2,
  },
  removeButtonContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  tabIndicator: {
    backgroundColor: '#007AFF',
    height: 2,
  },
  tabTitle: {
    fontSize: 16,
    color: '#007AFF',
  },
  tabContent: {
    width: '100%',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  itemContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectedItem: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 0,
  },
  itemDescription: {
    fontSize: 14,
    color: '#6c757d',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '500',
    color: '#28a745',
    marginBottom: 4,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#6c757d',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#dc3545',
  },
  importButtonContainer: {
    marginTop: 16,
  },
  addButtonContainer: {
    marginTop: 16,
    marginBottom: 20, // Added bottom margin for spacing
    paddingBottom: 10, // Extra padding at the bottom
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 16,
  },
  categoryImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'center',
    resizeMode: 'cover',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    marginLeft: 4,
  },
  smallLoader: {
    position: 'absolute',
    right: -10,
    top: -10,
  },
});

export default InventoryItemDisplay;

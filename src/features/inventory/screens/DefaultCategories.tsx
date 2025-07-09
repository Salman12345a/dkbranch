import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Tab, TabView } from '@rneui/themed';
import { inventoryService } from '../../../services/inventoryService';
import CustomHeader from '../../../components/ui/CustomHeader';
import CustomButton from '../../../components/ui/CustomButton';
import { useNavigation } from '@react-navigation/native';
import { DefaultCategoriesNavigationProp } from '../../../navigation/types';
import { Category } from '../../../services/inventoryService';
import { storage } from '../../../utils/storage';

const DefaultCategories = () => {
  const navigation = useNavigation<DefaultCategoriesNavigationProp>();

  // Local state for default categories
  const [defaultCategories, setDefaultCategories] = useState<Category[]>([]);
  const [branchCategories, setBranchCategories] = useState<Category[]>([]); // State for branch's categories
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const branchId = storage.getString('userId');
      if (!branchId) {
        setError('Branch ID not found');
        setLoading(false);
        return;
      }
      try {
        const [defaultCats, branchCats] = await Promise.all([
          inventoryService.getDefaultCategories(),
          inventoryService.getCustomCategories(branchId),
        ]);
        setDefaultCategories(defaultCats);
        setBranchCategories(branchCats);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch categories');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCategorySelect = (categoryId: string) => {
    setSelected((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleImport = async () => {
    const branchId = storage.getString('userId');
    if (!branchId) {
      setError('Branch ID not found');
      return;
    }
    setLoading(true);
    try {
      await inventoryService.importDefaultCategories(branchId, selected);
      setSelected([]);
      navigation.navigate('InventoryItemDisplay', { 
        refresh: true, 
        refreshTimestamp: Date.now() 
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to import categories');
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryItem = (category: Category) => {
    const isSelected = selected.includes(category._id);
    return (
      <TouchableOpacity
        key={category._id}
        style={[styles.itemContainer, isSelected && styles.selectedItem]}
        onPress={() => handleCategorySelect(category._id)}
      >
        <Image source={{ uri: category.imageUrl }} style={styles.categoryImage} />
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemName}>{category.name}</Text>
          <Text style={styles.itemDescription}>{category.description || 'No description'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.container}>
        <Tab
          value={categoryIndex}
          onChange={setCategoryIndex}
          indicatorStyle={styles.tabIndicator}
        >
          <Tab.Item
            title="Default Categories"
            titleStyle={styles.tabTitle}
          />
        </Tab>

        <TabView value={categoryIndex} onChange={setCategoryIndex} animationType="spring">
          <TabView.Item style={styles.tabContent}>
            <ScrollView style={styles.scrollView}>
              {loading ? (
                <Text style={styles.loadingText}>Loading categories...</Text>
              ) : error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : (
                <>
                  {defaultCategories
                    .filter(dc => !branchCategories.some(bc => bc.defaultCategoryId === dc._id))
                    .map(renderCategoryItem)}
                  {selected.length > 0 && (
                    <View style={styles.importButtonContainer}>
                      <CustomButton
                        title="Import Selected Categories"
                        onPress={handleImport}
                      />
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </TabView.Item>
        </TabView>
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
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  categoryImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  itemTextContainer: {
    flex: 1,
  },
  selectedItem: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#6c757d',
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
});

export default DefaultCategories;
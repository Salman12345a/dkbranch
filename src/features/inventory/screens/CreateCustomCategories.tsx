import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Platform, Button } from 'react-native';
import CustomButton from '../../../components/ui/CustomButton';
import { useNavigation } from '@react-navigation/native';
import { InventoryItemDisplayNavigationProp } from '../../../navigation/types';
import { storage } from '../../../utils/storage';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import RNFS from 'react-native-fs';
import api from '../../../services/api';

const CreateCustomCategories = () => {
  const navigation = useNavigation<InventoryItemDisplayNavigationProp>();
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Request Android 13+ permissions for images/files
  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version < 33) {
      const result = await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
      return result === RESULTS.GRANTED;
    } else {
      const result = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
      return result === RESULTS.GRANTED;
    }
  };

  const handleNext = async () => {
    setError('');
    if (!categoryName.trim()) {
      setError('Please enter a category name');
      return;
    }
    setLoading(true);
    try {
      // 1. Request permission
      const permissionGranted = await requestStoragePermission();
      if (!permissionGranted) {
        setError('Storage permission is required to proceed.');
        setLoading(false);
        return;
      }
      // 2. Create category
      const branchId = storage.getString('userId');
      if (!branchId) throw new Error('Branch ID not found');
      const createRes = await api.post(`/branch/${branchId}/categories`, {
        branchId,
        name: categoryName.trim(),
      });
      console.log('Create category response:', createRes.data);
      if (!createRes.data || !createRes.data._id) {
        setError('Failed to create category. Please try again.');
        setLoading(false);
        return;
      }
      const categoryId = createRes.data._id;
      // 3. Get pre-signed URL
      const presignRes = await api.get(`/branch/${branchId}/categories/${categoryId}/image-upload-url?contentType=image/jpeg`);
      if (!presignRes.data || !presignRes.data.uploadUrl || !presignRes.data.key) {
        setError('Failed to get pre-signed URL. Please try again.');
        setLoading(false);
        return;
      }
      navigation.navigate('UploadCategoryImage', {
        uploadUrl: presignRes.data.uploadUrl,
        key: presignRes.data.key,
        categoryId,
        branchId,
      });
    } catch (err: any) {
      console.error('Create category error:', err);
      
      // Check for duplicate category error
      if (err?.response?.data?.message?.includes('already exists') || 
          err?.response?.data?.error?.includes('already exists') ||
          err?.message?.toLowerCase().includes('already exists')) {
        setError('Category already exists');
        Alert.alert(
          'Duplicate Category',
          'This category name already exists. Please use a different name.',
          [{ text: 'OK' }]
        );
      } else {
        setError(err?.response?.data?.message || err?.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Custom Category</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter category name"
        value={categoryName}
        onChangeText={setCategoryName}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <CustomButton title="Next" onPress={handleNext} />
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
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  error: {
    color: 'red',
    marginBottom: 16,
  },
});

export default CreateCustomCategories; 
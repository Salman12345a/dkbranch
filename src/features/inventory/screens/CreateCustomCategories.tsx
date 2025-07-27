import React, { useState } from 'react';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';

import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView, TouchableOpacity, Image, KeyboardAvoidingView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CustomButton from '../../../components/ui/CustomButton';
import { useNavigation } from '@react-navigation/native';
import { InventoryItemDisplayNavigationProp } from '../../../navigation/types';
import { storage } from '../../../utils/storage';


import api from '../../../services/api';

const CreateCustomCategories = () => {
  const navigation = useNavigation<InventoryItemDisplayNavigationProp>();
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<Asset | null>(null);
  const [error, setError] = useState('');

  // Resize/compress selected image to reduce crashes due to large files
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

  const pickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.5,
        maxWidth: 1200,
        maxHeight: 1200,
      });
      if (!result.didCancel && result.assets && result.assets.length > 0) {
        const compressed = await compressImage(result.assets[0]);
        setImage(compressed);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image');
      console.error('Image picker error:', err);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!categoryName.trim()) {
      setError('Please enter a category name');
      return;
    }
    setLoading(true);
    try {
      // 2. Build FormData and create category
      const branchId = storage.getString('userId');
      if (!branchId) throw new Error('Branch ID not found');
      const formData = new FormData();
      formData.append('name', categoryName.trim());
      if (image && image.uri) {
        formData.append('categoryImage', {
          uri: image.uri,
          name: image.fileName || 'image.jpg',
          type: image.type || 'image/jpeg',
        } as any);
      }
      const createRes = await api.post(`/branch/${branchId}/categories`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('Create category response:', createRes.data);
      if (!createRes.data || !createRes.data._id) {
        setError('Failed to create category. Please try again.');
        setLoading(false);
        return;
      }
      // success: refresh categories list and go back
      Alert.alert('Success', 'Category created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      return;
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Create Category</Text>

          <View style={styles.formWrapper}>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Enter category name"
            placeholderTextColor="#888"
            value={categoryName}
            onChangeText={setCategoryName}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image && image.uri ? (
              <Image
                source={{ uri: image.uri }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={32} color="#888" />
                <Text style={styles.imagePickerText}>Add Image</Text>
              </View>
            )}
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : (
            <CustomButton
              title="Create Category"
              onPress={handleSubmit}
            />
          )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1e1e1e',
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    elevation: 1,
  },
  inputError: {
    borderColor: 'red',
  },
  imagePicker: {
    width: '100%',
    height: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerText: {
    marginTop: 8,
    color: '#888',
    fontSize: 14,
  },
  formWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
});

export default CreateCustomCategories;
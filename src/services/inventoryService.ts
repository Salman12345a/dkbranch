import api from './api';
import {storage} from '../utils/storage';

export interface Category {
  _id: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  createdFromTemplate: boolean;
  defaultCategoryId?: string;
}

export interface Product {
  _id: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
  description?: string;
  price: number;
  discountPrice?: number;
  quantity?: string;
  unit?: string;
  isPacket?: boolean;
  isAvailable?: boolean;
  disabledReason?: string;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  createdFromTemplate: boolean;
  defaultProductId?: string; // ID of the original default product this was imported from
}

export interface CustomProductData {
  name: string;
  price: number;
  discountPrice?: number;
  quantity?: number;
  unit?: string;
  categoryId: string;
  branchId: string;
  isPacket?: boolean;
  description?: string;
}

export const inventoryService = {
  // Category related APIs
  getDefaultCategories: async () => {
    try {
      const response = await api.get('/admin/default-categories');
      // Ensure all categories from this endpoint have createdFromTemplate set to true
      return response.data.map((category: Category) => ({
        ...category,
        createdFromTemplate: true
      }));
    } catch (error) {
      throw error;
    }
  },

  getCustomCategories: async (branchId: string) => {
    try {
      const response = await api.get(`/branch/${branchId}/categories`);
      // Ensure all categories from this endpoint have createdFromTemplate set to false
      return response.data.map((category: Category) => ({
        ...category,
        createdFromTemplate: false
      }));
    } catch (error) {
      throw error;
    }
  },

  importDefaultCategories: async (branchId: string, categoryIds: string[]) => {
    try {
      const response = await api.post(`/branch/${branchId}/categories/import-default`, {
        categoryIds,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Product related APIs
  getDefaultProducts: async (defaultCategoryId: string) => {
    try {
      const response = await api.get(`/admin/default-categories/${defaultCategoryId}/products`);
      // Ensure all products from this endpoint have createdFromTemplate set to true
      return response.data.map((product: Product) => ({
        ...product,
        createdFromTemplate: true
      }));
    } catch (error) {
      throw error;
    }
  },

  getCustomProducts: async (branchId: string, categoryId: string) => {
    try {
      console.log(`Fetching custom products for branch ${branchId} and category ${categoryId}`);
      const response = await api.get(`/branch/${branchId}/categories/${categoryId}/products`);
      
      // Add detailed debug logging
      console.log('API Response status:', response.status);
      console.log('API Response structure:', Object.keys(response.data));
      console.log('Response data type:', typeof response.data);
      
      // Handle the new response structure properly
      if (response.data && response.data.status === 'SUCCESS' && response.data.data && response.data.data.products) {
        // New API format with nested structure
        console.log('Using new API format with data.data.products');
        const productsArray = response.data.data.products;
        
        // Log the number of products and sample
        console.log(`Total products from API: ${productsArray.length}`);
        if (productsArray.length > 0) {
          console.log('Sample product:', JSON.stringify(productsArray[0]));
        }
        
        // Filter to only include products that are not created from template
        const customProducts = productsArray.filter((product: Product) => 
          product.createdFromTemplate === false
        );
        
        console.log(`Found ${customProducts.length} custom products out of ${productsArray.length} total`);
        
        // Return products, ensuring createdFromTemplate is explicitly set to false
        return customProducts.map((product: Product) => ({
          ...product,
          createdFromTemplate: false
        }));
      } else if (Array.isArray(response.data)) {
        // Old API format with direct array
        console.log('Using old API format with direct array');
        const productsArray = response.data;
        
        // Filter to only include products that are not created from template
        const customProducts = productsArray.filter((product: Product) => 
          product.createdFromTemplate === false
        );
        
        console.log(`Found ${customProducts.length} custom products out of ${productsArray.length} total`);
        
        // Return products, ensuring createdFromTemplate is explicitly set to false
        return customProducts.map((product: Product) => ({
          ...product,
          createdFromTemplate: false
        }));
      } else if (response.data && response.data.products && Array.isArray(response.data.products)) {
        // Alternative format with data.products
        console.log('Using alternative API format with data.products');
        const productsArray = response.data.products;
        
        // Filter to only include products that are not created from template
        const customProducts = productsArray.filter((product: Product) => 
          product.createdFromTemplate === false
        );
        
        console.log(`Found ${customProducts.length} custom products out of ${productsArray.length} total`);
        
        // Return products, ensuring createdFromTemplate is explicitly set to false
        return customProducts.map((product: Product) => ({
          ...product,
          createdFromTemplate: false
        }));
      } else {
        // Unexpected format, log details and return empty array
        console.error('Unexpected API response format:', JSON.stringify(response.data));
        return [];
      }
    } catch (error) {
      console.error('Error fetching custom products:', error);
      throw error;
    }
  },

  // Get branch-specific products for a category (both default and custom)
  getBranchCategoryProducts: async (branchId: string, categoryId: string) => {
    try {
      console.log(`Fetching all category products for branch ${branchId} and category ${categoryId}`);
      const response = await api.get(`/branch/${branchId}/categories/${categoryId}/products`);
      
      // Add detailed debug logging
      console.log('API Response status:', response.status);
      console.log('API Response structure:', Object.keys(response.data));
      console.log('Response data type:', typeof response.data);
      
      // Handle the new response structure properly
      if (response.data && response.data.status === 'SUCCESS' && response.data.data && response.data.data.products) {
        // New API format with nested structure
        console.log('Using new API format with data.data.products');
        const productsArray = response.data.data.products;
        console.log(`Found ${productsArray.length} total products in category`);
        return productsArray;
      } else if (Array.isArray(response.data)) {
        // Old API format with direct array
        console.log('Using old API format with direct array');
        const productsArray = response.data;
        console.log(`Found ${productsArray.length} total products in category`);
        return productsArray;
      } else if (response.data && response.data.products && Array.isArray(response.data.products)) {
        // Alternative format with data.products
        console.log('Using alternative API format with data.products');
        const productsArray = response.data.products;
        console.log(`Found ${productsArray.length} total products in category`);
        return productsArray;
      } else {
        // Unexpected format, log details and return empty array
        console.error('Unexpected API response format:', JSON.stringify(response.data));
        return [];
      }
    } catch (error) {
      console.error('Error fetching category products:', error);
      throw error;
    }
  },

  importDefaultProducts: async (branchId: string, categoryId: string, productIds: string[]) => {
    try {
      const response = await api.post(`/branch/${branchId}/categories/${categoryId}/import-products`, {
        productIds,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get default products that haven't been imported by the branch yet
  getNonImportedDefaultProducts: async (branchId: string, categoryId: string, defaultCategoryId: string) => {
    try {
      // First, get all default products for this category
      const defaultResponse = await api.get(
        `/admin/default-categories/${defaultCategoryId}/products`
      );
      const defaultProducts = defaultResponse.data.map((product: Product) => ({
        ...product,
        createdFromTemplate: true
      }));
      
      // Then, get all products that have already been imported to this branch's category
      const importedResponse = await api.get(`/branch/${branchId}/categories/${categoryId}/products`);
      
      // Extract the imported products depending on the response format
      let importedProducts: Product[] = [];
      if (importedResponse.data && importedResponse.data.status === 'SUCCESS' && 
          importedResponse.data.data && importedResponse.data.data.products) {
        // New API format with nested structure
        importedProducts = importedResponse.data.data.products;
      } else if (Array.isArray(importedResponse.data)) {
        // Old API format with direct array
        importedProducts = importedResponse.data;
      } else if (importedResponse.data && importedResponse.data.products && 
                Array.isArray(importedResponse.data.products)) {
        // Alternative format with data.products
        importedProducts = importedResponse.data.products;
      }
      
      // Create a set of imported product IDs for faster lookup
      const importedProductIds = new Set(
        importedProducts
          .filter((product: Product) => product.createdFromTemplate)
          .map((product: Product) => product.defaultProductId || product._id)
      );
      
      console.log(`Found ${defaultProducts.length} default products and ${importedProductIds.size} already imported products`);
      
      // Filter out the products that have already been imported
      const nonImportedProducts = defaultProducts.filter(
        (product: Product) => !importedProductIds.has(product._id)
      );
      
      console.log(`Returning ${nonImportedProducts.length} non-imported products`);
      return nonImportedProducts;
    } catch (error) {
      console.error('Error fetching non-imported default products:', error);
      throw error;
    }
  },

  // Custom Product APIs
  createCustomProduct: async (productData: CustomProductData) => {
    try {
      console.log(`Creating custom product for branch: ${productData.branchId}`);
      console.log('Request payload:', JSON.stringify(productData));
      
      // Make sure all required fields are present according to the API example
      const payload = {
        name: productData.name,
        price: productData.price,
        discountPrice: productData.discountPrice || 90,
        quantity: productData.quantity || 10,
        unit: productData.unit || 'kg',
        categoryId: productData.categoryId,
        branchId: productData.branchId,
        isPacket: productData.isPacket !== undefined ? productData.isPacket : false,
        description: productData.description || 'Test product description'
      };
      
      const response = await api.post(`/branch/${productData.branchId}/products`, payload);
      console.log('Create product response:', JSON.stringify(response.data));
      return response.data;
    } catch (error: any) {
      console.error('Error creating custom product:', error.response?.data || error.message);
      throw error;
    }
  },

  getProductImageUploadUrl: async (branchId: string, productId: string) => {
    try {
      console.log(`Getting image upload URL for product ${productId} in branch ${branchId}`);
      
      // The API endpoint might expect a query parameter for content type
      const response = await api.get(`/branch/${branchId}/products/${productId}/image-upload-url`, {
        params: {
          contentType: 'image/jpeg' // Explicitly specify content type as a parameter
        }
      });
      
      console.log('Image upload URL response:', JSON.stringify(response.data));
      return response.data;
    } catch (error: any) {
      console.error('Error getting image upload URL:', error.response?.data || error.message);
      throw error;
    }
  },

  updateProductImageUrl: async (productId: string, imageKey: string) => {
    try {
      const branchId = storage.getString('userId');
      if (!branchId) throw new Error('Branch ID not found');
      
      const response = await api.post(`/branch/products/${productId}/image-url`, {
        key: imageKey
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  uploadImageToPresignedUrl: async (presignedUrl: string, imageUri: string) => {
    try {
      // Determine content type based on image URI extension
      let contentType = 'image/jpeg';
      if (imageUri.toLowerCase().endsWith('.png')) {
        contentType = 'image/png';
      } else if (imageUri.toLowerCase().endsWith('.jpg') || imageUri.toLowerCase().endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      }
      
      console.log('Uploading image with content type:', contentType);
      
      // Convert image URI to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      // Upload to presigned URL using fetch with PUT method
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': contentType
        }
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload error response:', errorText);
        throw new Error(`Failed to upload image: ${uploadResponse.status} - ${errorText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error in uploadImageToPresignedUrl:', error);
      throw error;
    }
  },

  // Remove imported default products
  removeImportedProducts: async (branchId: string, productIds: string[], reason?: string) => {
    try {
      console.log(`Removing imported products for branch ${branchId}, products: ${productIds.join(', ')}`);
      
      const payload: { productIds: string[], reason?: string } = {
        productIds
      };
      
      // Add reason if provided
      if (reason && reason.trim()) {
        payload.reason = reason.trim();
      }
      
      const response = await api.put(`/branch/${branchId}/products/remove-imported`, payload);
      console.log('Remove products response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error removing imported products:', error.response?.data || error.message);
      throw error;
    }
  },
  deleteCustomCategories: async (branchId: string, categoryIds: string[]) => {
    try {
      const response = await api.delete(`/branch/${branchId}/categories/custom`, {
        data: { categoryIds }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting custom categories:', error);
      throw error;
    }
  },
  deleteCustomProducts: async (branchId: string, productIds: string[]) => {
    try {
      console.log(`Deleting custom products for branch ${branchId}, products: ${productIds.join(', ')}`);
      
      const response = await api.delete(`/branch/${branchId}/products/custom`, {
        data: { productIds }
      });
      
      console.log('Delete custom products response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error deleting custom products:', error.response?.data || error.message);
      throw error;
    }
  },
};



export default inventoryService;
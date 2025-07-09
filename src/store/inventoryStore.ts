import { create } from 'zustand';
import { Category, Product, inventoryService } from '../services/inventoryService';

interface InventoryState {
  // Categories State
  categories: {
    branch: {
      items: Category[];
      selected: string[];
      loading: boolean;
      error: string | null;
    };
    activeTab: 'default' | 'custom';
  };

  // Products State
  products: {
    default: {
      items: Record<string, Product[]>;
      selected: Record<string, string[]>;
      loading: boolean;
      error: string | null;
    };
    custom: {
      items: Record<string, Product[]>;
      selected: Record<string, string[]>;
      loading: boolean;
      error: string | null;
    };
    activeTab: 'default' | 'custom';
    selectedCategory: string | null;
  };

  // Actions
  setActiveCategoryTab: (tab: 'default' | 'custom') => void;
  setActiveProductTab: (tab: 'default' | 'custom') => void;
  setSelectedCategory: (categoryId: string | null) => void;
  
  // Category Actions
  fetchBranchCategories: (branchId: string) => Promise<void>;
  
  // Product Actions
  fetchDefaultProducts: (categoryId: string) => Promise<void>;
  fetchCustomProducts: (branchId: string, categoryId: string) => Promise<void>;
  fetchBranchCategoryProducts: (branchId: string, categoryId: string) => Promise<void>;
  toggleProductSelection: (productId: string, categoryId: string) => void;
  importSelectedProducts: (branchId: string, categoryId: string) => Promise<void>;
  clearProductSelections: (categoryId: string) => void;
  deleteCustomProducts: (branchId: string, productIds: string[], categoryId: string) => Promise<void>;
}

const useInventoryStore = create<InventoryState>()((set, get) => ({
  // Initial Categories State
  categories: {
    branch: {
      items: [],
      selected: [],
      loading: false,
      error: null,
    },
    activeTab: 'default',
  },

  // Initial Products State
  products: {
    default: {
      items: {},
      selected: {},
      loading: false,
      error: null,
    },
    custom: {
      items: {},
      selected: {},
      loading: false,
      error: null,
    },
    activeTab: 'default',
    selectedCategory: null,
  },

  // Tab Actions
  setActiveCategoryTab: (tab: 'default' | 'custom') => 
    set((state) => ({ categories: { ...state.categories, activeTab: tab } })),
  
  setActiveProductTab: (tab: 'default' | 'custom') =>
    set((state) => ({ products: { ...state.products, activeTab: tab } })),
  
  setSelectedCategory: (categoryId: string | null) =>
    set((state) => ({ 
      products: { 
        ...state.products, 
        selectedCategory: categoryId,
        selected: {} // Clear product selections when changing category
      } 
    })),

  // Category Actions
  fetchBranchCategories: async (branchId: string) => {
    set((state) => ({
      categories: {
        ...state.categories,
        branch: { ...state.categories.branch, loading: true, error: null }
      }
    }));
    try {
      const categories = await inventoryService.getCustomCategories(branchId);
      set((state) => ({
        categories: {
          ...state.categories,
          branch: {
            ...state.categories.branch,
            items: categories,
            loading: false
          }
        }
      }));
    } catch (err: any) {
      const error = err?.message || 'Failed to fetch branch categories';
      set((state) => ({
        categories: {
          ...state.categories,
          branch: {
            ...state.categories.branch,
            error,
            loading: false
          }
        }
      }));
    }
  },

  // Product Actions
  fetchDefaultProducts: async (categoryId: string) => {
    set((state) => ({
      products: {
        ...state.products,
        default: { ...state.products.default, loading: true, error: null }
      }
    }));

    try {
      const products = await inventoryService.getDefaultProducts(categoryId);
      set((state) => ({
        products: {
          ...state.products,
          default: {
            ...state.products.default,
            items: {
              ...state.products.default.items,
              [categoryId]: products
            },
            loading: false
          }
        }
      }));
    } catch (err: any) {
      const error = err?.message || 'Failed to fetch products';
      set((state) => ({
        products: {
          ...state.products,
          default: {
            ...state.products.default,
            error,
            loading: false
          }
        }
      }));
    }
  },

  fetchCustomProducts: async (branchId: string, categoryId: string) => {
    set((state) => ({
      products: {
        ...state.products,
        custom: { ...state.products.custom, loading: true, error: null }
      }
    }));

    try {
      const products = await inventoryService.getCustomProducts(branchId, categoryId);
      set((state) => ({
        products: {
          ...state.products,
          custom: {
            ...state.products.custom,
            items: {
              ...state.products.custom.items,
              [categoryId]: products
            },
            loading: false
          }
        }
      }));
    } catch (err: any) {
      const error = err?.message || 'Failed to fetch custom products';
      set((state) => ({
        products: {
          ...state.products,
          custom: {
            ...state.products.custom,
            error,
            loading: false
          }
        }
      }));
    }
  },

  fetchBranchCategoryProducts: async (branchId: string, categoryId: string) => {
    set((state) => ({
      products: {
        ...state.products,
        default: { ...state.products.default, loading: true, error: null }
      }
    }));

    try {
      const products = await inventoryService.getBranchCategoryProducts(branchId, categoryId);
      set((state) => ({
        products: {
          ...state.products,
          default: {
            ...state.products.default,
            items: {
              ...state.products.default.items,
              [categoryId]: products
            },
            loading: false
          }
        }
      }));
    } catch (err: any) {
      const error = err?.message || 'Failed to fetch branch category products';
      set((state) => ({
        products: {
          ...state.products,
          default: {
            ...state.products.default,
            error,
            loading: false
          }
        }
      }));
    }
  },

  toggleProductSelection: (productId: string, categoryId: string) =>
    set((state) => {
      const activeTab = state.products.activeTab;
      const selected = state.products[activeTab].selected[categoryId] || [];
      const newSelected = selected.includes(productId)
        ? selected.filter(id => id !== productId)
        : [...selected, productId];

      return {
        products: {
          ...state.products,
          [activeTab]: {
            ...state.products[activeTab],
            selected: {
              ...state.products[activeTab].selected,
              [categoryId]: newSelected
            }
          }
        }
      };
    }),

  importSelectedProducts: async (branchId: string, categoryId: string) => {
    const { selected } = get().products.default;
    const categorySelected = selected[categoryId] || [];
    
    if (categorySelected.length === 0) {
      throw new Error('No products selected for import');
    }

    set((state) => ({
      products: {
        ...state.products,
        default: { ...state.products.default, loading: true, error: null }
      }
    }));

    try {
      await inventoryService.importDefaultProducts(branchId, categoryId, categorySelected);
      
      // Clear only the selections for this category
      set((state) => ({
        products: {
          ...state.products,
          default: {
            ...state.products.default,
            selected: {
              ...state.products.default.selected,
              [categoryId]: []
            },
            loading: false
          }
        }
      }));

      // Refresh the products for this category
      await get().fetchBranchCategoryProducts(branchId, categoryId);
    } catch (err: any) {
      const error = err?.message || 'Failed to import products';
      set((state) => ({
        products: {
          ...state.products,
          default: {
            ...state.products.default,
            error,
            loading: false
          }
        }
      }));
      throw error;
    }
  },

  clearProductSelections: (categoryId: string) =>
    set((state) => ({
      products: {
        ...state.products,
        [state.products.activeTab]: {
          ...state.products[state.products.activeTab],
          selected: {
            ...state.products[state.products.activeTab].selected,
            [categoryId]: []
          }
        }
      }
    })),
    
  // Custom products deletion function
  deleteCustomProducts: async (branchId: string, productIds: string[], categoryId: string) => {
    if (productIds.length === 0) {
      throw new Error('No products selected for deletion');
    }

    set((state) => ({
      products: {
        ...state.products,
        custom: { ...state.products.custom, loading: true, error: null }
      }
    }));

    try {
      // Call the service method to delete the custom products
      await inventoryService.deleteCustomProducts(branchId, productIds);
      
      // After successful deletion, refresh the product list by removing deleted products
      set((state) => {
        // If we have products for this category, filter out the deleted ones
        const currentCategoryProducts = state.products.custom.items[categoryId] || [];
        const updatedProducts = currentCategoryProducts.filter(
          product => !productIds.includes(product._id)
        );
        
        return {
          products: {
            ...state.products,
            custom: {
              ...state.products.custom,
              items: {
                ...state.products.custom.items,
                [categoryId]: updatedProducts
              },
              // Clear selections for this category
              selected: {
                ...state.products.custom.selected,
                [categoryId]: []
              },
              loading: false
            }
          }
        };
      });
      
      // Return success
      return;
    } catch (err: any) {
      const error = err?.message || 'Failed to delete custom products';
      set((state) => ({
        products: {
          ...state.products,
          custom: {
            ...state.products.custom,
            error,
            loading: false
          }
        }
      }));
      throw error;
    }
  },
}));

export default useInventoryStore;
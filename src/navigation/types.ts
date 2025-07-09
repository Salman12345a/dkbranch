import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {Order} from '../store/ordersStore';

export type RootStackParamList = {
  HomeScreen: undefined;
  SplashScreen: undefined;
  EntryScreen: undefined;
  Authentication: undefined;
  OTPVerification: {
    phone: string;
    sessionId?: string;
    validityPeriod?: number;
    retryAfter?: number;
    formData?: any;
    branchId?: string;
    isResubmit?: boolean;
    isLogin: boolean;
  };
  UserDetails: undefined;
  PhoneNumberScreen: {
    formData?: any;
    branchId?: string;
    isResubmit?: boolean;
  };
  Main: undefined;
  AddProduct: undefined;
  Finance: undefined;
  DeliveryService: undefined;
  DeliveryPartnerAuth: undefined;
  DeliveryStatus: undefined;
  DeliveryReRegister: undefined;
  ReUploadDocuments: undefined;
  ReUploadPartnerPhoto: undefined;
  UploadDocuments: undefined;
  UploadPartnerPhoto: undefined;
  SuccessScreen: undefined;
  AssignDeliveryPartner: {order: Order};
  OrderDetail: {order: Order; fromPackedTab?: boolean};
  OrderHasPacked: undefined;
  MainPackedScreen: undefined;
  BranchAuth: {
    branchId?: string;
    isResubmit?: boolean;
  };
  UploadBranchDocs: {
    formData?: any;
    branchId?: string;
    isResubmit?: boolean;
  };
  StatusScreen: {branchId: string};
  SalesSummary: undefined;
  Order: undefined;
  Wallet: undefined;
  OrderHistory: undefined;

  RegisteredBranchDetails: {
    phone: string;
    formData: any;
    branchId?: string;
    isResubmit?: boolean;
  };
  DefaultCategories: undefined;
  InventoryItemDisplay: { refresh?: boolean; refreshTimestamp?: number } | undefined;
  CreateCustomCategories: undefined;
  UploadCategoryImage: { uploadUrl: string; key: string; categoryId: string; branchId: string };
  ProductsScreen: { categoryId: string; categoryName: string; isDefault: boolean; refresh?: boolean; refreshTimestamp?: number; defaultCategoryId?: string };
  SelectDefaultProducts: { categoryId: string; categoryName: string; defaultCategoryId?: string };
  CustomProducts: { categoryId: string; categoryName: string; isCustom: boolean };
  UploadProductImage: { productId: string; uploadUrl: string; key: string; branchId: string; categoryId: string; categoryName: string };
  EditProductDetails: { productId: string; categoryId: string; categoryName: string };
  DisabledProducts: undefined;
};

export type StatusScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'StatusScreen'
>;
export type StatusScreenRouteProp = RouteProp<
  RootStackParamList,
  'StatusScreen'
>;

export type DefaultCategoriesNavigationProp = StackNavigationProp<
  RootStackParamList,
  'DefaultCategories'
>;

export type InventoryItemDisplayNavigationProp = StackNavigationProp<
  RootStackParamList,
  'InventoryItemDisplay'
>;

export type ProductsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ProductsScreen'
>;

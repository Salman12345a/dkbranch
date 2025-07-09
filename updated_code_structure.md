# SyncMart Owner App - Updated Code Structure

This document outlines the reorganized code structure for the SyncMart Owner App to improve maintainability and scalability.

```
src/
├── assets/                    # Static assets (unchanged)
│   ├── animations/           # Animation JSON files
│   ├── category/             # Category images
│   ├── fonts/                # Custom fonts
│   ├── icons/                # App icons
│   ├── images/               # General images
│   └── products/             # Product images
├── components/                # Reorganized component structure
│   ├── common/               # Common components used across multiple features
│   │   ├── Header.tsx        # Main header component
│   │   └── UniversalAdd.tsx  # Quantity adjustment component
│   ├── order/                # Order-related components
│   │   └── OrderCard.tsx     # Displays individual orders
│   ├── branch/               # Branch-related components
│   │   └── StoreStatus.tsx   # Shows store status
│   ├── delivery/             # Delivery-related components
│   │   └── DeliveryServiceToggle.tsx  # Toggle for delivery service
│   └── financial/            # Financial components
│       └── FinancialSummary.tsx  # Financial summary component
├── features/                 # Feature-based organization
│   ├── auth/                 # Authentication features
│   │   └── screens/
│   │       ├── AuthenticationScreen.tsx  # Main authentication screen
│   │       ├── EntryScreen.tsx           # Entry screen for registration/login
│   │       ├── PhoneNumberScreen.tsx     # Phone number collection screen
│   │       └── UserDetailsScreen.tsx     # User details screen
│   ├── branch/               # Branch management features
│   │   └── screens/
│   │       ├── BranchAuth.tsx            # Branch authentication screen
│   │       ├── StatusScreen.tsx          # Branch registration status screen
│   │       └── UploadBranchDocs.tsx      # Document upload for branch registration
│   ├── orders/               # Order management features
│   │   └── screens/
│   │       ├── HomeScreen.tsx            # Main orders dashboard
│   │       ├── OrderDetail.tsx           # Order details screen
│   │       ├── OrderHasPacked.tsx        # Order packed confirmation screen
│   │       ├── OrderManagementScreen.js  # Order management screen
│   │       └── OrderPackedScreen.tsx     # Packed orders management screen
│   ├── delivery/             # Delivery management features
│   │   └── screens/
│   │       ├── AssignDeliveryPartner.tsx  # Assign delivery partner screen
│   │       ├── DeliveryPartnerAuth.tsx    # Delivery partner authentication
│   │       ├── DeliveryReRegister.tsx     # Delivery partner re-registration
│   │       ├── DeliveryService.tsx        # Delivery service management
│   │       ├── DeliveryStatus.tsx         # Delivery status tracking
│   │       ├── ReUploadDocuments.tsx      # Re-upload documents screen
│   │       ├── ReUploadPartnerPhoto.tsx   # Re-upload partner photo screen
│   │       ├── SuccessScreen.tsx          # Success confirmation screen
│   │       ├── UploadDocuments.tsx        # Document upload screen
│   │       └── UploadPartnerPhoto.tsx     # Partner photo upload screen
│   ├── inventory/            # Inventory management features
│   │   └── screens/
│   │       ├── AddProduct.tsx             # Add product screen
│   │       └── InventoryItemDisplay.tsx   # Inventory item display screen
│   ├── financial/            # Financial management features
│   │   └── screens/
│   │       ├── FinancialSummaryScreen.js  # Financial summary screen
│   │       └── WalletScreen.tsx           # Wallet management screen
│   └── common/               # Common/shared screens
│       └── screens/
│           ├── SplashScreen.tsx           # App splash screen
│           └── HelpScreen.tsx             # Help and support screen
├── navigation/               # Navigation setup
│   ├── AppNavigator.tsx      # Main stack navigator
│   ├── BottomTabNavigator.tsx  # Bottom tab navigation
│   └── Sidebar.tsx           # Drawer navigation
├── services/                 # API and utility services
│   ├── api.ts                # API integration services
│   └── socket.ts             # Socket.IO integration
├── store/                    # State management
│   ├── ordersStore.ts        # Orders state management
│   ├── authStore.ts          # Authentication state management
│   ├── branchStore.ts        # Branch state management
│   ├── deliveryStore.ts      # Delivery state management
│   └── index.ts              # Export all stores
├── utils/                    # Utility functions
└── App.tsx                   # Root component
```

## Key Benefits of This Structure

1. **Feature-Based Organization**: All related screens and components are grouped by feature domain, making it easier to locate and work on specific features.

2. **Improved Scalability**: Each feature can be developed and scaled independently without affecting other parts of the application.

3. **Better Maintainability**: Clear separation of concerns makes the codebase easier to maintain and understand.

4. **Reduced Conflicts**: By organizing files by feature, the risk of merge conflicts during collaborative development is reduced.

5. **Easier Navigation**: Developers can quickly find relevant files by looking in the appropriate feature directory.

## Implementation Notes

1. All imports will need to be updated to reflect the new file paths.
2. The navigation structure will need to be updated to reference screens from their new locations.
3. No functionality changes are required - this is purely a structural reorganization.

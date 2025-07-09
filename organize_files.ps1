# PowerShell script to organize SyncMart Owner App files
# This script will create the feature-based structure and move files to their new locations

# Create feature directories if they don't exist
$featureDirs = @(
    "src\features\auth\screens",
    "src\features\branch\screens",
    "src\features\orders\screens",
    "src\features\delivery\screens",
    "src\features\inventory\screens",
    "src\features\financial\screens",
    "src\features\common\screens"
)

foreach ($dir in $featureDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force
        Write-Host "Created directory: $dir"
    }
}

# Create component directories if they don't exist
$componentDirs = @(
    "src\components\common",
    "src\components\order",
    "src\components\branch",
    "src\components\delivery",
    "src\components\financial"
)

foreach ($dir in $componentDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force
        Write-Host "Created directory: $dir"
    }
}

# Move auth-related screens
$authScreens = @(
    "AuthenticationScreen.tsx",
    "EntryScreen.tsx",
    "PhoneNumberScreen.tsx",
    "UserDetailsScreen.tsx"
)

foreach ($file in $authScreens) {
    Move-Item -Path "src\screens\$file" -Destination "src\features\auth\screens\" -Force
    Write-Host "Moved $file to auth screens"
}

# Move branch-related screens
$branchScreens = @(
    "BranchAuth.tsx",
    "StatusScreen.tsx",
    "UploadBranchDocs.tsx"
)

foreach ($file in $branchScreens) {
    Move-Item -Path "src\screens\$file" -Destination "src\features\branch\screens\" -Force
    Write-Host "Moved $file to branch screens"
}

# Move order-related screens
$orderScreens = @(
    "HomeScreen.tsx",
    "OrderDetail.tsx",
    "OrderHasPacked.tsx",
    "OrderPackedScreen.tsx",
    "OrderManagementScreen.js"
)

foreach ($file in $orderScreens) {
    Move-Item -Path "src\screens\$file" -Destination "src\features\orders\screens\" -Force
    Write-Host "Moved $file to order screens"
}

# Move delivery-related screens
$deliveryScreens = @(
    "AssignDeliveryPartner.tsx",
    "DeliveryPartnerAuth.tsx",
    "DeliveryReRegister.tsx",
    "DeliveryService.tsx",
    "DeliveryStatus.tsx",
    "ReUploadDocuments.tsx",
    "ReUploadPartnerPhoto.tsx",
    "SuccessScreen.tsx",
    "UploadDocuments.tsx",
    "UploadPartnerPhoto.tsx"
)

foreach ($file in $deliveryScreens) {
    Move-Item -Path "src\screens\$file" -Destination "src\features\delivery\screens\" -Force
    Write-Host "Moved $file to delivery screens"
}

# Move inventory-related screens
$inventoryScreens = @(
    "AddProduct.tsx",
    "InventoryItemDisplay.tsx"
)

foreach ($file in $inventoryScreens) {
    Move-Item -Path "src\screens\$file" -Destination "src\features\inventory\screens\" -Force
    Write-Host "Moved $file to inventory screens"
}

# Move financial-related screens
$financialScreens = @(
    "FinancialSummaryScreen.js",
    "WalletScreen.tsx"
)

foreach ($file in $financialScreens) {
    Move-Item -Path "src\screens\$file" -Destination "src\features\financial\screens\" -Force
    Write-Host "Moved $file to financial screens"
}

# Move common screens
$commonScreens = @(
    "SplashScreen.tsx",
    "HelpScreen.tsx"
)

foreach ($file in $commonScreens) {
    Move-Item -Path "src\screens\$file" -Destination "src\features\common\screens\" -Force
    Write-Host "Moved $file to common screens"
}

# Move components to their new locations
if (Test-Path "src\components\Header.tsx") {
    Move-Item -Path "src\components\Header.tsx" -Destination "src\components\common\" -Force
}
if (Test-Path "src\components\dashboard\OrderCard.tsx") {
    Move-Item -Path "src\components\dashboard\OrderCard.tsx" -Destination "src\components\order\" -Force
}
if (Test-Path "src\components\dashboard\StoreStatus.tsx") {
    Move-Item -Path "src\components\dashboard\StoreStatus.tsx" -Destination "src\components\branch\" -Force
}
if (Test-Path "src\components\delivery\DeliveryServiceToggle.tsx") {
    Move-Item -Path "src\components\delivery\DeliveryServiceToggle.tsx" -Destination "src\components\delivery\" -Force
}
if (Test-Path "src\components\storemanage\FinancialSummary.tsx") {
    Move-Item -Path "src\components\storemanage\FinancialSummary.tsx" -Destination "src\components\financial\" -Force
}
if (Test-Path "src\components\ui\UniversalAdd.tsx") {
    Move-Item -Path "src\components\ui\UniversalAdd.tsx" -Destination "src\components\common\" -Force
}

Write-Host "File organization complete. The files have been moved to their new locations."
Write-Host "Now updating AppNavigator.tsx to reference the new file locations..."

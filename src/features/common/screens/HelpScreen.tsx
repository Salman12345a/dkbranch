import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

const HelpScreen = () => {
  const navigation = useNavigation();

  const handlePhoneCall = () => {
    Linking.openURL('tel:+918121700697');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:dokiranaorg@gmail.com');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#340e5c" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container}>
        {/* Customer Care Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="support-agent" size={24} color="#340e5c" />
            <Text style={styles.sectionTitle}>Customer Care</Text>
          </View>
          
          <Text style={styles.description}>
            Our customer support team is available to help you with any questions or issues.
          </Text>

          {/* Phone Number */}
          <TouchableOpacity
            style={styles.contactItem}
            onPress={handlePhoneCall}
          >
            <View style={styles.contactIconContainer}>
              <Icon name="phone" size={22} color="#340e5c" />
            </View>
            <View style={styles.contactDetails}>
              <Text style={styles.contactLabel}>Phone Number</Text>
              <Text style={styles.contactValue}>+91 8121 700 697</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#888" />
          </TouchableOpacity>

          {/* Email */}
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={handleEmail}
          >
            <View style={styles.contactIconContainer}>
              <Icon name="email" size={22} color="#340e5c" />
            </View>
            <View style={styles.contactDetails}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>dokiranaorg@gmail.com</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="help-outline" size={24} color="#340e5c" />
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I update my store information?</Text>
            <Text style={styles.faqAnswer}>You can update your store information from the Store Settings section in the app's main menu.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I add custom products?</Text>
            <Text style={styles.faqAnswer}>Navigate to Inventory {">"}  Categories {">"}  select a category {">"}  Custom Products tab {">"}  Add Product.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Why is my order not showing up?</Text>
            <Text style={styles.faqAnswer}>Make sure your store is set to "Open" status and check your internet connection. If problems persist, contact our support team.</Text>
          </View>
        </View>

        {/* FAQ Section - Store Setup */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="store" size={24} color="#340e5c" />
            <Text style={styles.sectionTitle}>Setting Up Your Digital Store</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I set up my store profile?</Text>
            <Text style={styles.faqAnswer}>Open the main menu {">"} tap "Store Management" {">"} select "Store Profile". Here you can set your store name, address, operating hours, and upload your store logo.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I add products to my store?</Text>
            <Text style={styles.faqAnswer}>You can add products in two ways: (1) Select from default product catalog: Open main menu {">"} "Store Management" {">"} "Inventory" {">"} "Categories" {">"} select a category {">"} use the Default tab and select products. (2) Create custom products: Follow the same path but use the Custom Products tab to create your own unique products.</Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What's the difference between default and custom products?</Text>
            <Text style={styles.faqAnswer}>Default products are pre-defined in our catalog and used by multiple stores. Custom products are created by you specifically for your store with unique names, prices, and details.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I set up delivery for my store?</Text>
            <Text style={styles.faqAnswer}>Access "Delivery Service" from the main menu to register delivery partners, set delivery areas, and manage delivery settings. You can also set up self-pickup options in your store settings.</Text>
          </View>
        </View>

        {/* FAQ Section - Order Management */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="receipt" size={24} color="#340e5c" />
            <Text style={styles.sectionTitle}>Managing Orders</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I know when I receive a new order?</Text>
            <Text style={styles.faqAnswer}>When your store is open, new orders will appear on the Home screen with a notification sound. Make sure your app is running and your store status is set to "Open" to receive orders.</Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I manage loose vs. packed products in orders?</Text>
            <Text style={styles.faqAnswer}>When modifying an order with loose products (sold by weight/quantity), you'll see a toggle switch next to loose items. You can mark them as unavailable if you're out of stock, while packed products use the +/- buttons to adjust quantities.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What do I do when an order is ready for pickup or delivery?</Text>
            <Text style={styles.faqAnswer}>Open the order {">"} tap "Mark as Packed" when items are ready. For delivery orders, you'll be prompted to assign a delivery partner. For pickup orders, the customer will be notified that their order is ready.</Text>
          </View>
        </View>

        {/* FAQ Section - Inventory & Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="inventory" size={24} color="#340e5c" />
            <Text style={styles.sectionTitle}>Inventory Management</Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I create custom categories?</Text>
            <Text style={styles.faqAnswer}>Navigate to Store Management {">"} Inventory {">"} Categories {">"} tap "+" button {">"} enter category details and upload an image. Custom categories can contain your own products that aren't in the default catalog.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I manage product visibility?</Text>
            <Text style={styles.faqAnswer}>To temporarily disable a product, open the product details and toggle "Available" off. To view all disabled products, open the main menu and tap "Disabled Products" where you can re-enable them when needed.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I update prices of multiple products at once?</Text>
            <Text style={styles.faqAnswer}>Currently, prices need to be updated individually by editing each product. Go to the product listing, tap on the product you want to edit, then update the price and save changes.</Text>
          </View>
        </View>

        {/* FAQ Section - Payments & Financial */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="payments" size={24} color="#340e5c" />
            <Text style={styles.sectionTitle}>Payments & Finances</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I check my store earnings?</Text>
            <Text style={styles.faqAnswer}>On the Home screen, tap "View" next to "Check Today's Sales" to see your daily sales summary. For more detailed financial information, access the Wallet section from the main menu.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>When and how will I receive payments?</Text>
            <Text style={styles.faqAnswer}>Payments are processed and transferred to your registered bank account based on your settlement cycle (typically weekly). View payment status and history in the Wallet section.</Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Why is my store showing a low balance warning?</Text>
            <Text style={styles.faqAnswer}>This appears when your store account balance falls below a minimum threshold. Tap on the Wallet section to add funds or contact our support team for assistance with payments.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#340e5c',
    paddingVertical: 16,
    paddingHorizontal: 16,
    elevation: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 40,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  contactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(94, 53, 177, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    color: '#666666',
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  faqItem: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});

export default HelpScreen;

import React, {useState} from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Text,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {DrawerNavigationProp} from '@react-navigation/drawer';
import {DrawerParamList} from '../../../navigation/Sidebar';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {TouchableOpacity} from 'react-native-gesture-handler';

type PrivacyPolicyScreenProps = {
  navigation: DrawerNavigationProp<DrawerParamList, 'PrivacyPolicy'>;
};

const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({
  navigation,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  // URL for your privacy policy - replace with your actual URL
  const privacyPolicyUrl = 'https://dokirana.com/branch/privacy-policy';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.rightPlaceholder} />
      </View>

      <View style={styles.webviewContainer}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#340e5c" />
          </View>
        )}
        <WebView
          source={{uri: privacyPolicyUrl}}
          style={styles.webview}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#340e5c',
  },
  backButton: {
    padding: 8,
  },
  rightPlaceholder: {
    width: 40,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1,
  },
});

export default PrivacyPolicyScreen;

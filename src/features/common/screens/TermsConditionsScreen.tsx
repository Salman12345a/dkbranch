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

type TermsConditionsScreenProps = {
  navigation: DrawerNavigationProp<DrawerParamList, 'TermsConditions'>;
};

const termsHtmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; line-height: 1.6; color: #222; }
      h1 { font-size: 20px; margin-bottom: 8px; }
      p { margin: 8px 0; }
    </style>
  </head>
  <body>
    <h1>Terms & Conditions</h1>
    <p>Welcome to DoKirana. By using this app, you agree to use it responsibly and keep your account information secure.</p>
    <p>We may update these terms from time to time. Continued use of the app after any updates means you accept the revised terms.</p>
    <p>For any questions, please contact our support team through the app or our official contact details.</p>
  </body>
</html>`;

const TermsConditionsScreen: React.FC<TermsConditionsScreenProps> = ({
  navigation,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [useFallbackHtml, setUseFallbackHtml] = useState(false);

  const termsConditionsUrl = 'https://do-kirana-website.vercel.app/branch/terms';
  const webViewSource = useFallbackHtml
    ? {html: termsHtmlContent}
    : {uri: termsConditionsUrl};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.rightPlaceholder} />
      </View>

      <View style={styles.webviewContainer}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#340e5c" />
          </View>
        )}
        <WebView
          source={webViewSource}
          style={styles.webview}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => setUseFallbackHtml(true)}
          onHttpError={() => setUseFallbackHtml(true)}
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

export default TermsConditionsScreen;

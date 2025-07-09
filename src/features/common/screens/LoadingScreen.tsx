import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { storage } from '../../../utils/storage';

const LoadingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loadingState, setLoadingState] = useState('Loading components...');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Start loading animation
        setLoadingState('Preparing application...');
        
        // Simulate loading components (you can add actual loading logic here)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setLoadingState('Finalizing setup...');
        
        // Complete loading and navigate to HomeScreen
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to HomeScreen
        const token = storage.getString('accessToken');
        const isApproved = storage.getBoolean('isApproved') || false;
        const userId = storage.getString('userId');
        
        if (token && (isApproved || userId)) {
          navigation.replace('HomeScreen');
        } else {
          // Fallback for unexpected state
          navigation.replace('EntryScreen');
        }
      } catch (error) {
        console.error('Loading screen error:', error);
        navigation.replace('EntryScreen');
      }
    };

    loadData();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../../../assets/animations/prepare.json')}
        autoPlay
        loop
        style={styles.animation}
      />
      <Text style={styles.loadingText}>{loadingState}</Text>
      <ActivityIndicator size="small" color="#340e5c" style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  animation: {
    width: 200,
    height: 200,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#340e5c',
    fontWeight: '500',
  },
  loader: {
    marginTop: 20,
  }
});

export default LoadingScreen;

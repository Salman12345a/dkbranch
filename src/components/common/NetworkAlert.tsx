import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Icon from 'react-native-vector-icons/MaterialIcons';

const NetworkAlert: React.FC = () => {
  // We'll only show the alert when there's no internet connection
  const [hasNoInternet, setHasNoInternet] = useState<boolean>(false);
  
  // Animation value for slide-in/out effect
  const translateY = useRef(new Animated.Value(-100)).current;
  
  // Show the connected message briefly when connection is restored
  const [showingRestored, setShowingRestored] = useState<boolean>(false);
  
  // Track the previous connection state to detect changes
  const prevConnected = useRef<boolean | null>(null);
  
  // Set up the network listener
  useEffect(() => {
    // Start by checking current connection status
    NetInfo.fetch().then(state => {
      const isConnected = !!state.isConnected && state.isInternetReachable !== false;
      prevConnected.current = isConnected;
      setHasNoInternet(!isConnected);
    });
    
    // Subscribe to connection changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = !!state.isConnected && state.isInternetReachable !== false;
      
      console.log('[NetworkAlert] Connection state:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        wasConnected: prevConnected.current,
        nowConnected: isConnected
      });
      
      // Detect connection state changes
      if (prevConnected.current === false && isConnected === true) {
        // Connection was restored - show 'restored' message briefly
        setHasNoInternet(false);
        setShowingRestored(true);
        
        // Slide in the 'restored' message
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 9,
          useNativeDriver: true,
        }).start();
        
        // Then hide it after 2 seconds
        setTimeout(() => {
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowingRestored(false);
          });
        }, 2000);
      } 
      else if (!isConnected) {
        // No connection - show the alert
        setHasNoInternet(true);
        setShowingRestored(false);
        
        // Slide in the alert
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 9,
          useNativeDriver: true,
        }).start();
      }
      
      // Update the previous connection state
      prevConnected.current = isConnected;
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Function to handle manual close button press
  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setHasNoInternet(false);
      setShowingRestored(false);
    });
  };
  
  // Don't render anything if there's internet and we're not showing 'restored'
  if (!hasNoInternet && !showingRestored) {
    return null;
  }
  
  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }] },
        showingRestored ? styles.connectedContainer : styles.disconnectedContainer,
      ]}
    >
      <View style={styles.content}>
        <Icon
          name={showingRestored ? 'wifi' : 'wifi-off'}
          size={24}
          color='#fff'
        />
        <Text style={styles.text}>
          {showingRestored
            ? 'Internet connection restored'
            : 'No internet connection'}
        </Text>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Icon name="close" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    zIndex: 1000,
  },
  disconnectedContainer: {
    backgroundColor: '#E53935', // Red color for disconnected state
  },
  connectedContainer: {
    backgroundColor: '#43A047', // Green color for connected state
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
  },
});

export default NetworkAlert;

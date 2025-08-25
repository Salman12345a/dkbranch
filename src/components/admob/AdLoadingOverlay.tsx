import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import LottieView from 'lottie-react-native';

interface AdLoadingOverlayProps {
  visible: boolean;
  opacity: Animated.Value;
}

const AdLoadingOverlay: React.FC<AdLoadingOverlayProps> = ({ visible, opacity }) => {
  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <View style={styles.container}>
        <LottieView
          source={require('../../assets/animations/prepare.json')}
          autoPlay
          loop
          style={styles.animation}
        />
        <Text style={styles.loadingText}>Loading Ad...</Text>
        <Text style={styles.subText}>Please wait while we prepare your reward</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  animation: {
    width: 120,
    height: 120,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default AdLoadingOverlay;

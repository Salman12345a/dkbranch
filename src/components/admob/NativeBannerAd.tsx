import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { ADMOB_CONFIG } from '../../services/admob/AdMobConfig';

interface NativeBannerAdProps {
  style?: any;
}

const NativeBannerAd: React.FC<NativeBannerAdProps> = ({ style }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const maxRetries = 2;

  // Debug logging
  useEffect(() => {
    console.log('NativeBannerAd mounted with config:', {
      adUnitId: ADMOB_CONFIG.nativeAdUnitId,
      testMode: ADMOB_CONFIG.testMode
    });
  }, []);

  const handleAdLoaded = () => {
    console.log('Native ad loaded successfully');
    setLoaded(true);
    setError(null);
    setRetryCount(0);
    setIsVisible(true);
  };

  const handleAdFailedToLoad = (error: any) => {
    console.log('Native ad failed to load:', error.code, error.message);
    
    // Silently handle no-fill errors, retry network/loading errors
    if (error.code === 'googleMobileAds/error-code-no-fill') {
      console.log('No-fill error - hiding ad');
      setError('no-fill');
      setLoaded(false);
      setIsVisible(false);
      return;
    }
    
    // Retry logic for network/loading errors
    if (retryCount < maxRetries) {
      console.log(`Retrying native ad load (attempt ${retryCount + 1})`);
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setError(null);
      }, 1500 * (retryCount + 1)); // Exponential backoff
      return;
    }
    
    console.log('Max retries reached - hiding ad');
    setError(error.message || 'Failed to load ad');
    setLoaded(false);
    setIsVisible(false);
  };

  if (!isVisible || error) {
    return null; // Don't show anything if native ad fails to load
  }

  // Only use production native ad unit - no fallback
  const adUnitId = ADMOB_CONFIG.nativeAdUnitId;

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        key={`native-${retryCount}`} // Force re-render on retry
        unitId={adUnitId}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        requestOptions={{
          keywords: ['food', 'restaurant', 'delivery', 'orders'],
        }}
        onAdLoaded={handleAdLoaded}
        onAdFailedToLoad={handleAdFailedToLoad}
      />
      
      {/* Ad Label */}
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>Ad</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adLabel: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default NativeBannerAd;

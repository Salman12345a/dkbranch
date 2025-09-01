import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { ADMOB_CONFIG } from '../../services/admob/AdMobConfig';

interface StickyBannerAdProps {
  style?: any;
}

const StickyBannerAd: React.FC<StickyBannerAdProps> = ({ style }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const handleAdLoaded = () => {
    console.log('Sticky banner ad loaded successfully');
    setLoaded(true);
    setError(null);
    setRetryCount(0);
  };

  const handleAdFailedToLoad = (error: any) => {
    // Silently handle no-fill errors, retry others
    if (error.code === 'googleMobileAds/error-code-no-fill') {
      setError('no-fill');
      setLoaded(false);
      return;
    }
    
    // Retry logic for network/loading errors
    if (retryCount < maxRetries) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setError(null);
      }, 2000 * (retryCount + 1)); // Exponential backoff
      return;
    }
    
    setError(error.message || 'Failed to load ad');
    setLoaded(false);
  };

  if (error) {
    return null; // Don't show anything if both ads fail to load
  }

  // Use production banner ad only - no fallback to maintain production quality
  const adUnitId = ADMOB_CONFIG.bannerAdUnitId;

  return (
    <View style={[styles.stickyContainer, style]}>
      <BannerAd
        key={`banner-${retryCount}`} // Force re-render on retry
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{
          keywords: ['sales', 'business', 'revenue', 'analytics'],
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
  stickyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
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

export default StickyBannerAd;

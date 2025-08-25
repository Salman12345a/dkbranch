import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { ADMOB_CONFIG } from '../../services/admob/AdMobConfig';

interface NativeBannerAdProps {
  style?: any;
}

const NativeBannerAd: React.FC<NativeBannerAdProps> = ({ style }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdLoaded = () => {
    console.log('Native ad loaded successfully');
    setLoaded(true);
    setError(null);
  };

  const handleAdFailedToLoad = (error: any) => {
    // Silently handle all ad load failures - show nothing if native ad fails
    setError(error.message || 'Failed to load ad');
    setLoaded(false);
  };

  if (error) {
    return null; // Don't show anything if native ad fails to load
  }

  // Only use production native ad unit - no fallback
  const adUnitId = ADMOB_CONFIG.nativeAdUnitId;

  return (
    <View style={[styles.container, style]}>
      <BannerAd
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

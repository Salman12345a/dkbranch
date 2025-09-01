import { AdMobConfig } from './types';

// AdMob Configuration
export const ADMOB_CONFIG: AdMobConfig = {
  // Test Ad Unit IDs for development
  rewardedAdUnitId: __DEV__ 
    ? 'ca-app-pub-3940256099942544/5224354917' // Test rewarded ad unit
    : 'ca-app-pub-2620094529158311/5828579508', // Production rewarded ad unit
  
  interstitialAdUnitId: __DEV__
    ? 'ca-app-pub-3940256099942544/1033173712' // Test interstitial ad unit
    : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyyyyyy', // Replace with your production interstitial ad unit
  
  bannerAdUnitId: __DEV__
    ? 'ca-app-pub-3940256099942544/6300978111' // Test banner ad unit
    : 'ca-app-pub-2620094529158311/4175768244', // Production banner ad unit
  
  nativeAdUnitId: __DEV__
    ? 'ca-app-pub-3940256099942544/2247696110' // Test native ad unit
    : 'ca-app-pub-2620094529158311/1098194678', // Production native ad unit
  
  testMode: __DEV__,
};

// Default ad request options
export const DEFAULT_AD_REQUEST_OPTIONS = {
  keywords: ['business', 'store', 'retail', 'shopping'],
  contentUrl: undefined,
  location: undefined,
};

// Ad configuration constants
export const AD_CONFIG = {
  PRELOAD_TIMEOUT: 8000, // 8 seconds - faster preloading
  SHOW_TIMEOUT: 12000, // 12 seconds - quicker timeout
  RETRY_DELAY: 15000, // 15 seconds - faster retry
  MAX_RETRY_ATTEMPTS: 2, // Reduced attempts for efficiency
  MIN_TIME_BETWEEN_ADS: 45000, // 45 seconds - slightly more frequent
  BANNER_REFRESH_INTERVAL: 60000, // 1 minute banner refresh
};

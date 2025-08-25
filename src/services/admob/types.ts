// AdMob Types and Interfaces
export interface AdMobConfig {
  rewardedAdUnitId: string;
  interstitialAdUnitId: string;
  bannerAdUnitId: string;
  nativeAdUnitId: string;
  testMode: boolean;
}

export interface AdRequestOptions {
  keywords?: string[];
  contentUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface AdReward {
  type: string;
  amount: number;
}

export interface AdEventCallbacks {
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: string) => void;
  onAdOpened?: () => void;
  onAdClosed?: () => void;
  onAdEarnedReward?: (reward: AdReward) => void;
  onAdFailedToShow?: (error: string) => void;
}

export interface AdMobState {
  rewardedAdLoaded: boolean;
  interstitialAdLoaded: boolean;
  bannerAdLoaded: boolean;
  nativeAdLoaded: boolean;
  isShowingAd: boolean;
  isLoadingAd: boolean;
  lastAdShown: Date | null;
  adLoadErrors: Record<string, string>;
}

export type AdType = 'rewarded' | 'interstitial' | 'banner' | 'native';

export interface ShowAdOptions {
  onComplete?: (success: boolean, reward?: AdReward) => void;
  onError?: (error: string) => void;
  timeout?: number;
}

import { useState, useCallback, useRef } from 'react';
import { useAdMobContext } from '../contexts/AdMobContext';
import { AdType, ShowAdOptions, AdReward } from '../services/admob/types';

interface UseAdMobReturn {
  // State
  isRewardedAdReady: boolean;
  isInterstitialAdReady: boolean;
  isShowingAd: boolean;
  lastAdShown: Date | null;
  
  // Actions
  showRewardedAd: (options?: ShowAdOptions) => Promise<boolean>;
  showInterstitialAd: (options?: ShowAdOptions) => Promise<boolean>;
  preloadAds: () => void;
  
  // Utilities
  isAdReady: (adType: AdType) => boolean;
  canShowAd: () => boolean;
}

export const useAdMob = (): UseAdMobReturn => {
  const { adMobService, state, refreshState } = useAdMobContext();
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  const showRewardedAd = useCallback(async (options: ShowAdOptions = {}): Promise<boolean> => {
    if (loadingRef.current) {
      console.warn('Ad is already being shown');
      return false;
    }

    setIsLoading(true);
    loadingRef.current = true;

    try {
      const result = await adMobService.showRewardedAd({
        ...options,
        onComplete: (success, reward) => {
          setIsLoading(false);
          loadingRef.current = false;
          refreshState();
          options.onComplete?.(success, reward);
        },
        onError: (error) => {
          setIsLoading(false);
          loadingRef.current = false;
          refreshState();
          options.onError?.(error);
        },
      });

      if (!result) {
        setIsLoading(false);
        loadingRef.current = false;
      }

      return result;
    } catch (error) {
      setIsLoading(false);
      loadingRef.current = false;
      console.error('Error in showRewardedAd:', error);
      return false;
    }
  }, [adMobService, refreshState]);

  const showInterstitialAd = useCallback(async (options: ShowAdOptions = {}): Promise<boolean> => {
    if (loadingRef.current) {
      console.warn('Ad is already being shown');
      return false;
    }

    setIsLoading(true);
    loadingRef.current = true;

    try {
      const result = await adMobService.showInterstitialAd({
        ...options,
        onComplete: (success) => {
          setIsLoading(false);
          loadingRef.current = false;
          refreshState();
          options.onComplete?.(success);
        },
        onError: (error) => {
          setIsLoading(false);
          loadingRef.current = false;
          refreshState();
          options.onError?.(error);
        },
      });

      if (!result) {
        setIsLoading(false);
        loadingRef.current = false;
      }

      return result;
    } catch (error) {
      setIsLoading(false);
      loadingRef.current = false;
      console.error('Error in showInterstitialAd:', error);
      return false;
    }
  }, [adMobService, refreshState]);

  const preloadAds = useCallback(() => {
    adMobService.preloadRewardedAd();
    adMobService.preloadInterstitialAd();
  }, [adMobService]);

  const isAdReady = useCallback((adType: AdType): boolean => {
    return adMobService.isAdReady(adType);
  }, [adMobService]);

  const canShowAd = useCallback((): boolean => {
    // Check time-based throttling and if any ad is ready
    const hasReadyAd = state.rewardedAdLoaded || state.interstitialAdLoaded;
    const notCurrentlyShowing = !state.isShowingAd && !isLoading;
    
    return hasReadyAd && notCurrentlyShowing;
  }, [state, isLoading]);

  return {
    // State
    isRewardedAdReady: state.rewardedAdLoaded,
    isInterstitialAdReady: state.interstitialAdLoaded,
    isShowingAd: state.isShowingAd || isLoading,
    lastAdShown: state.lastAdShown,
    
    // Actions
    showRewardedAd,
    showInterstitialAd,
    preloadAds,
    
    // Utilities
    isAdReady,
    canShowAd,
  };
};

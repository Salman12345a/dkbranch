import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AdMobService from '../services/admob/AdMobService';
import { AdMobState } from '../services/admob/types';

interface AdMobContextType {
  adMobService: AdMobService;
  state: AdMobState;
  refreshState: () => void;
}

const AdMobContext = createContext<AdMobContextType | undefined>(undefined);

interface AdMobProviderProps {
  children: ReactNode;
}

export const AdMobProvider: React.FC<AdMobProviderProps> = ({ children }) => {
  const [adMobService] = useState(() => AdMobService.getInstance());
  const [state, setState] = useState<AdMobState>(adMobService.getState());

  const refreshState = () => {
    setState(adMobService.getState());
  };

  useEffect(() => {
    // Listen to ad events and update state
    const handleStateChange = () => {
      refreshState();
    };

    // Subscribe to all ad events
    adMobService.on('rewardedAdLoaded', handleStateChange);
    adMobService.on('rewardedAdClosed', handleStateChange);
    adMobService.on('interstitialAdLoaded', handleStateChange);
    adMobService.on('interstitialAdClosed', handleStateChange);
    adMobService.on('bannerAdLoaded', handleStateChange);
    adMobService.on('nativeAdLoaded', handleStateChange);
    adMobService.on('adLoadingStateChanged', handleStateChange);

    // Cleanup on unmount
    return () => {
      adMobService.off('rewardedAdLoaded', handleStateChange);
      adMobService.off('rewardedAdClosed', handleStateChange);
      adMobService.off('interstitialAdLoaded', handleStateChange);
      adMobService.off('interstitialAdClosed', handleStateChange);
      adMobService.off('bannerAdLoaded', handleStateChange);
      adMobService.off('nativeAdLoaded', handleStateChange);
      adMobService.off('adLoadingStateChanged', handleStateChange);
    };
  }, [adMobService]);

  const contextValue: AdMobContextType = {
    adMobService,
    state,
    refreshState,
  };

  return (
    <AdMobContext.Provider value={contextValue}>
      {children}
    </AdMobContext.Provider>
  );
};

export const useAdMobContext = (): AdMobContextType => {
  const context = useContext(AdMobContext);
  if (!context) {
    throw new Error('useAdMobContext must be used within an AdMobProvider');
  }
  return context;
};

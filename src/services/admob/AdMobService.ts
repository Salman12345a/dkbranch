import {
  RewardedAd,
  InterstitialAd,
  BannerAd,
  RewardedAdEventType,
  AdEventType,
  MobileAds,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';
import { ADMOB_CONFIG, DEFAULT_AD_REQUEST_OPTIONS, AD_CONFIG } from './AdMobConfig';
import { AdType, AdEventCallbacks, AdReward, ShowAdOptions, AdMobState } from './types';

class AdMobService {
  private static instance: AdMobService;
  private rewardedAd: RewardedAd | null = null;
  private interstitialAd: InterstitialAd | null = null;
  private state: AdMobState = {
    rewardedAdLoaded: false,
    interstitialAdLoaded: false,
    bannerAdLoaded: false,
    nativeAdLoaded: false,
    isShowingAd: false,
    isLoadingAd: false,
    lastAdShown: null,
    adLoadErrors: {},
  };
  private listeners: Map<string, Function[]> = new Map();
  private retryAttempts: Map<AdType, number> = new Map();
  private initialized: boolean = false;

  private constructor() {
    this.initializeAds();
  }

  public static getInstance(): AdMobService {
    if (!AdMobService.instance) {
      AdMobService.instance = new AdMobService();
    }
    return AdMobService.instance;
  }

  // Initialize AdMob SDK
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[AdMobService] Initializing Google Mobile Ads...');
      await MobileAds().initialize();
      
      // Set request configuration
      await MobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.PG,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        testDeviceIdentifiers: ADMOB_CONFIG.testMode ? ['EMULATOR'] : [],
      });

      this.initialized = true;
      console.log('[AdMobService] Google Mobile Ads initialized successfully');
    } catch (error) {
      console.error('[AdMobService] Failed to initialize Google Mobile Ads:', error);
      this.initialized = false;
      // Don't throw error - allow app to continue without ads
    }
  }

  // Initialize ads
  private async initializeAds(): Promise<void> {
    try {
      console.log('[AdMobService] Initializing AdMob SDK...');
      await this.initialize();
      this.createRewardedAd();
      this.createInterstitialAd();
    } catch (error) {
      console.error('[AdMobService] Failed to initialize ads:', error);
    }
  }

  // Create rewarded ad
  private createRewardedAd(): void {
    try {
      console.log('[AdMobService] Creating rewarded ad with unit ID:', ADMOB_CONFIG.rewardedAdUnitId);
      this.rewardedAd = RewardedAd.createForAdRequest(
        ADMOB_CONFIG.rewardedAdUnitId,
        DEFAULT_AD_REQUEST_OPTIONS
      );

      this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        this.state.rewardedAdLoaded = true;
        this.retryAttempts.set('rewarded', 0);
        this.emit('rewardedAdLoaded');
        console.log('Rewarded ad loaded successfully');
      });

      this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
        this.state.rewardedAdLoaded = false;
        this.state.adLoadErrors.rewarded = error.message;
        this.handleAdLoadError('rewarded', error.message);
        console.error('Rewarded ad failed to load:', error);
      });

      this.rewardedAd.addAdEventListener(AdEventType.OPENED, () => {
        this.state.isShowingAd = true;
        this.emit('rewardedAdOpened');
      });

      this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
        this.state.isShowingAd = false;
        this.state.lastAdShown = new Date();
        this.emit('rewardedAdClosed');
        // Preload next ad
        this.preloadRewardedAd();
      });

      this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        this.emit('rewardedAdEarnedReward', reward);
      });

      // Start loading the ad
      this.rewardedAd.load();
    } catch (error) {
      console.error('Error creating rewarded ad:', error);
    }
  }

  // Create interstitial ad
  private createInterstitialAd(): void {
    try {
      this.interstitialAd = InterstitialAd.createForAdRequest(
        ADMOB_CONFIG.interstitialAdUnitId,
        DEFAULT_AD_REQUEST_OPTIONS
      );

      this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        this.state.interstitialAdLoaded = true;
        this.retryAttempts.set('interstitial', 0);
        this.emit('interstitialAdLoaded');
        console.log('Interstitial ad loaded successfully');
      });

      this.interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
        this.state.interstitialAdLoaded = false;
        this.state.adLoadErrors.interstitial = error.message;
        this.handleAdLoadError('interstitial', error.message);
        console.error('Interstitial ad failed to load:', error);
      });

      this.interstitialAd.addAdEventListener(AdEventType.OPENED, async () => {
        this.state.isShowingAd = true;
        this.emit('interstitialAdOpened');
      });

      this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        this.state.isShowingAd = false;
        this.state.lastAdShown = new Date();
        this.emit('interstitialAdClosed');
        // Preload next ad
        this.preloadInterstitialAd();
      });

      // Start loading the ad
      this.interstitialAd.load();
    } catch (error) {
      console.error('Error creating interstitial ad:', error);
    }
  }

  // Show rewarded ad
  public async showRewardedAd(options: ShowAdOptions = {}): Promise<boolean> {
    const { onComplete, onError, timeout = AD_CONFIG.SHOW_TIMEOUT } = options;

    try {
      // Set loading state
      this.state.isLoadingAd = true;
      this.emit('adLoadingStateChanged', true);

      // Check if enough time has passed since last ad
      if (!this.canShowAd()) {
        const error = 'Not enough time has passed since last ad';
        this.state.isLoadingAd = false;
        this.emit('adLoadingStateChanged', false);
        onError?.(error);
        return false;
      }

      // Check if ad is loaded
      if (!this.state.rewardedAdLoaded || !this.rewardedAd) {
        const error = 'Rewarded ad not ready';
        this.state.isLoadingAd = false;
        this.emit('adLoadingStateChanged', false);
        onError?.(error);
        return false;
      }

      return new Promise((resolve) => {
        let adCompleted = false;
        let rewardEarned = false;
        let reward: AdReward | undefined;

        // Set up timeout
        const timeoutId = setTimeout(() => {
          if (!adCompleted) {
            adCompleted = true;
            this.state.isLoadingAd = false;
            this.emit('adLoadingStateChanged', false);
            onError?.('Ad show timeout');
            resolve(false);
          }
        }, timeout);

        // Listen for reward earned
        const unsubscribeReward = this.rewardedAd!.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          (adReward) => {
            rewardEarned = true;
            reward = adReward;
          }
        );

        // Listen for ad closed
        const unsubscribeClosed = this.rewardedAd!.addAdEventListener(
          AdEventType.CLOSED,
          () => {
            clearTimeout(timeoutId);
            unsubscribeReward();
            unsubscribeClosed();
            
            // Clear loading state
            this.state.isLoadingAd = false;
            this.emit('adLoadingStateChanged', false);
            
            if (!adCompleted) {
              adCompleted = true;
              onComplete?.(rewardEarned, reward);
              resolve(rewardEarned);
            }
          }
        );

        // Show the ad
        this.rewardedAd!.show();
        this.state.rewardedAdLoaded = false;
      });
    } catch (error) {
      this.state.isLoadingAd = false;
      this.emit('adLoadingStateChanged', false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMessage);
      console.error('Error showing rewarded ad:', error);
      return false;
    }
  }

  // Show interstitial ad
  public async showInterstitialAd(options: ShowAdOptions = {}): Promise<boolean> {
    const { onComplete, onError, timeout = AD_CONFIG.SHOW_TIMEOUT } = options;

    try {
      if (!this.canShowAd()) {
        const error = 'Not enough time has passed since last ad';
        onError?.(error);
        return false;
      }

      if (!this.state.interstitialAdLoaded || !this.interstitialAd) {
        const error = 'Interstitial ad not ready';
        onError?.(error);
        return false;
      }

      return new Promise((resolve) => {
        let adCompleted = false;

        const timeoutId = setTimeout(() => {
          if (!adCompleted) {
            adCompleted = true;
            onError?.('Ad show timeout');
            resolve(false);
          }
        }, timeout);

        const unsubscribeClosed = this.interstitialAd!.addAdEventListener(
          AdEventType.CLOSED,
          () => {
            clearTimeout(timeoutId);
            unsubscribeClosed();
            
            if (!adCompleted) {
              adCompleted = true;
              onComplete?.(true);
              resolve(true);
            }
          }
        );

        this.interstitialAd!.show();
        this.state.interstitialAdLoaded = false;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMessage);
      console.error('Error showing interstitial ad:', error);
      return false;
    }
  }

  // Enhanced preload ads with better timing
  public preloadRewardedAd(): void {
    if (!this.state.rewardedAdLoaded && !this.state.isLoadingAd) {
      this.createRewardedAd();
    }
  }

  public preloadInterstitialAd(): void {
    if (!this.state.interstitialAdLoaded && !this.state.isLoadingAd) {
      this.createInterstitialAd();
    }
  }

  // Preload all ads for better performance
  public preloadAllAds(): void {
    setTimeout(() => this.preloadRewardedAd(), 1000);
    setTimeout(() => this.preloadInterstitialAd(), 2000);
  }

  // Check if ad can be shown (time-based throttling)
  private canShowAd(): boolean {
    if (!this.state.lastAdShown) return true;
    
    const timeSinceLastAd = Date.now() - this.state.lastAdShown.getTime();
    return timeSinceLastAd >= AD_CONFIG.MIN_TIME_BETWEEN_ADS;
  }

  // Handle ad load errors with retry logic
  private handleAdLoadError(adType: AdType, error: string): void {
    const currentAttempts = this.retryAttempts.get(adType) || 0;
    
    if (currentAttempts < AD_CONFIG.MAX_RETRY_ATTEMPTS) {
      this.retryAttempts.set(adType, currentAttempts + 1);
      
      setTimeout(() => {
        console.log(`Retrying ${adType} ad load (attempt ${currentAttempts + 1})`);
        if (adType === 'rewarded') {
          this.createRewardedAd();
        } else if (adType === 'interstitial') {
          this.createInterstitialAd();
        }
      }, AD_CONFIG.RETRY_DELAY);
    } else {
      console.error(`Max retry attempts reached for ${adType} ad`);
    }
  }

  // Event system
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  // Get current state
  public getState(): AdMobState {
    return { ...this.state };
  }

  // Check if specific ad type is ready
  public isAdReady(adType: AdType): boolean {
    switch (adType) {
      case 'rewarded':
        return this.state.rewardedAdLoaded;
      case 'interstitial':
        return this.state.interstitialAdLoaded;
      case 'banner':
        return this.state.bannerAdLoaded;
      case 'native':
        return this.state.nativeAdLoaded;
      default:
        return false;
    }
  }

  // Cleanup
  public cleanup(): void {
    this.listeners.clear();
    this.retryAttempts.clear();
  }
}

export default AdMobService;

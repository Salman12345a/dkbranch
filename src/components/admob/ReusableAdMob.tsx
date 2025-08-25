import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAdMob } from '../../hooks/useAdMob';

interface ReusableAdMobProps {
  children?: React.ReactNode;
  showLoadingIndicator?: boolean;
  loadingText?: string;
  adStatusTextStyle?: object;
}

/**
 * Reusable AdMob component that can wrap any UI element
 * and provide ad status feedback
 */
export const ReusableAdMob: React.FC<ReusableAdMobProps> = ({
  children,
  showLoadingIndicator = true,
  loadingText = 'Loading ad...',
  adStatusTextStyle = {},
}) => {
  const { isRewardedAdReady, isShowingAd } = useAdMob();

  return (
    <View style={styles.container}>
      {children}
      
      {/* Ad Status Indicators */}
      {isShowingAd && (
        <View style={styles.statusContainer}>
          {showLoadingIndicator && (
            <ActivityIndicator size="small" color="#007AFF" />
          )}
          <Text style={[styles.statusText, adStatusTextStyle]}>
            Watching ad...
          </Text>
        </View>
      )}
      
      {!isRewardedAdReady && !isShowingAd && (
        <View style={styles.statusContainer}>
          {showLoadingIndicator && (
            <ActivityIndicator size="small" color="#007AFF" />
          )}
          <Text style={[styles.statusText, adStatusTextStyle]}>
            {loadingText}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 6,
    fontStyle: 'italic',
  },
});

export default ReusableAdMob;

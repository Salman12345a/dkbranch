import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Dimensions} from 'react-native';
import LottieView from 'lottie-react-native';

const {width, height} = Dimensions.get('window');

interface CelebrationAnimationProps {
  visible: boolean;
  onAnimationFinish?: () => void;
}

const CelebrationAnimation: React.FC<CelebrationAnimationProps> = ({
  visible,
  onAnimationFinish,
}) => {
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    if (visible && animationRef.current) {
      animationRef.current.play();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <LottieView
        ref={animationRef}
        source={require('../../../assets/animations/confetti.json')}
        style={styles.animation}
        autoPlay
        loop={false}
        speed={1}
        onAnimationFinish={onAnimationFinish}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  animation: {
    width: width,
    height: height,
  },
});

export default CelebrationAnimation;

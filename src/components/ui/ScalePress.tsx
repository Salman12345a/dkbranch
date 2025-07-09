import {ViewStyle, TouchableOpacity} from 'react-native';
import React, {FC} from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface ScalePressProps {
  onPress?: () => void;
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

const ScalePress: FC<ScalePressProps> = ({onPress, children, style}) => {
  const scaleValue = useSharedValue(1);

  const onPressIn = () => {
    scaleValue.value = withSpring(0.92, {stiffness: 200, damping: 10});
  };

  const onPressOut = () => {
    scaleValue.value = withSpring(1, {stiffness: 200, damping: 10});
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scaleValue.value}],
    width: '100%',
  }));

  return (
    <TouchableOpacity
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      activeOpacity={1}
      style={style}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

export default ScalePress;

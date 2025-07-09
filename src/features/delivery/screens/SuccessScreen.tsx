import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import LottieView from 'lottie-react-native';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';

type SuccessScreenProps = StackScreenProps<RootStackParamList, 'SuccessScreen'>;

const SuccessScreen: React.FC<SuccessScreenProps> = ({navigation, route}) => {
  const {partnerId} = route.params;
  const message = 'Delivery Partner Registered!';

  useEffect(() => {
    const timer = setTimeout(
      () => navigation.navigate('DeliveryService'),
      2000,
    );
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../../../assets/animations/success.json')}
        autoPlay
        loop={false}
        style={styles.animation}
      />
      <Text style={styles.message}>
        {message} ID: {partnerId}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  animation: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default SuccessScreen;

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const FinancialSummary = ({financials}) => (
  <View style={styles.container}>
    <Text>Total Orders: {financials.totalOrders || 0}</Text>
    <Text>Platform Fees: ₹{financials.platformFees || 0}</Text>
    <Text>Status: {financials.paymentStatus || 'Pending'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {padding: 20},
});

export default FinancialSummary;

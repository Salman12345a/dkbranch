import React, {useEffect, useCallback, useState} from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import api from '../../../services/api';
import {storage} from '../../../utils/storage';

type SalesSummaryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'SalesSummary'
>;

interface SalesSummaryScreenProps {
  navigation: SalesSummaryScreenNavigationProp;
}

interface SalesData {
  branchId: string;
  timeRange: {
    from: string;
    to: string;
  };
  orderCount: number;
  totalSales: number;
  itemSales: Record<string, {quantity: number; revenue: number}>;
  currency: string;
}

const SalesSummaryScreen: React.FC<SalesSummaryScreenProps> = ({
  navigation,
}) => {
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSales = useCallback(async () => {
    try {
      const branchId = storage.getString('userId');
      if (!branchId) {
        console.error('No branchId available - redirecting to login');
        Alert.alert('Error', 'User not authenticated. Please login again.', [
          {
            text: 'OK',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{name: 'Authentication'}],
              }),
          },
        ]);
        return;
      }

      console.log('Fetching sales for branchId:', branchId);

      const token = storage.getString('accessToken');
      if (!token) {
        console.error('No token available - redirecting to login');
        Alert.alert('Error', 'User not authenticated. Please login again.', [
          {
            text: 'OK',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{name: 'Authentication'}],
              }),
          },
        ]);
        return;
      }

      const response = await api.get(`/orders/${branchId}/sales/last24hours`);
      console.log('Sales fetched successfully:', response.data);

      setSalesData(response.data.data);
    } catch (error: any) {
      console.error(
        'Fetch Sales Error:',
        error?.response?.status,
        error?.response?.data || error?.message || error,
      );

      if (error?.response?.status === 401) {
        console.log('Unauthorized - redirecting to login');
        storage.delete('accessToken');
        storage.delete('userId');
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.',
          [
            {
              text: 'OK',
              onPress: () =>
                navigation.reset({
                  index: 0,
                  routes: [{name: 'Authentication'}],
                }),
            },
          ],
        );
        return;
      }

      Alert.alert('Error', 'Failed to load sales data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading sales data...</Text>
      </View>
    );
  }

  if (!salesData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load sales data</Text>
        <Text style={styles.errorSubtext}>
          Please check your connection and try again
        </Text>
      </View>
    );
  }

  // Format date range for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fromDate = salesData.timeRange.from
    ? formatDate(salesData.timeRange.from)
    : 'N/A';
  const toDate = salesData.timeRange.to
    ? formatDate(salesData.timeRange.to)
    : 'N/A';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Sales Summary</Text>
        <Text style={styles.dateRange}>
          {fromDate} - {toDate}
        </Text>
      </View>

      <View style={styles.cardContainer}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total Orders</Text>
          <Text style={styles.cardValue}>{salesData.orderCount}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total Revenue</Text>
          <Text style={styles.cardValue}>
            {salesData.currency} {salesData.totalSales.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Additional Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Branch ID:</Text>
          <Text style={styles.infoValue}>{salesData.branchId}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Currency:</Text>
          <Text style={styles.infoValue}>{salesData.currency}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    padding: 20,
  },
  headerContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  dateRange: {
    fontSize: 14,
    color: '#666',
  },
  cardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flex: 0.48,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  infoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default SalesSummaryScreen;

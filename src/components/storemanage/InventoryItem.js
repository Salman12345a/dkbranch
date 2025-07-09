import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Switch,
  StyleSheet,
} from 'react-native';
import api from '../services/api';

const InventoryItem = ({item, onToggle}) => {
  const toggleStock = async () => {
    const newStock = !item.inStock;
    await api.patch(`/products/${item._id}`, {inStock: newStock});
    onToggle(item._id, newStock);
  };

  return (
    <View style={styles.item}>
      <Image source={{uri: item.image}} style={styles.image} />
      <Text>
        {item.name} - ₹{item.price}
      </Text>
      <Text>In Stock: {item.inStock ? 'Yes' : 'No'}</Text>
      <Switch value={item.inStock} onValueChange={toggleStock} />
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderRadius: 5,
    marginVertical: 5,
  },
  image: {width: 50, height: 50, marginRight: 10},
});

export default InventoryItem;

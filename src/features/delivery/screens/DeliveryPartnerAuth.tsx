import React, {useState, useEffect} from 'react';
import {
  View,
  TextInput,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';

const DeliveryPartnerAuth: React.FC = ({navigation}) => {
  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: 'male',
    licenseNumber: '',
    rcNumber: '',
    phone: '',
  });

  const [isFormValid, setIsFormValid] = useState(false);

  useEffect(() => {
    const isValid =
      form.licenseNumber.trim() !== '' &&
      form.rcNumber.trim() !== '' &&
      form.phone.trim() !== '' &&
      form.age.trim() !== '';
    setIsFormValid(isValid);
  }, [form]);

  const handleNext = () => {
    navigation.navigate('UploadDocuments', {
      formData: {
        name: form.name,
        age: form.age ? parseInt(form.age) : 0,
        gender: form.gender as 'male' | 'female' | 'other',
        licenseNumber: form.licenseNumber,
        rcNumber: form.rcNumber,
        phone: form.phone ? parseInt(form.phone) : 0,
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Delivery Partner Registration</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Full Name (optional)</Text>
        <View style={styles.inputContainer}>
          <Icon name="person" size={20} color="#7f8c8d" style={styles.icon} />
          <TextInput
            placeholder="John Doe"
            placeholderTextColor="#95a5a6"
            value={form.name}
            onChangeText={text => setForm({...form, name: text})}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Age</Text>
        <View style={styles.inputContainer}>
          <Icon name="event" size={20} color="#7f8c8d" style={styles.icon} />
          <TextInput
            placeholder="25"
            placeholderTextColor="#95a5a6"
            value={form.age}
            onChangeText={text => setForm({...form, age: text})}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Gender</Text>
        <View style={[styles.inputContainer, styles.pickerContainer]}>
          <Picker
            selectedValue={form.gender}
            onValueChange={value => setForm({...form, gender: value})}
            style={styles.picker}
            dropdownIconColor="#7f8c8d">
            <Picker.Item label="Male" value="male" />
            <Picker.Item label="Female" value="female" />
            <Picker.Item label="Other" value="other" />
          </Picker>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>License Number</Text>
        <View style={styles.inputContainer}>
          <Icon name="badge" size={20} color="#7f8c8d" style={styles.icon} />
          <TextInput
            placeholder="DL-1234567890"
            placeholderTextColor="#95a5a6"
            value={form.licenseNumber}
            onChangeText={text => setForm({...form, licenseNumber: text})}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>RC Number</Text>
        <View style={styles.inputContainer}>
          <Icon
            name="description"
            size={20}
            color="#7f8c8d"
            style={styles.icon}
          />
          <TextInput
            placeholder="RC-1234567890"
            placeholderTextColor="#95a5a6"
            value={form.rcNumber}
            onChangeText={text => setForm({...form, rcNumber: text})}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.inputContainer}>
          <Icon name="phone" size={20} color="#7f8c8d" style={styles.icon} />
          <TextInput
            placeholder="9876543210"
            placeholderTextColor="#95a5a6"
            value={form.phone}
            onChangeText={text => setForm({...form, phone: text})}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, !isFormValid && styles.disabledButton]}
        onPress={handleNext}
        disabled={!isFormValid}>
        <Text style={styles.buttonText}>Continue to Document Upload</Text>
        <Icon name="arrow-forward" size={20} color="white" />
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 25,
    backgroundColor: '#f8f9fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 30,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ecf0f1',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#2c3e50',
    fontSize: 16,
  },
  pickerContainer: {
    height: 50,
    justifyContent: 'center',
  },
  picker: {
    flex: 1,
    color: '#2c3e50',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeliveryPartnerAuth;

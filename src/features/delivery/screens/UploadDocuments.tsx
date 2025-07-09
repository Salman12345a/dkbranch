import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useStore} from '../../../store/ordersStore';

const UploadDocuments: React.FC = ({route, navigation}) => {
  const {formData} = route.params;
  const [files, setFiles] = useState({
    licenseImage: null,
    rcImage: null,
    aadhaarFront: null,
    aadhaarBack: null,
  });

  const pickFile = async (type: string) => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: 50 * 1024 * 1024,
    });
    if (!result.didCancel && result.assets) {
      setFiles({...files, [type]: result.assets[0]});
    }
  };

  const handleNext = () => {
    if (
      !files.licenseImage ||
      !files.rcImage ||
      !files.aadhaarFront ||
      !files.aadhaarBack
    ) {
      console.error('All files must be uploaded');
      return;
    }

    navigation.navigate('UploadPartnerPhoto', {
      formData,
      initialFiles: files,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Upload Required Documents</Text>

      <View style={styles.uploadSection}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickFile('licenseImage')}>
          <Text style={styles.buttonText}>Upload License Image</Text>
        </TouchableOpacity>
        <Text
          style={files.licenseImage ? styles.successText : styles.errorText}>
          {files.licenseImage ? '✓ License Uploaded' : 'License Required'}
        </Text>
      </View>

      <View style={styles.uploadSection}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickFile('rcImage')}>
          <Text style={styles.buttonText}>Upload RC Image</Text>
        </TouchableOpacity>
        <Text style={files.rcImage ? styles.successText : styles.errorText}>
          {files.rcImage ? '✓ RC Uploaded' : 'RC Required'}
        </Text>
      </View>

      <View style={styles.uploadSection}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickFile('aadhaarFront')}>
          <Text style={styles.buttonText}>Upload Aadhaar Front</Text>
        </TouchableOpacity>
        <Text
          style={files.aadhaarFront ? styles.successText : styles.errorText}>
          {files.aadhaarFront
            ? '✓ Aadhaar Front Uploaded'
            : 'Aadhaar Front Required'}
        </Text>
      </View>

      <View style={styles.uploadSection}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickFile('aadhaarBack')}>
          <Text style={styles.buttonText}>Upload Aadhaar Back</Text>
        </TouchableOpacity>
        <Text style={files.aadhaarBack ? styles.successText : styles.errorText}>
          {files.aadhaarBack
            ? '✓ Aadhaar Back Uploaded'
            : 'Aadhaar Back Required'}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.submitButton,
          !files.licenseImage ||
          !files.rcImage ||
          !files.aadhaarFront ||
          !files.aadhaarBack
            ? styles.disabledButton
            : null,
        ]}
        onPress={handleNext}
        disabled={
          !files.licenseImage ||
          !files.rcImage ||
          !files.aadhaarFront ||
          !files.aadhaarBack
        }>
        <Text style={styles.submitButtonText}>Next</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 30,
    textAlign: 'center',
  },
  uploadSection: {
    marginBottom: 25,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadButton: {
    backgroundColor: '#3498db',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  successText: {
    color: '#27ae60',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default UploadDocuments;

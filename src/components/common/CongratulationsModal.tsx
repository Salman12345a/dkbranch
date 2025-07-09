import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const {width, height} = Dimensions.get('window');

interface CongratulationsModalProps {
  visible: boolean;
  branchName: string;
  onClose: () => void;
}

const CongratulationsModal: React.FC<CongratulationsModalProps> = ({
  visible,
  branchName,
  onClose,
}) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.modalContent}>
          <Text style={styles.congratsText}>Congratulations!</Text>

          <Text style={styles.branchNameText}>{branchName}</Text>

          <Text style={styles.message}>
            Your branch has been successfully registered with DKbranch. You're
            now ready to start managing your digital kirana efficiently.
          </Text>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              • Access to inventory management{'\n'}• Real-time order tracking
              {'\n'}• Customer engagement tools{'\n'}• Sales analytics and
              reports
            </Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Proceed to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  congratsText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginBottom: 10,
    textAlign: 'center',
    zIndex: 1,
  },
  branchNameText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  infoContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  infoText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#2ecc71',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CongratulationsModal;

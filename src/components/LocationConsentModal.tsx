import React from 'react';
import { View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { spacing, colors } from '../styles/theme';

type Props = {
  visible: boolean;
  onAllow: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
};

const LocationConsentModal: React.FC<Props> = ({ visible, onAllow, onSkip }) => {
  return (
    <Portal>
      <Modal visible={visible} onDismiss={() => {}} contentContainerStyle={styles.modal}>
        <Text variant="titleLarge">Location Access for Route Practice</Text>
        <Text style={styles.text}>
          Drivest uses your device location to show driving routes and practise navigation.
        </Text>
        <Text style={styles.text}>• Location is used only when route features are active</Text>
        <Text style={styles.text}>• Continuous location history is not stored on Drivest servers</Text>
        <Text style={styles.text}>• Location data is not sold or used for advertising</Text>
        <Text style={styles.text}>You can change this permission anytime in your device settings.</Text>
        <View style={{ marginTop: spacing(2), gap: spacing(1) }}>
          <Button mode="contained" onPress={onAllow}>
            Allow Location Access
          </Button>
          <Button mode="outlined" onPress={onSkip}>
            Not Now
          </Button>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = {
  modal: {
    backgroundColor: '#fff',
    marginHorizontal: spacing(3),
    padding: spacing(3),
    borderRadius: 16,
  },
  text: {
    color: colors.muted,
    marginTop: spacing(0.5),
  },
};

export default LocationConsentModal;

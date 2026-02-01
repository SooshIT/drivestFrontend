import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { colors, spacing } from '../styles/theme';
import { TestCentre } from '../api';

interface Props {
  centre: TestCentre;
  onPress: () => void;
}

const CentreCard: React.FC<Props> = ({ centre, onPress }) => {
  // Format address display - show address if available, otherwise show city and postcode
  const addressDisplay = centre.address 
    ? `${centre.address}, ${centre.city}` 
    : `${centre.city}, ${centre.postcode}`;

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <Text variant="titleMedium">{centre.name}</Text>
        <Text style={{ color: colors.muted, marginTop: spacing(0.25) }}>
          {addressDisplay}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          {centre.postcode}
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button mode="contained-tonal" onPress={onPress}>
          View routes
        </Button>
      </Card.Actions>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing(2),
    borderRadius: 14,
  },
});

export default CentreCard;

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, Button, Divider, ActivityIndicator } from 'react-native-paper';
import Purchases from 'react-native-purchases';
import { colors, spacing } from '../styles/theme';

interface Props {
  visible: boolean;
  guest?: boolean;
  onLogin?: () => void;
  onClose: () => void;
  onPurchase: () => void;
  onRestore: () => void;
}

const PaywallModal: React.FC<Props> = ({ visible, guest, onLogin, onClose, onPurchase, onRestore }) => {
  const [loading, setLoading] = useState(false);
  const [offering, setOffering] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const load = async () => {
      if (!Purchases || typeof Purchases.getOfferings !== 'function') {
        setOffering(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const offerings = await Purchases.getOfferings();
        setOffering(offerings.current ?? null);
      } catch (e) {
        console.warn('Failed to load offerings', e);
        setError('Unable to load plans right now.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [visible]);

  const packages = useMemo(() => {
    return offering?.availablePackages ?? [];
  }, [offering]);

  const labelForPackage = (pkg: any) => {
    const productId = pkg?.product?.identifier;
    const packageId = pkg?.identifier;
    const explicitLabels: Record<string, string> = {
      centre_colchester_week_ios: '£10 / week',
      centre_colchester_week_android: '£10 / week',
      centre_colchester_month_ios: '£29 / month',
      centre_colchester_month_android: '£29 / month',
      centre_colchester_quarter_ios: '£49 / 3 months',
      centre_colchester_quarter_android: '£49 / 3 months',
      centre_colchester_ios: '£10 centre pack',
      centre_colchester_android: '£10 centre pack',
      $rc_weekly: '£10 / week',
      $rc_monthly: '£29 / month',
      $rc_three_month: '£49 / 3 months',
      $rc_quarterly: '£49 / 3 months',
    };
    if (productId && explicitLabels[productId]) {
      return explicitLabels[productId];
    }
    if (packageId && explicitLabels[packageId]) {
      return explicitLabels[packageId];
    }
    const idText = `${productId || ''} ${packageId || ''}`.toLowerCase();
    if (idText.includes('week')) return '£10 / week';
    if (idText.includes('quarter') || idText.includes('3month') || idText.includes('three')) return '£49 / 3 months';
    if (idText.includes('month')) return '£29 / month';
    const period = pkg?.product?.subscriptionPeriod;
    if (!period) return '£10 centre pack';
    return '£29 / month';
  };

  const handlePackagePurchase = async (pkg: any) => {
    if (!Purchases || typeof Purchases.purchasePackage !== 'function') {
      await onPurchase();
      return;
    }
    try {
      await Purchases.purchasePackage(pkg);
      await onPurchase();
    } catch (e) {
      console.warn('Purchase failed', e);
    }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onClose} contentContainerStyle={styles.container}>
        <Text variant="titleLarge" style={styles.title}>
          Unlock routes
        </Text>
        <Text style={styles.subtitle}>
          Get access with a centre pack or a subscription (weekly, monthly, or 3‑month).
        </Text>
        <Divider style={{ marginVertical: spacing(1) }} />
        {guest ? (
          <>
            <Text style={{ color: colors.muted, marginBottom: spacing(1) }}>
              Sign in to unlock paid routes and subscriptions.
            </Text>
            <Button mode="contained" onPress={onLogin || onClose} style={{ marginBottom: spacing(1) }}>
              Sign in to purchase
            </Button>
          </>
        ) : (
          <>
            {loading && <ActivityIndicator style={{ marginVertical: spacing(1) }} />}
            {!!error && <Text style={{ color: colors.danger, marginBottom: spacing(1) }}>{error}</Text>}
            {packages.length > 0 ? (
              <View style={{ gap: spacing(1), marginBottom: spacing(1) }}>
                {packages.map((pkg: any) => (
                  <Button
                    key={pkg.identifier}
                    mode="contained"
                    onPress={() => handlePackagePurchase(pkg)}
                  >
                    {labelForPackage(pkg)}
                  </Button>
                ))}
              </View>
            ) : (
              <Button mode="contained" onPress={onPurchase} style={{ marginBottom: spacing(1) }}>
                Continue to purchase
              </Button>
            )}
            <Button mode="outlined" onPress={onRestore}>
              Restore purchases
            </Button>
          </>
        )}
        <Button onPress={onClose} textColor={colors.muted} style={{ marginTop: spacing(1) }}>
          Maybe later
        </Button>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: spacing(3),
    marginHorizontal: spacing(2),
    borderRadius: 16,
  },
  title: {
    color: colors.text,
    marginBottom: spacing(1),
  },
  subtitle: {
    color: colors.muted,
  },
});

export default PaywallModal;

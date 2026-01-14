import Purchases, { CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

const API_KEY = process.env.EXPO_PUBLIC_REVCAT_API_KEY || '';
const ENTITLEMENT_ID = 'drivest Pro';
let configured = false;
let initPromise: Promise<void> | null = null;

const ensureConfigured = async (): Promise<boolean> => {
  if (configured) return true;
  if (!API_KEY) return false;
  if (!Purchases || typeof Purchases.configure !== 'function') {
    console.warn('RevenueCat native module not available (Expo Go?). Skipping init.');
    return false;
  }
  if (!initPromise) {
    initPromise = (async () => {
      try {
        Purchases.setLogLevel(LOG_LEVEL.WARN);
        await Purchases.configure({
          apiKey: API_KEY,
          useAmazon: false,
        });
        configured = true;
      } catch (e) {
        console.warn('RevenueCat init failed', e);
      } finally {
        initPromise = null;
      }
    })();
  }
  await initPromise;
  return configured;
};

export const initRevenueCat = async () => {
  await ensureConfigured();
};

export const loginRevenueCat = async (appUserId?: string | null) => {
  if (!appUserId) return;
  const ok = await ensureConfigured();
  if (!ok || typeof Purchases.logIn !== 'function') return;
  try {
    await Purchases.logIn(appUserId);
  } catch (e) {
    console.warn('RevenueCat login failed', e);
  }
};

export const logoutRevenueCat = async () => {
  if (!configured || !Purchases || typeof Purchases.logOut !== 'function') return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('RevenueCat logout failed', e);
  }
};

export const fetchCustomerInfo = async (): Promise<CustomerInfo | null> => {
  const ok = await ensureConfigured();
  if (!ok) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn('Failed to fetch customer info', e);
    return null;
  }
};

export const hasDrivestPro = (info: CustomerInfo | null) => {
  return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
};

export const presentPaywall = async (): Promise<boolean> => {
  const ok = await ensureConfigured();
  if (!ok) return false;
  if (!RevenueCatUI || typeof RevenueCatUI.presentPaywall !== 'function') {
    console.warn('RevenueCatUI not available in this build.');
    return false;
  }
  try {
    const result = await RevenueCatUI.presentPaywall();
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  } catch (e) {
    console.warn('Paywall error', e);
    return false;
  }
};

export const restore = async (): Promise<CustomerInfo | null> => {
  const ok = await ensureConfigured();
  if (!ok) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (e) {
    console.warn('Restore failed', e);
    return null;
  }
};

export const openCustomerCenter = async () => {
  if (!RevenueCatUI || typeof RevenueCatUI.presentCustomerCenter !== 'function') {
    console.warn('Customer Center not available in this build.');
    return;
  }
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (e) {
    console.warn('Customer Center error', e);
  }
};

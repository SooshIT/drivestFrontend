import AsyncStorage from '@react-native-async-storage/async-storage';

export const CONSENT_KEYS = {
  baseAcceptedAt: 'consent.baseAcceptedAt',
  ageConfirmedAt: 'consent.ageConfirmedAt',
  analyticsChoice: 'consent.analyticsChoice',
  analyticsAt: 'consent.analyticsAt',
  notificationsChoice: 'consent.notificationsChoice',
  notificationsAt: 'consent.notificationsAt',
  locationChoice: 'consent.locationChoice',
  locationAt: 'consent.locationAt',
  safetyAcceptedAt: 'consent.safetyAcceptedAt',
};

export const consentNow = () => new Date().toISOString();

export const setConsentValue = async (key: string, value: string) => {
  await AsyncStorage.setItem(key, value);
};

export const getConsentValue = async (key: string) => {
  return AsyncStorage.getItem(key);
};

export const isOnboardingComplete = async () => {
  const [base, age] = await AsyncStorage.multiGet([CONSENT_KEYS.baseAcceptedAt, CONSENT_KEYS.ageConfirmedAt]);
  return Boolean(base?.[1] && age?.[1]);
};

export const resetOnboarding = async () => {
  await AsyncStorage.multiRemove([
    CONSENT_KEYS.baseAcceptedAt,
    CONSENT_KEYS.ageConfirmedAt,
    CONSENT_KEYS.analyticsChoice,
    CONSENT_KEYS.analyticsAt,
    CONSENT_KEYS.notificationsChoice,
    CONSENT_KEYS.notificationsAt,
    CONSENT_KEYS.locationChoice,
    CONSENT_KEYS.locationAt,
    CONSENT_KEYS.safetyAcceptedAt,
  ]);
};

export const buildConsentPayload = async () => {
  const entries = await AsyncStorage.multiGet([
    CONSENT_KEYS.baseAcceptedAt,
    CONSENT_KEYS.ageConfirmedAt,
    CONSENT_KEYS.analyticsChoice,
    CONSENT_KEYS.analyticsAt,
    CONSENT_KEYS.notificationsChoice,
    CONSENT_KEYS.notificationsAt,
    CONSENT_KEYS.locationChoice,
    CONSENT_KEYS.locationAt,
    CONSENT_KEYS.safetyAcceptedAt,
  ]);
  const map = Object.fromEntries(entries);
  const analyticsChoice =
    map[CONSENT_KEYS.analyticsChoice] === 'allow' || map[CONSENT_KEYS.analyticsChoice] === 'skip'
      ? (map[CONSENT_KEYS.analyticsChoice] as 'allow' | 'skip')
      : undefined;
  const notificationsChoice =
    map[CONSENT_KEYS.notificationsChoice] === 'enable' || map[CONSENT_KEYS.notificationsChoice] === 'skip'
      ? (map[CONSENT_KEYS.notificationsChoice] as 'enable' | 'skip')
      : undefined;
  const locationChoice =
    map[CONSENT_KEYS.locationChoice] === 'allow' ||
    map[CONSENT_KEYS.locationChoice] === 'deny' ||
    map[CONSENT_KEYS.locationChoice] === 'skip'
      ? (map[CONSENT_KEYS.locationChoice] as 'allow' | 'deny' | 'skip')
      : undefined;
  return {
    baseAcceptedAt: map[CONSENT_KEYS.baseAcceptedAt] || undefined,
    ageConfirmedAt: map[CONSENT_KEYS.ageConfirmedAt] || undefined,
    analyticsChoice,
    analyticsAt: map[CONSENT_KEYS.analyticsAt] || undefined,
    notificationsChoice,
    notificationsAt: map[CONSENT_KEYS.notificationsAt] || undefined,
    locationChoice,
    locationAt: map[CONSENT_KEYS.locationAt] || undefined,
    safetyAcceptedAt: map[CONSENT_KEYS.safetyAcceptedAt] || undefined,
  };
};

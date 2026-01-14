import 'react-native-gesture-handler/jestSetup';

jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'routemaster://'),
}));

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 0, longitude: 0 } })),
  watchPositionAsync: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: {
    presentPaywall: jest.fn(async () => 'NOT_PRESENTED'),
    presentCustomerCenter: jest.fn(async () => null),
    presentPaywallIfNeeded: jest.fn(async () => 'NOT_PRESENTED'),
  },
  PAYWALL_RESULT: {
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
    CANCELLED: 'CANCELLED',
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
  },
}));

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  withScope: (fn: () => void) => fn(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async () => null),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => null),
}));

jest.mock('expo-application', () => ({
  applicationId: 'com.drivest.app',
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
}));

jest.mock('react-native-purchases', () => ({
  setup: jest.fn(),
  setLogLevel: jest.fn(),
  getCustomerInfo: jest.fn(async () => ({ entitlements: { active: {} } })),
  getOfferings: jest.fn(async () => ({
    current: {
      availablePackages: [],
    },
  })),
  purchasePackage: jest.fn(async () => ({})),
  restorePurchases: jest.fn(async () => ({})),
}));

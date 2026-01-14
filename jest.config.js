module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/jest.rn-mock.js',
    '^react-native/(.*)$': '<rootDir>/jest.rn-mock.js',
    '^react-native-svg$': '<rootDir>/jest.rn-mock.js',
    '^react-native-paper$': '<rootDir>/jest.rn-mock.js',
    '^expo-secure-store$': '<rootDir>/jest.mocks/expo-secure-store.ts',
    '^expo-file-system$': '<rootDir>/jest.mocks/expo-file-system.ts',
    '^expo-file-system/legacy$': '<rootDir>/jest.mocks/expo-file-system.ts',
    '^expo-sharing$': '<rootDir>/jest.mocks/expo-sharing.ts',
    '^react-native-purchases-ui$': '<rootDir>/jest.mocks/react-native-purchases-ui.ts',
    '^@sentry/react-native$': '<rootDir>/jest.mocks/sentry-react-native.ts',
    '^expo-constants$': '<rootDir>/jest.mocks/expo-constants.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      diagnostics: false,
      isolatedModules: true,
    },
  },
};

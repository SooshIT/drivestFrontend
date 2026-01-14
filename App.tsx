import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import NavigationRoot from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { colors } from './src/styles/theme';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';
import { initDb } from './src/db';
import { initAppLogger } from './src/lib/appLogger';

initAppLogger();

const queryClient = new QueryClient();

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
  },
};

function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      await initDb();
      setDbReady(true);
    })();
  }, []);

  if (!dbReady) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NavigationRoot />
          </AuthProvider>
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const getDsn = () => {
  return (
    Constants.expoConfig?.extra?.sentryDsn ||
    (Constants.manifest as { extra?: { sentryDsn?: string } } | null)?.extra?.sentryDsn ||
    process.env.EXPO_PUBLIC_SENTRY_DSN
  );
};

const getEnvironment = () => {
  const extraEnv =
    Constants.expoConfig?.extra?.sentryEnv ||
    (Constants.manifest as { extra?: { sentryEnv?: string } } | null)?.extra?.sentryEnv;
  if (extraEnv) return String(extraEnv);
  if (process.env.EAS_BUILD_PROFILE) return `eas-${process.env.EAS_BUILD_PROFILE}`;
  if (process.env.EXPO_PUBLIC_SENTRY_ENV) return process.env.EXPO_PUBLIC_SENTRY_ENV;
  return 'production';
};

const getRelease = () => {
  const name = Constants.expoConfig?.name || 'drivest';
  const version = Constants.expoConfig?.version || '0.0.0';
  const build =
    Constants.expoConfig?.android?.versionCode?.toString() ||
    Constants.expoConfig?.ios?.buildNumber ||
    Constants.nativeBuildVersion ||
    '0';
  return `${name}@${version}+${build}`;
};

let didInit = false;

export const initSentry = () => {
  if (didInit) return true;
  const dsn = getDsn();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: getEnvironment(),
    release: getRelease(),
    enableAutoSessionTracking: true,
    tracesSampleRate: 1.0,
    debug: __DEV__,
    
  });
  didInit = true;
  return true;
};

export const identifySentry = (user?: { id?: string; name?: string | null; email?: string | null }) => {
  if (!initSentry() || !user?.id) return;
  Sentry.setUser({ id: user.id, email: user.email ?? undefined, username: user.name ?? undefined });
};

export const resetSentry = () => {
  if (!initSentry()) return;
  Sentry.setUser(null);
};

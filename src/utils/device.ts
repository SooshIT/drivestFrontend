import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_KEY = 'device_id';

const randomId = () => `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

export const getDeviceId = async (): Promise<string> => {
  if (Platform.OS === 'web') {
    const stored = await AsyncStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const id = randomId();
    await AsyncStorage.setItem(DEVICE_KEY, id);
    return id;
  }

  const secure = await SecureStore.getItemAsync(DEVICE_KEY);
  if (secure) return secure;

  let id = '';
  try {
    if (Platform.OS === 'android') {
      id = Application.getAndroidId() ?? '';
    } else if (Platform.OS === 'ios') {
      id = (await Application.getIosIdForVendorAsync()) ?? '';
    }
  } catch {
    id = '';
  }
  if (!id) id = randomId();

  await SecureStore.setItemAsync(DEVICE_KEY, id);
  return id;
};

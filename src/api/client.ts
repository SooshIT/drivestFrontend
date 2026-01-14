import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from '../utils/device';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  const deviceId = await getDeviceId();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers = config.headers || {};
  config.headers['x-device-id'] = deviceId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      AsyncStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
  },
);

export default api;

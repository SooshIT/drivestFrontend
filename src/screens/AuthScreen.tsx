import React, { useEffect, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { Button, Text, TextInput, Card, Chip } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../styles/theme';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const AuthScreen: React.FC<any> = ({ navigation, route }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const { login, register, startGuest } = useAuth();
  const {
    control,
    handleSubmit,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    if (route?.params?.mode === 'register') {
      setMode('register');
      return;
    }
    if (route?.params?.mode === 'login') {
      setMode('login');
    }
  }, [route?.params?.mode]);

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      if (mode === 'login') {
        await login(data.email, data.password);
      } else {
        if (!data.name || data.name.trim().length < 2) {
          setFormError('name', { type: 'manual', message: 'Name must be at least 2 characters.' });
          return;
        }
        await register(data.email, data.password, data.name || 'New Driver', data.phone);
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        'Unable to authenticate. Please check your details.';
      setError(msg);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.subtitle}>Master your driving test routes with live navigation.</Text>
            <View style={styles.badges}>
              <Chip icon="map" style={styles.badge} textStyle={styles.badgeText}>
                Map-first
              </Chip>
              <Chip icon="navigation" style={styles.badge} textStyle={styles.badgeText}>
                Turn-by-turn
              </Chip>
              <Chip icon="shield-check" style={styles.badge} textStyle={styles.badgeText}>
                Cashback once
              </Chip>
            </View>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    label="Email"
                    mode="outlined"
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={{ marginBottom: spacing(1) }}
                  />
                )}
              />
              {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    label="Password"
                    mode="outlined"
                    secureTextEntry
                    value={value}
                    onChangeText={onChange}
                    style={{ marginBottom: spacing(1) }}
                  />
                )}
              />
              {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
              {mode === 'register' && (
                <>
                  <Controller
                    control={control}
                    name="name"
                    render={({ field: { onChange, value } }) => (
                      <TextInput label="Name" mode="outlined" value={value} onChangeText={onChange} style={{ marginBottom: spacing(1) }} />
                    )}
                  />
                  {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field: { onChange, value } }) => (
                      <TextInput label="Phone" mode="outlined" value={value} onChangeText={onChange} style={{ marginBottom: spacing(1) }} />
                    )}
                  />
                </>
              )}
              <Button mode="contained" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={{ marginTop: spacing(2) }}>
                {mode === 'login' ? 'Login' : 'Create account'}
              </Button>
              <Button
                mode="outlined"
                onPress={async () => {
                  await startGuest();
                }}
                style={{ marginTop: spacing(1) }}
              >
                Continue as guest
              </Button>
              <Button
                mode="text"
                onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
                textColor={colors.primary}
                style={{ marginTop: spacing(1) }}
              >
                {mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Login'}
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
        {error && (
          <Text style={styles.errorBanner}>
            {error}
          </Text>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing(3) },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: spacing(4) },
  hero: { alignItems: 'center', marginBottom: spacing(2) },
  title: { textAlign: 'center', marginTop: spacing(1), color: colors.text, fontWeight: '800' },
  subtitle: { textAlign: 'center', marginTop: spacing(1), color: colors.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing(1) },
  badge: { margin: spacing(0.5), backgroundColor: '#e7ecff' },
  badgeText: { color: colors.text },
  card: { borderRadius: 16, backgroundColor: '#fff' },
  error: { color: colors.danger, marginTop: spacing(0.5) },
  logo: { width: 350, height: 350, marginBottom: spacing(-6) },
  errorBanner: {
    marginTop: spacing(1),
    textAlign: 'center',
    color: colors.danger,
    backgroundColor: 'rgba(255,0,0,0.08)',
    padding: spacing(1),
    borderRadius: 12,
  },
});

export default AuthScreen;

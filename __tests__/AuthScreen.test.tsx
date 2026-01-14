import React from 'react';
import renderer from 'react-test-renderer';
import AuthScreen from '../src/screens/AuthScreen';
import { AuthProvider } from '../src/context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider } from 'react-native-paper';

const qc = new QueryClient();

jest.mock('../src/context/AuthContext', () => {
  const actual = jest.requireActual('../src/context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({ login: jest.fn(), register: jest.fn(), user: null }),
    AuthProvider: ({ children }: any) => <>{children}</>,
  };
});

describe('AuthScreen', () => {
  it('renders without crashing', () => {
    const tree = renderer.create(
      <PaperProvider>
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <AuthScreen navigation={{ replace: jest.fn() }} />
          </AuthProvider>
        </QueryClientProvider>
      </PaperProvider>,
    );
    expect(tree).toBeTruthy();
  });
});

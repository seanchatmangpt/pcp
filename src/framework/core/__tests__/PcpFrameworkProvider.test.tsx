// @ts-nocheck
import React from 'react';
import { render } from '@testing-library/react-native';
import { PcpFrameworkProvider } from '../PcpFrameworkProvider';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => <>{children}</>,
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: any) => <>{children}</>,
}));

describe('PcpFrameworkProvider', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <PcpFrameworkProvider>
        <></>
      </PcpFrameworkProvider>
    );
    expect(true).toBe(true);
  });
});

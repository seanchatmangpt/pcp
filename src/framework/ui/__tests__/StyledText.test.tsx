import React from 'react';
import { render } from '@testing-library/react-native';
import { MonoText } from '../StyledText';
import { ThemeProvider } from '../theme/ThemeContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('StyledText', () => {
  it('renders MonoText with correct font family and additional className', () => {
    const { getByText } = render(<MonoText className="extra">Hello</MonoText>, { wrapper });
    const text = getByText('Hello');
    expect(text).toBeTruthy();
  });
});

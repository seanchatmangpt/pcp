/**
 * @fileoverview Tests for Semantic Layout components.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SemanticI18nProvider } from './SemanticI18nContext';
import { SemanticIntentView, SemanticText } from './SemanticLayout';
import { View, Text } from 'react-native';

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('SemanticLayout Components', () => {
  it('renders SemanticText correctly in en-US', async () => {
    const { findByText } = render(
      <SemanticI18nProvider initialCulture="en-US">
        <SemanticText intentKey="auth.login" />
      </SemanticI18nProvider>
    );

    const element = await findByText('Log In');
    expect(element).toBeTruthy();
    expect(element.props.style).toContainEqual({ textAlign: 'left' });
  });

  it('renders SemanticText correctly in ar-SA (RTL)', async () => {
    const { findByText } = render(
      <SemanticI18nProvider initialCulture="ar-SA">
        <SemanticText intentKey="auth.login" />
      </SemanticI18nProvider>
    );

    const element = await findByText('تسجيل الدخول');
    expect(element).toBeTruthy();
    expect(element.props.style).toContainEqual({ textAlign: 'right' });
  });

  it('renders SemanticIntentView with flipped layout in ar-SA', async () => {
    const { findByTestId } = render(
      <SemanticI18nProvider initialCulture="ar-SA">
        <SemanticIntentView intentKey="auth.login" testID="intent-view" />
      </SemanticI18nProvider>
    );

    const element = await findByTestId('intent-view');
    expect(element.props.style).toContainEqual({
      flexDirection: 'row-reverse',
      alignItems: 'center',
    });
  });

  it('provides intent to children in SemanticIntentView', async () => {
    const { findByText } = render(
      <SemanticI18nProvider initialCulture="en-US">
        <SemanticIntentView intentKey="welcome.message" variables={{ name: 'Pcp' }}>
          {(intent) => <Text>{intent.text}</Text>}
        </SemanticIntentView>
      </SemanticI18nProvider>
    );

    const element = await findByText('Welcome back, Pcp!');
    expect(element).toBeTruthy();
  });
});

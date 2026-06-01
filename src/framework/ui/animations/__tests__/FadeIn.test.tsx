import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FadeIn } from '../FadeIn';

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return Reanimated;
});

describe('FadeIn', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <FadeIn>
        <Text>Fade Me In</Text>
      </FadeIn>
    );
    expect(getByText('Fade Me In')).toBeTruthy();
  });

  it('applies custom style', () => {
    const { getByTestId } = render(
      <FadeIn testID="fade-in" style={{ marginTop: 10 }}>
        <Text>Fade Me In</Text>
      </FadeIn>
    );
    const element = getByTestId('fade-in');
    expect(element.props.style).toContainEqual({ marginTop: 10 });
  });
});

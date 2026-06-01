import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SlideTransition } from '../SlideTransition';

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return Reanimated;
});

describe('SlideTransition', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <SlideTransition>
        <Text>Slide Me</Text>
      </SlideTransition>
    );
    expect(getByText('Slide Me')).toBeTruthy();
  });

  it('applies custom style', () => {
    const { getByTestId } = render(
      <SlideTransition testID="slide-transition" style={{ padding: 20 }}>
        <Text>Slide Me</Text>
      </SlideTransition>
    );
    const element = getByTestId('slide-transition');
    expect(element.props.style).toContainEqual({ padding: 20 });
  });
});

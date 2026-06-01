import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ScalePress } from '../ScalePress';

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.createAnimatedComponent = (component: any) => component;
  return Reanimated;
});

describe('ScalePress', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <ScalePress>
        <Text>Press Me</Text>
      </ScalePress>
    );
    expect(getByText('Press Me')).toBeTruthy();
  });

  it('handles onPress event', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ScalePress onPress={onPress}>
        <Text>Press Me</Text>
      </ScalePress>
    );
    fireEvent.press(getByText('Press Me'));
    expect(onPress).toHaveBeenCalled();
  });

  it('applies custom container style', () => {
    const { getByTestId } = render(
      <ScalePress testID="scale-press" containerStyle={{ backgroundColor: 'red' }}>
        <Text>Press Me</Text>
      </ScalePress>
    );
    const element = getByTestId('scale-press');
    expect(element.props.style).toContainEqual({ backgroundColor: 'red' });
  });
});
